-- Repair drift: the schema links RetailSalesLineItem to inventory Item (POS sells
-- Items directly; Product/batch lines are legacy), but no migration ever applied it.
-- Made idempotent with IF EXISTS checks for shadow-database compatibility.

-- DropForeignKey
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_itemId_fkey') THEN ALTER TABLE "Product" DROP CONSTRAINT "Product_itemId_fkey"; END IF; END $$;

-- DropForeignKey
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailSalesLineItem_batchId_fkey') THEN ALTER TABLE "RetailSalesLineItem" DROP CONSTRAINT "RetailSalesLineItem_batchId_fkey"; END IF; END $$;

-- DropForeignKey
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailSalesLineItem_productId_fkey') THEN ALTER TABLE "RetailSalesLineItem" DROP CONSTRAINT "RetailSalesLineItem_productId_fkey"; END IF; END $$;

-- DropIndex
DROP INDEX IF EXISTS "Product_itemId_key";

-- AlterTable: remove abandoned Product→Item link (verified empty before dropping)
ALTER TABLE "Product" DROP COLUMN IF EXISTS "itemId";

-- AlterTable: POS lines reference Item; product/batch become optional legacy fields
ALTER TABLE "RetailSalesLineItem" ADD COLUMN IF NOT EXISTS "itemId" TEXT,
ALTER COLUMN "productId" DROP NOT NULL,
ALTER COLUMN "batchId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailSalesLineItem_itemId_idx" ON "RetailSalesLineItem"("itemId");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailSalesLineItem_itemId_fkey') THEN ALTER TABLE "RetailSalesLineItem" ADD CONSTRAINT "RetailSalesLineItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailSalesLineItem_productId_fkey') THEN ALTER TABLE "RetailSalesLineItem" ADD CONSTRAINT "RetailSalesLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RetailSalesLineItem_batchId_fkey') THEN ALTER TABLE "RetailSalesLineItem" ADD CONSTRAINT "RetailSalesLineItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
