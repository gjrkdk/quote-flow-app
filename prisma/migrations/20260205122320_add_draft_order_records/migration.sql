-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "totalDraftOrdersCreated" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DraftOrderRecord" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "matrixId" TEXT NOT NULL,
    "shopifyDraftOrderId" TEXT NOT NULL,
    "shopifyOrderName" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "calculatedPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftOrderRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftOrderRecord_storeId_idx" ON "DraftOrderRecord"("storeId");

-- CreateIndex
CREATE INDEX "DraftOrderRecord_matrixId_idx" ON "DraftOrderRecord"("matrixId");

-- CreateIndex
CREATE INDEX "DraftOrderRecord_shopifyDraftOrderId_idx" ON "DraftOrderRecord"("shopifyDraftOrderId");

-- AddForeignKey
ALTER TABLE "DraftOrderRecord" ADD CONSTRAINT "DraftOrderRecord_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrderRecord" ADD CONSTRAINT "DraftOrderRecord_matrixId_fkey" FOREIGN KEY ("matrixId") REFERENCES "PriceMatrix"("id") ON DELETE CASCADE ON UPDATE CASCADE;
