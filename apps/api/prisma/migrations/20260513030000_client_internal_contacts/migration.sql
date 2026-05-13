-- CreateEnum
CREATE TYPE "client_internal_contact_role" AS ENUM (
  'kam',
  'asst_kam',
  'lifting_coordinator',
  'catalog_ops'
);

-- CreateTable
CREATE TABLE "client_internal_contacts" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "client_internal_contact_role" NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_internal_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_internal_contacts_client_role_unique"
    ON "client_internal_contacts"("client_id", "role");

-- CreateIndex
CREATE INDEX "client_internal_contacts_user_idx" ON "client_internal_contacts"("user_id");

-- AddForeignKey
ALTER TABLE "client_internal_contacts" ADD CONSTRAINT "client_internal_contacts_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_internal_contacts" ADD CONSTRAINT "client_internal_contacts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
