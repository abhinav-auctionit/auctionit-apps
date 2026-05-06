-- CreateTable
CREATE TABLE "stored_files" (
    "id" UUID NOT NULL,
    "key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(512) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_key_key" ON "stored_files"("key");

-- CreateIndex
CREATE INDEX "stored_files_uploader_idx" ON "stored_files"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
