import { PrismaClient } from '@prisma/client'

export async function clearDatabase(prisma: PrismaClient): Promise<void> {
  console.log(' Clearing all data (dynamic TRUNCATE CASCADE)...')

  await prisma.$executeRawUnsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `)

  console.log(' All tables truncated, sequences reset.')
}
