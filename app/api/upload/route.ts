import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Magic byte signatures for image verification
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  'image/jpeg': [new Uint8Array([0xFF, 0xD8, 0xFF])],
  'image/png': [new Uint8Array([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
  'image/webp': [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
}

function validateMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) return false
  return signatures.some((sig) => sig.every((b, i) => buffer[i] === b))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, error: 'Only JPEG, PNG, WebP, or GIF images allowed' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'File too large (max 5 MB)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (!validateMagicBytes(new Uint8Array(buffer), file.type)) {
    return NextResponse.json({ success: false, error: 'File content does not match its declared type' }, { status: 400 })
  }

  const uploaded = await prisma.uploadedFile.create({
    data: { fileName: file.name, mimeType: file.type, size: file.size, data: buffer },
  })

  return NextResponse.json({ success: true, data: { url: `/api/uploads/${uploaded.id}` } })
}
