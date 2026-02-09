-- CreateEnum
CREATE TYPE "modifier_type" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "group_requirement" AS ENUM ('REQUIRED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "option_groups" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requirement" "group_requirement" NOT NULL DEFAULT 'OPTIONAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_choices" (
    "id" TEXT NOT NULL,
    "option_group_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "modifier_type" "modifier_type" NOT NULL,
    "modifier_value" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "option_choices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_option_groups" (
    "id" SERIAL NOT NULL,
    "product_id" TEXT NOT NULL,
    "option_group_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "option_groups_store_id_idx" ON "option_groups"("store_id");

-- CreateIndex
CREATE INDEX "option_choices_option_group_id_idx" ON "option_choices"("option_group_id");

-- CreateIndex
CREATE INDEX "product_option_groups_product_id_idx" ON "product_option_groups"("product_id");

-- CreateIndex
CREATE INDEX "product_option_groups_option_group_id_idx" ON "product_option_groups"("option_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_option_groups_product_id_option_group_id_key" ON "product_option_groups"("product_id", "option_group_id");

-- AddForeignKey
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_choices" ADD CONSTRAINT "option_choices_option_group_id_fkey" FOREIGN KEY ("option_group_id") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product_matrices"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_option_groups" ADD CONSTRAINT "product_option_groups_option_group_id_fkey" FOREIGN KEY ("option_group_id") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

