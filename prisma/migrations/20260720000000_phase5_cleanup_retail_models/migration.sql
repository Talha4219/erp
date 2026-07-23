-- Phase 5: Remove legacy retail sales models
-- Drops RetailSalesOrder, RetailSalesLineItem, ReturnRefund
-- Adds columns on SalesOrderItemV2 and SalesPayment

DROP TABLE IF EXISTS "ReturnRefund" CASCADE;
DROP TABLE IF EXISTS "RetailSalesLineItem" CASCADE;
DROP TABLE IF EXISTS "RetailSalesOrder" CASCADE;

ALTER TABLE "SalesOrderItemV2" ADD COLUMN IF NOT EXISTS "legacyRetailLineId" INTEGER;

ALTER TABLE "SalesPayment" ADD COLUMN IF NOT EXISTS "soItemId" TEXT;
ALTER TABLE "SalesPayment" ADD COLUMN IF NOT EXISTS "quantityReturned" INTEGER;

CREATE INDEX IF NOT EXISTS "SalesPayment_soItemId_idx" ON "SalesPayment"("soItemId");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesPayment_soItemId_fkey') THEN ALTER TABLE "SalesPayment" ADD CONSTRAINT "SalesPayment_soItemId_fkey" FOREIGN KEY ("soItemId") REFERENCES "SalesOrderItemV2"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
