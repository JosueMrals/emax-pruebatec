import { z } from "zod";
import { isEuCountry, isEuVatNumber } from "@/lib/fiscal/operations";
import { VAT_RATES } from "@/lib/fiscal/totals";
import { taxIdSchema } from "./common";

const newClient = z
  .object({
    mode: z.literal("new"),
    name: z.string().trim().min(2, { error: "Introduce el nombre del cliente" }).max(200),
    taxId: taxIdSchema,
    countryCode: z.string().refine(isEuCountry, { error: "Elige un país de la UE" }),
    email: z.union([z.literal(""), z.email({ error: "Email no válido" })]),
  })
  .refine((c) => c.countryCode === "ES" || isEuVatNumber(c.taxId, c.countryCode), {
    path: ["taxId"],
    error: "Para clientes de otro país de la UE usa el NIF-IVA con el prefijo del país (ej. DE123456789)",
  });

const existingClient = z.object({
  mode: z.literal("existing"),
  id: z.uuid({ error: "Elige un cliente" }),
});

const salesClient = z.discriminatedUnion("mode", [existingClient, newClient]);
export type SalesClientInput = z.infer<typeof salesClient>;

const line = z.object({
  description: z.string().trim().min(1, { error: "Describe el concepto" }).max(500),
  quantity: z.int({ error: "Cantidad entera" }).min(1, { error: "Mínimo 1" }).max(10_000),
  unitPriceCents: z.int({ error: "Precio no válido" }).min(0).max(100_000_000, { error: "Máximo 1.000.000 €" }),
  vatRate: z.literal(VAT_RATES, { error: "Tipo de IVA no válido" }),
});

export const invoiceInputSchema = z.object({
  client: salesClient,
  issueDate: z.iso.date({ error: "Fecha no válida" }),
  lines: z.array(line).min(1, { error: "Añade al menos una línea" }).max(50),
  notes: z.string().trim().max(1000),
});

export const quoteInputSchema = invoiceInputSchema
  .extend({ validUntil: z.union([z.literal(""), z.iso.date({ error: "Fecha no válida" })]) })
  .refine((q) => !q.validUntil || q.validUntil >= q.issueDate, {
    path: ["validUntil"],
    error: "La validez no puede ser anterior a la fecha del presupuesto",
  });
