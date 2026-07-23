import { NextRequest, NextResponse } from 'next/server'
import { hasModuleAccess } from '@/lib/authz'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

export const POST = withAuth<{ params: Promise<{ id: string }> }>(async (req: NextRequest, { params, session }) => {
  if (!hasModuleAccess(session, 'finance')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  try {
    const { period } = await req.json() // e.g. "2024-06"
    const asset = await prisma.fixedAsset.findUniqueOrThrow({ where: { id: (await params).id } })

    if (asset.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'Asset is not active' }, { status: 400 })
    }

    const existing = await prisma.assetDepreciation.findUnique({ where: { assetId_period: { assetId: (await params).id, period } } })
    if (existing) {
      return NextResponse.json({ success: false, error: `Already depreciated for ${period}` }, { status: 409 })
    }

    const purchaseCost = Number(asset.purchaseCost)
    const residualValue = Number(asset.residualValue)
    const accDepn = Number(asset.accumulatedDepreciation)
    const bookValue = Number(asset.bookValue)

    let monthlyDepn = 0
    if (asset.depreciationMethod === 'STRAIGHT_LINE') {
      const depreciableAmount = purchaseCost - residualValue
      monthlyDepn = depreciableAmount / (asset.usefulLifeYears * 12)
    } else {
      // Declining balance: annual rate = 1 - (residual/cost)^(1/years), monthly = bookValue * rate / 12
      const annualRate = 1 - Math.pow(residualValue / purchaseCost, 1 / asset.usefulLifeYears)
      monthlyDepn = (bookValue * annualRate) / 12
    }

    const maxDepn = Math.max(0, bookValue - residualValue)
    const depnAmount = Math.min(monthlyDepn, maxDepn)
    const r2 = (n: number) => Math.round(n * 100) / 100
    const newAccDepn = r2(accDepn + depnAmount)
    const newBookValue = r2(purchaseCost - newAccDepn)
    const isFullyDepreciated = newBookValue <= residualValue

    const result = await prisma.$transaction(async (tx) => {
      const depn = await tx.assetDepreciation.create({
        data: { assetId: (await params).id, period, amount: r2(depnAmount) },
      })
      await tx.fixedAsset.update({
        where: { id: (await params).id },
        data: {
          accumulatedDepreciation: newAccDepn,
          bookValue: newBookValue,
          status: isFullyDepreciated ? 'FULLY_DEPRECIATED' : 'ACTIVE',
        },
      })
      return depn
    })

    return NextResponse.json({ success: true, data: result, bookValue: newBookValue })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
})
