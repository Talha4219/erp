import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function nextDocNumber(
  module: string,
  companyId?: string | null,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear()

  const run = async (tx: Prisma.TransactionClient) => {
    const series = await tx.numberingSeries.findFirst({
      where: {
        module,
        isDefault: true,
        OR: [
          { companyId: companyId ?? null },
          { companyId: null },
        ],
      },
      orderBy: { companyId: 'desc' },
    })

    if (!series) {
      const prefix = module.replace(/_/g, '-').toUpperCase().slice(0, 4) + '-'
      try {
        await tx.numberingSeries.create({
          data: {
            module,
            prefix,
            companyId: companyId ?? null,
            isDefault: true,
            nextNumber: 2,
            padding: 5,
            resetAnnually: false,
          },
        })
        return `${prefix}${String(1).padStart(5, '0')}`
      } catch {
        const existing = await tx.numberingSeries.findFirst({
          where: { module, isDefault: true },
        })
        if (!existing) throw new Error(`Cannot resolve numbering series for module: ${module}`)
        const updated = await tx.numberingSeries.update({
          where: { id: existing.id },
          data: { nextNumber: { increment: 1 } },
        })
        const num = String(updated.nextNumber - 1).padStart(existing.padding, '0')
        const fiscalSuffix = existing.resetAnnually ? `-${year}` : ''
        return `${existing.prefix}${num}${fiscalSuffix}${existing.suffix ?? ''}`
      }
    }

    const updated = await tx.numberingSeries.update({
      where: { id: series.id },
      data: { nextNumber: { increment: 1 } },
    })

    const num = String(updated.nextNumber - 1).padStart(series.padding, '0')
    const fiscalSuffix = series.resetAnnually ? `-${year}` : ''
    const suffix = series.suffix ?? ''
    return `${series.prefix}${num}${fiscalSuffix}${suffix}`
  }

  if (tx) return run(tx)
  return prisma.$transaction(run, { isolationLevel: 'Serializable' })
}

export async function createDefaultSeries(
  module: string,
  prefix: string,
  companyId?: string | null
) {
  const existing = await prisma.numberingSeries.findFirst({ where: { module, companyId: companyId ?? null, isDefault: true } })
  if (existing) return existing
  return prisma.numberingSeries.create({
    data: { module, prefix, companyId, isDefault: true, nextNumber: 1, padding: 5 },
  })
}
