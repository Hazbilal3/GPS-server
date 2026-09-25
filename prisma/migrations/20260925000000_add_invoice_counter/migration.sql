CREATE TABLE "InvoiceCounter" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "lastNum" INTEGER NOT NULL DEFAULT 6256,
  CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

-- Seed with the current max invoice number so we never reuse a number
INSERT INTO "InvoiceCounter" ("id", "lastNum")
SELECT 1, COALESCE(MAX(CAST("invoiceNumber" AS INTEGER)), 6256)
FROM "FreightLoad"
WHERE "invoiceNumber" IS NOT NULL AND "invoiceNumber" ~ '^\d+$'
ON CONFLICT ("id") DO NOTHING;
