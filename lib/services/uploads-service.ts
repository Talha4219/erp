import { prisma } from '@/lib/prisma'

export async function saveUploadedFile(fileName: string, mimeType: string, size: number, data: Buffer) {
  return prisma.uploadedFile.create({ data: { fileName, mimeType, size, data } })
}

export async function getUploadedFile(id: string) {
  return prisma.uploadedFile.findUnique({ where: { id } })
}
