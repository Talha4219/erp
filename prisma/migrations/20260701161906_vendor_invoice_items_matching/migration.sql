-- CreateEnum
CREATE TYPE "MatchingStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCH');

-- AlterTable
ALTER TABLE "VendorInvoice" ADD COLUMN     "approvalComments" TEXT,
ADD COLUMN     "costCentreId" TEXT,
ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "discountAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeRate" DECIMAL(15,6) DEFAULT 1,
ADD COLUMN     "financeNotes" TEXT,
ADD COLUMN     "matchingStatus" "MatchingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "shippingCharges" DECIMAL(15,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "VendorInvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(15,3) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalPrice" DECIMAL(15,2) NOT NULL,
    "glAccountId" TEXT,
    "warehouseId" TEXT,
    "costCentreId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "VendorInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VendorInvoiceItem_invoiceId_idx" ON "VendorInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "VendorInvoice_departmentId_idx" ON "VendorInvoice"("departmentId");

-- CreateIndex
CREATE INDEX "VendorInvoice_matchingStatus_idx" ON "VendorInvoice"("matchingStatus");

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoice" ADD CONSTRAINT "VendorInvoice_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "VendorInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorInvoiceItem" ADD CONSTRAINT "VendorInvoiceItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

