import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export const POST = async (req: NextRequest) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json({ success: false, error: 'Webhook secret not configured' }, { status: 500 })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ success: false, error: 'Missing stripe-signature header' }, { status: 400 })
    }

    const event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        if (pi.metadata?.posOrderId) {
          const orderId = pi.metadata.posOrderId
          await prisma.salesOrderV2.update({
            where: { id: orderId },
            data: { stripePaymentStatus: 'succeeded' },
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        if (pi.metadata?.posOrderId) {
          const orderId = pi.metadata.posOrderId
          await prisma.salesOrderV2.update({
            where: { id: orderId },
            data: { stripePaymentStatus: 'failed' },
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
