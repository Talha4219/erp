import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

export default async function globalSetup() {
  // Load .env.test if it exists (before any other imports)
  const envPath = path.resolve(process.cwd(), '.env.test')
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const value = trimmed.slice(eqIdx + 1).trim()
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }

  // Verify test database is accessible
  if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL } },
    })
    try {
      await prisma.$connect()
      console.log('Test DB connected')
    } finally {
      await prisma.$disconnect()
    }
  } else {
    console.warn('DATABASE_URL not set — integration tests will be skipped')
  }
}
