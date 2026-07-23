'use client'

import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query'

export { dehydrate }

export function ServerHydrate({
  client,
  children,
}: {
  client: QueryClient
  children: React.ReactNode
}) {
  return (
    <HydrationBoundary state={dehydrate(client)}>
      {children}
    </HydrationBoundary>
  )
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  })
}
