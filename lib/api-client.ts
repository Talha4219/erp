type ApiOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

type ApiResult<T> = {
  success: boolean
  data: T | null
  error: string | null
}

export async function apiRequest<T>(url: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, params } = options

  let fullUrl = url
  if (params) {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) search.set(k, String(v))
    }
    fullUrl += `?${search.toString()}`
  }

  const res = await fetch(fullUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()
  return json as ApiResult<T>
}

export const api = {
  get: <T>(url: string, params?: ApiOptions['params']) =>
    apiRequest<T>(url, { method: 'GET', params }),
  post: <T>(url: string, body: unknown) =>
    apiRequest<T>(url, { method: 'POST', body }),
  put: <T>(url: string, body: unknown) =>
    apiRequest<T>(url, { method: 'PUT', body }),
  patch: <T>(url: string, body: unknown) =>
    apiRequest<T>(url, { method: 'PATCH', body }),
  delete: <T>(url: string) =>
    apiRequest<T>(url, { method: 'DELETE' }),
}
