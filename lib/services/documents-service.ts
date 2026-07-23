import prisma from '@/lib/prisma'

export function listDocuments(params: { entityType?: string | null; entityId?: string | null; search?: string; category?: string | null }) {
  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (params.entityType) where.entityType = params.entityType
  if (params.entityId) where.entityId = params.entityId
  if (params.category) where.category = params.category
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { fileName: { contains: params.search, mode: 'insensitive' } },
      { tags: { has: params.search } },
    ]
  }
  return prisma.businessDocument.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function createDocument(data: Record<string, unknown>, uploadedById: string) {
  const allowed = ['title', 'category', 'entityType', 'entityId', 'fileUrl', 'fileName', 'fileSize', 'mimeType', 'tags', 'notes']
  const createData: Record<string, unknown> = { uploadedById }
  for (const key of allowed) {
    if (data[key] !== undefined) createData[key] = data[key]
  }
  if (data.expiryDate) createData.expiryDate = new Date(data.expiryDate as string)
  return prisma.businessDocument.create({ data: createData as any })
}

export function archiveDocument(id: string) {
  return prisma.businessDocument.update({ where: { id }, data: { status: 'ARCHIVED' } })
}
