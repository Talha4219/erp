import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import type { Role } from '@/types/next-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.isActive || user.deletedAt) return null

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null
        }

        const valid = await bcrypt.compare(credentials.password as string, user.password)

        if (!valid) {
          const policy = await prisma.securityPolicy.findFirst()
          const maxAttempts = policy?.maxLoginAttempts ?? 5
          const lockoutMins = policy?.lockoutDurationMins ?? 15
          const newAttempts = (user.loginAttempts ?? 0) + 1
          const shouldLock = newAttempts >= maxAttempts

          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: newAttempts,
              status: shouldLock ? 'LOCKED' : undefined,
              lockedUntil: shouldLock
                ? new Date(Date.now() + lockoutMins * 60_000)
                : undefined,
            },
          })
          return null
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), loginAttempts: 0, lockedUntil: null, status: 'ACTIVE' },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role: Role }).role

        const now = new Date()
        const activeRoles = await prisma.userRole.findMany({
          where: {
            userId: user.id as string,
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          include: {
            customRole: {
              select: {
                submodules: true,
                permissions: { include: { permission: { select: { module: true } } } },
              },
            },
          },
        })

        if (activeRoles.length > 0 && !['SUPER_ADMIN', 'ADMIN'].includes(user.role as string)) {
          const modules = new Set<string>()
          const submodules: Record<string, string[]> = {}
          for (const ur of activeRoles) {
            for (const rp of ur.customRole.permissions) {
              modules.add(rp.permission.module)
            }
            if (ur.customRole.submodules && typeof ur.customRole.submodules === 'object') {
              const sm = ur.customRole.submodules as Record<string, string[]>
              for (const [mod, subs] of Object.entries(sm)) {
                submodules[mod] = [...(submodules[mod] ?? []), ...subs]
              }
            }
          }
          token.allowedModules = [...modules]
          token.allowedSubmodules = Object.keys(submodules).length > 0 ? submodules : null
        } else {
          token.allowedModules = null
          token.allowedSubmodules = null
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.allowedModules = (token.allowedModules as string[] | null) ?? null
        session.user.allowedSubmodules = (token.allowedSubmodules as Record<string, string[]> | null) ?? null
      }
      return session
    },
  },
})
