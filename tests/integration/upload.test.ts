/**
 * Integration tests for File Upload API (POST /api/upload)
 *
 * Requires DATABASE_URL to point to a test database.
 * All tests are skipped when DATABASE_URL is not set.
 */

import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const TEST_DB_AVAILABLE = !!process.env.DATABASE_URL

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue(
    TEST_DB_AVAILABLE
      ? {
          user: { id: 'test-user-id', name: 'Test', email: 'test@erp.test', role: 'ADMIN' },
          expires: new Date(Date.now() + 3600_000).toISOString(),
        }
      : null,
  ),
}))

const prisma = TEST_DB_AVAILABLE ? new PrismaClient() : null

beforeAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.$connect()
})

afterAll(async () => {
  if (!TEST_DB_AVAILABLE || !prisma) return
  await prisma.uploadedFile.deleteMany({ where: { fileName: { startsWith: 'test-' } } })
  await prisma.$disconnect()
})

function makeUploadReq(body: FormData | string | null, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost:3000/api/upload', {
    method: 'POST',
    headers: { ...headers },
    body: body as any,
  })
}

const describeIntegration = TEST_DB_AVAILABLE ? describe : describe.skip

describeIntegration('POST /api/upload', () => {
  it('returns 400 when no file is provided', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const formData = new FormData()
    const req = makeUploadReq(formData)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No file/i)
  })

  it('returns 400 for disallowed mime type', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const formData = new FormData()
    const blob = new Blob(['fake-content'], { type: 'application/pdf' })
    formData.append('file', blob, 'test-file.pdf')
    const req = makeUploadReq(formData)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Only.*images allowed/i)
  })

  it('returns 400 for file content that does not match declared type', async () => {
    const { POST } = await import('@/app/api/upload/route')
    const formData = new FormData()
    const blob = new Blob(['not-an-image'], { type: 'image/png' })
    formData.append('file', blob, 'test-fake.png')
    const req = makeUploadReq(formData)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/does not match/i)
  })

  it('returns 401 when auth returns null', async () => {
    const { auth } = await import('@/lib/auth')
    ;(auth as jest.Mock).mockResolvedValueOnce(null)
    const { POST } = await import('@/app/api/upload/route')
    const req = makeUploadReq(null)
    const res = await POST(req)
    expect(res.status).toBe(401)
  })
})
