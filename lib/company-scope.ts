import prisma from '@/lib/prisma'

// Returns the companyId scope for a given user, or null if no default company set.
// API routes can use this to add company-level data isolation.
export async function getUserCompanyId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultCompanyId: true },
  })
  return user?.defaultCompanyId ?? null
}

// Build a Prisma where clause fragment that scopes by companyId when one is set.
// Usage: where: { ...companyScope(companyId), ...otherFilters }
export function companyScope(companyId: string | null): { companyId?: string } {
  return companyId ? { companyId } : {}
}
