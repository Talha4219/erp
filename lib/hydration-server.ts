import { QueryClient } from '@tanstack/react-query'
import { dehydrate } from '@tanstack/react-query'
import { apiServer } from './api-server'

export type DehydratedState = ReturnType<typeof dehydrate>

export async function prefetchAndHydrate<T>(
  queryKey: string[],
  apiEndpoint: string,
  params?: Record<string, string | undefined>,
): Promise<{ dehydratedState: DehydratedState; data: T }> {
  const qc = new QueryClient()

  const data = await apiServer<T>(apiEndpoint, { params })

  qc.setQueryData(queryKey, data)

  return { dehydratedState: dehydrate(qc), data }
}

export async function prefetchMultiple<T extends Record<string, unknown>>(
  fetches: { queryKey: string[]; apiEndpoint: string; params?: Record<string, string | undefined> }[],
): Promise<{ dehydratedState: DehydratedState }> {
  const qc = new QueryClient()

  await Promise.all(
    fetches.map(async ({ queryKey, apiEndpoint, params }) => {
      const data = await apiServer<T>(apiEndpoint, { params })
      qc.setQueryData(queryKey, data)
    }),
  )

  return { dehydratedState: dehydrate(qc) }
}
