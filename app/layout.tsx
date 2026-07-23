import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { WebVitalsReporter } from '@/components/providers/WebVitalsReporter'
import Providers from './providers'
import { prisma } from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  // Runs on every page load app-wide — never let a DB hiccup (e.g. a serverless
  // Postgres cold start) take down the whole app over a tab title.
  let settings: { name: string; logo: string | null } | null = null
  try {
    settings = await prisma.companySettings.findFirst({ select: { name: true, logo: true } })
  } catch {
    // fall through to defaults below
  }
  const name = settings?.name || 'ERP'
  return {
    title: { default: name, template: `%s | ${name}` },
    description: 'Enterprise Resource Planning System',
    icons: { icon: settings?.logo || '/favicon.ico' },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster richColors position="top-right" />
          <SpeedInsights />
          <WebVitalsReporter />
        </Providers>
      </body>
    </html>
  )
}
