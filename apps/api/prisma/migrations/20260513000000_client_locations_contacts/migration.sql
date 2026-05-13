-- CreateTable
CREATE TABLE "client_locations" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address_line" VARCHAR(255),
    "city" VARCHAR(80) NOT NULL,
    "state" VARCHAR(80) NOT NULL,
    "pincode" VARCHAR(15) NOT NULL,
    "country" VARCHAR(64) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_locations_client_idx" ON "client_locations"("client_id");

-- Enforce at most one primary location per client (partial unique index).
CREATE UNIQUE INDEX "client_locations_one_primary_per_client"
    ON "client_locations"("client_id") WHERE "is_primary" = true;

-- AddForeignKey
ALTER TABLE "client_locations" ADD CONSTRAINT "client_locations_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "client_contact_points" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" VARCHAR(120),
    "email" VARCHAR(255),
    "phone" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contact_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contact_points_location_idx" ON "client_contact_points"("location_id");

-- AddForeignKey
ALTER TABLE "client_contact_points" ADD CONSTRAINT "client_contact_points_location_id_fkey"
    FOREIGN KEY ("location_id") REFERENCES "client_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
