-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDIENTE', 'COBRADA');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDIENTE';
