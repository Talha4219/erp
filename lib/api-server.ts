import { cookies } from 'next/headers'

type ApiResult<T> = {
  success: boolean
  data: T | null
  error: string | null
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function apiServer<T>(
  path: string,
  options: { method?: string; body?: unknown; params?: Record<string, string | undefined> } = {},
): Promise<T> {
  const { method = 'GET', body, params } = options

  const cookieStore = await cookies()

  let url = `${BASE_URL}${path}`
  if (params) {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) search.set(k, v)
    }
    const qs = search.toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieStore.toString(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) throw new Error('Unauthorized — session expired or invalid')
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const text = await res.text()
    throw new Error(`Expected JSON from ${path}, got ${contentType}: ${text.slice(0, 200)}`)
  }

  const json: ApiResult<T> = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}
