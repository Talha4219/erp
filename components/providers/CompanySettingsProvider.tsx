'use client'

import { createContext, useContext, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { setAppCurrency } from '@/lib/currency-store'

type CompanyBranding = {
  name: string
  logo: string | null
  email: string | null
  address: string | null
  phone: string | null
  currency: string
  currencySymbol: string
}

const DEFAULTS: CompanyBranding = {
  name: 'ERP', logo: null, email: null, address: null, phone: null,
  currency: 'GBP', currencySymbol: '£',
}

const CompanySettingsContext = createContext<CompanyBranding>(DEFAULTS)

export function useCompanyBranding() {
  return useContext(CompanySettingsContext)
}

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['company-settings-branding'],
    queryFn: () => api.get<CompanyBranding>('/api/settings').then((r) => r.data),
    staleTime: 5 * 60_000,
  })

  useEffect(() => {
    if (data?.currency) setAppCurrency(data.currency)
  }, [data?.currency])

  const value: CompanyBranding = data ? { ...DEFAULTS, ...data } : DEFAULTS

  return (
    <CompanySettingsContext.Provider value={value}>
      {children}
    </CompanySettingsContext.Provider>
  )
}
