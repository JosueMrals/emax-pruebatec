-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('NACIONAL', 'INTRA_SERVICIOS');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'OCR');

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'ES',
    "email" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'ES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "operationType" "OperationType" NOT NULL DEFAULT 'NACIONAL',
    "clientId" UUID NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" UUID NOT NULL,
    "number" TEXT,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "supplierId" UUID NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "irpfRate" INTEGER NOT NULL DEFAULT 0,
    "irpfCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "deductible" BOOLEAN NOT NULL DEFAULT true,
    "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_taxId_key" ON "Client"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_taxId_key" ON "Supplier"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase exposes the public schema through its Data API with the publishable key.
-- Enable RLS without policies so only the server (Prisma, table owner) can read or write.
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
