export const MAGIC_BYTES: Record<string, ({ offset: number; bytes: Uint8Array })[]> = {
  'image/jpeg': [{ offset: 0, bytes: new Uint8Array([0xFF, 0xD8, 0xFF]) }],
  'image/png': [{ offset: 0, bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47]) }],
  'image/gif': [{ offset: 0, bytes: new Uint8Array([0x47, 0x49, 0x46, 0x38]) }],
  'image/webp': [
    { offset: 0, bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46]) },
    { offset: 8, bytes: new Uint8Array([0x57, 0x45, 0x42, 0x50]) },
  ],
}

export function validateMagicBytes(buffer: Uint8Array, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType]
  if (!signatures) return false
  return signatures.every(({ offset, bytes }) =>
    bytes.every((b, i) => buffer[offset + i] === b)
  )
}
