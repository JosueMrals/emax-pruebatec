import { z } from "zod";
import { IRPF_RATES } from "@/lib/fiscal/expenses";
import { VAT_RATES } from "@/lib/fiscal/totals";
import { taxIdSchema } from "./common";

// Only Spanish suppliers: EU purchases need self-assessed VAT, which is out of scope.
const newSupplier = z.object({
  mode: z.literal("new"),
  name: z.string().trim().min(2, { error: "Introduce el nombre del proveedor" }).max(200),
  taxId: taxIdSchema,
});

const existingSupplier = z.object({
  mode: z.literal("existing"),
  id: z.uuid({ error: "Elige un proveedor" }),
});

export const expenseInputSchema = z.object({
  supplier: z.discriminatedUnion("mode", [existingSupplier, newSupplier]),
  date: z.iso.date({ error: "Fecha no válida" }),
  number: z.string().trim().max(50),
  description: z.string().trim().min(1, { error: "Describe el gasto" }).max(500),
  baseCents: z
    .int({ error: "Importe no válido" })
    .min(1, { error: "La base debe ser mayor que 0" })
    .max(100_000_000, { error: "Máximo 1.000.000 €" }),
  vatRate: z.literal(VAT_RATES, { error: "Tipo de IVA no válido" }),
  irpfRate: z.literal(IRPF_RATES, { error: "Tipo de IRPF no válido" }),
  deductible: z.boolean({ error: "Valor no válido" }),
  source: z.enum(["MANUAL", "OCR"], { error: "Origen no válido" }),
});
