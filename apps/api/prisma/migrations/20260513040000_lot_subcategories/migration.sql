-- CreateTable
CREATE TABLE "lot_subcategories" (
    "lot_id" UUID NOT NULL,
    "subcategory_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_subcategories_pkey" PRIMARY KEY ("lot_id", "subcategory_id")
);

-- CreateIndex
CREATE INDEX "lot_subcategories_subcategory_idx" ON "lot_subcategories"("subcategory_id");

-- AddForeignKey
ALTER TABLE "lot_subcategories" ADD CONSTRAINT "lot_subcategories_lot_id_fkey"
    FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_subcategories" ADD CONSTRAINT "lot_subcategories_subcategory_id_fkey"
    FOREIGN KEY ("subcategory_id") REFERENCES "subcategories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
