-- CreateTable
CREATE TABLE "CustomerRating" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ratedByName" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "paymentScore" INTEGER NOT NULL,
    "businessScore" INTEGER NOT NULL,
    "relationshipScore" INTEGER NOT NULL,
    "notes" TEXT,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerRating_customerId_idx" ON "CustomerRating"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerRating" ADD CONSTRAINT "CustomerRating_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

