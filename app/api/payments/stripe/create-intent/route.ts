import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-middleware'
import { hasModuleAccess } from '@/lib/authz'
import { getStripe, stripeBreaker } from '@/lib/stripe'

export const POST = withAuth(async (req: NextRequest, { session }) => {
  if (!hasModuleAccess(session, 'pos')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { amount } = await req.json()

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 })
    }

    const rounded = Math.round(amount * 100) / 100
    const paymentIntent = await stripeBreaker.call(() =>
      getStripe().paymentIntents.create({
        amount: Math.round(rounded * 100),
        currency: 'gbp',
        payment_method_types: ['card'],
        metadata: {
          posUserId: session.user.id ?? '',
        },
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment intent'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
})
