const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const

export function validateEnv() {
  const missing: string[] = []

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  ${missing.join('\n  ')}\n\n` +
        'Set them in .env or your deployment environment before starting the app.'
    )
  }

  if (process.env.NODE_ENV === 'production') {
    const warns: string[] = []

    if (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) {
      warns.push('NEXTAUTH_SECRET is too short (minimum 32 characters)')
    }

    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
      warns.push('STRIPE_SECRET_KEY does not look like a valid Stripe secret key (should start with sk_)')
    }

    if (process.env.STRIPE_WEBHOOK_SECRET && !process.env.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
      warns.push('STRIPE_WEBHOOK_SECRET does not look like a valid Stripe webhook secret (should start with whsec_)')
    }

    if (warns.length > 0) {
      console.warn('[env] Warnings:\n  ' + warns.join('\n  '))
    }
  }
}
