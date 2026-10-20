-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('BORRADOR', 'ENVIADO', 'ACEPTADO', 'RECHAZADO', 'FACTURADO');

-- DropIndex
DROP INDEX "Client_taxId_key";

-- DropIndex
DROP INDEX "Expense_date_idx";

-- DropIndex
DROP INDEX "Invoice_issueDate_idx";

-- DropIndex
DROP INDEX "Invoice_number_key";

-- DropIndex
DROP INDEX "Supplier_taxId_key";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyId" UUID,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "companyId" UUID;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "companyId" UUID,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "postalCode" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "email" TEXT,
    "iban" TEXT,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'F',
    "quotePrefix" TEXT NOT NULL DEFAULT 'P',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "validUntil" DATE,
    "operationType" "OperationType" NOT NULL DEFAULT 'NACIONAL',
    "clientId" UUID NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'BORRADOR',
    "notes" TEXT,
    "invoiceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" UUID NOT NULL,
    "quoteId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "iban" TEXT,
    "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankMovement" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "importHash" TEXT,
    "invoiceId" UUID,
    "expenseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankMovement_pkey" PRIMARY KEY ("id")
);

-- Backfill: rows created before multi-company belong to a default company.
DO $$
DECLARE default_company UUID := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM "Client") OR EXISTS (SELECT 1 FROM "Supplier")
     OR EXISTS (SELECT 1 FROM "Invoice") OR EXISTS (SELECT 1 FROM "Expense") THEN
    INSERT INTO "Company" ("id", "name", "taxId") VALUES (default_company, 'Mi empresa', 'B00000000');
    UPDATE "Client" SET "companyId" = default_company;
    UPDATE "Supplier" SET "companyId" = default_company;
    UPDATE "Invoice" SET "companyId" = default_company;
    UPDATE "Expense" SET "companyId" = default_company;
  END IF;
END $$;

ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Quote_invoiceId_key" ON "Quote"("invoiceId");

-- CreateIndex
CREATE INDEX "Quote_companyId_issueDate_idx" ON "Quote"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "Quote_clientId_idx" ON "Quote"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_companyId_number_key" ON "Quote"("companyId", "number");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "BankAccount_companyId_idx" ON "BankAccount"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "BankMovement_invoiceId_key" ON "BankMovement"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "BankMovement_expenseId_key" ON "BankMovement"("expenseId");

-- CreateIndex
CREATE INDEX "BankMovement_accountId_date_idx" ON "BankMovement"("accountId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BankMovement_accountId_importHash_key" ON "BankMovement"("accountId", "importHash");

-- CreateIndex
CREATE UNIQUE INDEX "Client_companyId_taxId_key" ON "Client"("companyId", "taxId");

-- CreateIndex
CREATE INDEX "Expense_companyId_date_idx" ON "Expense"("companyId", "date");

-- CreateIndex
CREATE INDEX "Invoice_companyId_issueDate_idx" ON "Invoice"("companyId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "Invoice"("companyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_companyId_taxId_key" ON "Supplier"("companyId", "taxId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankMovement" ADD CONSTRAINT "BankMovement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same policy as the init migration: no Data API access with the publishable key.
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuoteLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BankMovement" ENABLE ROW LEVEL SECURITY;
