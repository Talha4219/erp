import { validateMagicBytes } from '@/lib/magic-bytes'

function uint8(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes)
}

describe('validateMagicBytes', () => {
  it('accepts valid JPEG', () => {
    expect(validateMagicBytes(uint8(0xFF, 0xD8, 0xFF), 'image/jpeg')).toBe(true)
  })

  it('rejects invalid JPEG', () => {
    expect(validateMagicBytes(uint8(0x00, 0x00, 0x00), 'image/jpeg')).toBe(false)
  })

  it('accepts valid PNG', () => {
    expect(validateMagicBytes(uint8(0x89, 0x50, 0x4E, 0x47), 'image/png')).toBe(true)
  })

  it('rejects invalid PNG', () => {
    expect(validateMagicBytes(uint8(0x00, 0x00, 0x00, 0x00), 'image/png')).toBe(false)
  })

  it('accepts valid GIF', () => {
    expect(validateMagicBytes(uint8(0x47, 0x49, 0x46, 0x38), 'image/gif')).toBe(true)
  })

  it('rejects invalid GIF', () => {
    expect(validateMagicBytes(uint8(0x00, 0x00, 0x00, 0x00), 'image/gif')).toBe(false)
  })

  describe('WebP', () => {
    const RIFF_HEADER = uint8(0x52, 0x49, 0x46, 0x46)
    const WEBP_CHUNK = uint8(0x57, 0x45, 0x42, 0x50)

    function webpBuffer(fileSize: number): Uint8Array {
      const buf = new Uint8Array(12)
      buf.set(RIFF_HEADER, 0)
      // file size (little-endian) at offset 4
      buf[4] = fileSize & 0xFF
      buf[5] = (fileSize >> 8) & 0xFF
      buf[6] = (fileSize >> 16) & 0xFF
      buf[7] = (fileSize >> 24) & 0xFF
      buf.set(WEBP_CHUNK, 8)
      return buf
    }

    it('accepts valid WebP with RIFF + WEBP', () => {
      expect(validateMagicBytes(webpBuffer(100), 'image/webp')).toBe(true)
    })

    it('rejects WebP with only RIFF header (no WEBP chunk)', () => {
      const buf = new Uint8Array(12)
      buf.set(RIFF_HEADER, 0)
      buf.set(uint8(0x00, 0x00, 0x00, 0x00), 8)
      expect(validateMagicBytes(buf, 'image/webp')).toBe(false)
    })

    it('rejects WebP with WEBP chunk at wrong offset', () => {
      const buf = new Uint8Array(16)
      buf.set(RIFF_HEADER, 0)
      buf.set(WEBP_CHUNK, 12) // WEBP at offset 12 instead of 8
      expect(validateMagicBytes(buf, 'image/webp')).toBe(false)
    })

    it('rejects buffer that is too short for WebP', () => {
      expect(validateMagicBytes(uint8(0x52, 0x49, 0x46, 0x46), 'image/webp')).toBe(false)
    })
  })

  it('returns false for unknown mime type', () => {
    expect(validateMagicBytes(uint8(0xFF, 0xD8, 0xFF), 'image/bmp')).toBe(false)
  })

  it('returns false for empty buffer', () => {
    expect(validateMagicBytes(new Uint8Array(0), 'image/jpeg')).toBe(false)
  })
})
