-- Migration: Unify retail fields into core models
-- Phase 1: Add B2C fields to Customer, clean up dual references

BEGIN;

-- ── Step 1: Drop foreign keys to retail models ──
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_supplierId_fkey";
ALTER TABLE "InventoryBatch" DROP CONSTRAINT IF EXISTS "InventoryBatch_itemId_fkey";
ALTER TABLE "InventoryBatch" DROP CONSTRAINT IF EXISTS "InventoryBatch_productId_fkey";

-- ── Step 2: Drop indexes on retail-model fields ──
DROP INDEX IF EXISTS "Customer_legacyRetailId_key";
DROP INDEX IF EXISTS "InventoryBatch_productId_idx";
DROP INDEX IF EXISTS "Item_legacyRetailId_key";
DROP INDEX IF EXISTS "Vendor_legacyRetailId_key";

-- ── Step 3: Extend Customer with B2C retail fields ──
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "loyaltyPointsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "gdprConsentDate" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "dataRetentionConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "isAnonymised" BOOLEAN NOT NULL DEFAULT false;

-- ── Step 4: Data migration for InventoryBatch ──
-- 4a: Drop productId, change supplierId to TEXT
ALTER TABLE "InventoryBatch" DROP COLUMN IF EXISTS "productId";
ALTER TABLE "InventoryBatch" ALTER COLUMN "supplierId" TYPE TEXT USING "supplierId"::text;

-- 4b: Backfill supplierId from Vendor.legacyRetailId mapping
UPDATE "InventoryBatch" ib
SET "supplierId" = v."id"
FROM "Vendor" v
WHERE ib."supplierId" IS NOT NULL
  AND ib."supplierId" ~ '^\d+$'
  AND v."legacyRetailId" = ib."supplierId"::integer;

-- 4c: Delete orphaned InventoryBatch rows with no itemId
DELETE FROM "InventoryBatch" WHERE "itemId" IS NULL;

-- 4d: Make itemId required
ALTER TABLE "InventoryBatch" ALTER COLUMN "itemId" SET NOT NULL;

-- ── Step 5: Data migration for Expense ──
-- 5a: Add vendorId column
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- 5b: Backfill vendorId from Supplier → Vendor mapping
UPDATE "Expense" e
SET "vendorId" = v."id"
FROM "Vendor" v
WHERE e."supplierId" IS NOT NULL
  AND v."legacyRetailId" = e."supplierId";

-- 5c: Drop old supplierId
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "supplierId";

-- ── Step 6: Drop legacyRetailId columns (after data migration uses them) ──
ALTER TABLE "Customer" DROP COLUMN IF EXISTS "legacyRetailId";
ALTER TABLE "Item" DROP COLUMN IF EXISTS "legacyRetailId";
ALTER TABLE "Vendor" DROP COLUMN IF EXISTS "legacyRetailId";

-- ── Step 7: Create new indexes ──
CREATE INDEX IF NOT EXISTS "InventoryBatch_supplierId_idx" ON "InventoryBatch"("supplierId");

-- ── Step 8: Add new foreign keys ──
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
