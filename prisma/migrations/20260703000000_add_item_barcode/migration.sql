-- Add barcode support to Item (POS scanning, GRN receiving, stock counts)
ALTER TABLE "Item" ADD COLUMN "barcode" TEXT;
ALTER TABLE "Item" ADD COLUMN "barcodeType" TEXT NOT NULL DEFAULT 'CODE128';
ALTER TABLE "Item" ADD COLUMN "secondaryBarcode" TEXT;

-- One barcode = one product
CREATE UNIQUE INDEX "Item_barcode_key" ON "Item"("barcode");
