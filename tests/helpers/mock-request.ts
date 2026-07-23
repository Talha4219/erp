import { NextRequest } from 'next/server'

/** Build a NextRequest for testing route handlers directly */
export function mockRequest(
  method: string,
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`
  return new NextRequest(fullUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** Extract JSON body from a NextResponse */
export async function json<T = unknown>(res: Response): Promise<T> {
  return res.json() as Promise<T>
}
