'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/lib/stores/app-store'
import { api } from '@/lib/api-client'
import { setAppCurrency } from '@/lib/currency-store'
import type { Role } from '@prisma/client'

type CompanyData = {
  name: string
  logo: string | null
  email: string | null
  address: string | null
  phone: string | null
  currency: string
  currencySymbol: string
}

export function AppStoreHydrator({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const hydrateSession = useAppStore((s) => s.hydrateSession)
  const setCompany = useAppStore((s) => s.setCompany)

  // Hydrate session into Zustand whenever it changes
  useEffect(() => {
    if (session?.user) {
      hydrateSession({
        id: session.user.id as string,
        name: session.user.name ?? '',
        email: session.user.email ?? '',
        role: (session.user as { role: Role }).role,
        allowedModules: (session.user as { allowedModules?: string[] | null }).allowedModules ?? null,
        allowedSubmodules: (session.user as { allowedSubmodules?: Record<string, string[]> | null }).allowedSubmodules ?? null,
      })
    }
  }, [session, hydrateSession])

  // Fetch company settings once and cache them in Zustand
  const { data: company } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get<CompanyData>('/api/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: !!session,
  })

  useEffect(() => {
    if (company) {
      setCompany({
        name: company.name,
        logo: company.logo,
        currency: company.currency,
        currencySymbol: company.currencySymbol,
      })
      if (company.currency) setAppCurrency(company.currency)
    }
  }, [company, setCompany])

  return <>{children}</>
}
