import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod/v4'

type Params = Promise<{ id: string }>

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  addPermissionIds: z.array(z.string()).optional(),
  removePermissionIds: z.array(z.string()).optional(),
  addPermissions: z.array(z.object({
    permissionId: z.string(),
    scope: z.string().optional(),
  })).optional(),
  updatePermissionScope: z.object({
    permissionId: z.string(),
    scope: z.string().nullable(),
  }).optional(),
  // Update scope for ALL permissions belonging to a module
  updateModuleScope: z.object({
    module: z.string(),
    scope: z.string(),
  }).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { addPermissionIds, removePermissionIds, addPermissions, updatePermissionScope, updateModuleScope, ...roleData } = parsed.data

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(roleData).length) {
        await tx.customRole.update({ where: { id }, data: roleData })
      }
      if (addPermissionIds?.length) {
        await tx.rolePermission.createMany({
          data: addPermissionIds.map((permissionId) => ({ customRoleId: id, permissionId })),
          skipDuplicates: true,
        })
      }
      if (addPermissions?.length) {
        await tx.rolePermission.createMany({
          data: addPermissions.map(({ permissionId, scope }) => ({ customRoleId: id, permissionId, scope: scope ?? null })),
          skipDuplicates: true,
        })
      }
      if (removePermissionIds?.length) {
        await tx.rolePermission.deleteMany({
          where: { customRoleId: id, permissionId: { in: removePermissionIds } },
        })
      }
      if (updatePermissionScope) {
        await tx.rolePermission.updateMany({
          where: { customRoleId: id, permissionId: updatePermissionScope.permissionId },
          data: { scope: updatePermissionScope.scope },
        })
      }
      if (updateModuleScope) {
        const modulePerms = await tx.permission.findMany({ where: { module: updateModuleScope.module } })
        await tx.rolePermission.updateMany({
          where: { customRoleId: id, permissionId: { in: modulePerms.map((p) => p.id) } },
          data: { scope: updateModuleScope.scope },
        })
      }
    })

    const updated = await prisma.customRole.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } }, _count: { select: { userRoles: true } } },
    })
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  try {
    await prisma.customRole.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: process.env.NODE_ENV === 'development' ? (err as Error).message : 'An unexpected error occurred' }, { status: 500 })
  }
}
