import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Server-Sent Events stream for real-time dashboard updates
export async function GET() {
  const session = await auth()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  let interval: ReturnType<typeof setInterval> | undefined
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(payload))
      }

      const stop = () => {
        clearInterval(interval)
        if (!closed) {
          closed = true
          try { controller.close() } catch { /* already closed by disconnect */ }
        }
      }

      // Send initial snapshot
      try {
        const snapshot = await getDashboardSnapshot()
        send('snapshot', snapshot)
      } catch { /* best-effort */ }

      // Heartbeat + delta updates every 15s
      interval = setInterval(async () => {
        try {
          send('heartbeat', { ts: Date.now() })
          const delta = await getDashboardSnapshot()
          send('update', delta)
        } catch {
          // enqueue throws once the client is gone — stop and close exactly once
          stop()
        }
      }, 15_000)
    },
    cancel() {
      // Client disconnected — the controller is closed by the runtime, just stop the timer
      closed = true
      clearInterval(interval)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function getDashboardSnapshot() {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [revenueToday, arOutstanding, pendingApprovals, openSO] = await Promise.all([
    prisma.customerPayment.aggregate({
      where: { paymentDate: { gte: todayStart } },
      _sum: { amount: true },
    }),
    prisma.customerInvoice.aggregate({
      where: { status: { notIn: ['PAID', 'CANCELLED'] }, deletedAt: null },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.workflowInstance.count({ where: { status: 'PENDING' } }),
    prisma.salesOrder.count({
      where: { status: { notIn: ['DELIVERED', 'CANCELLED'] }, deletedAt: null },
    }),
  ])

  // Simple low-stock count based on warehouseStock quantities
  const lowStock = await prisma.warehouseStock.count({
    where: { quantity: { lte: 0 } },
  }).catch(() => 0)

  const arBalance =
    Number(arOutstanding._sum.totalAmount ?? 0) -
    Number(arOutstanding._sum.paidAmount ?? 0)

  return {
    ts: now.toISOString(),
    revenueToday: Number(revenueToday._sum.amount ?? 0),
    arOutstanding: arBalance,
    pendingApprovals,
    lowStockAlerts: lowStock,
    openSalesOrders: openSO,
  }

}
