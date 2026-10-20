import { z } from "zod";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { taxIdSchema } from "./common";

const optionalText = (max: number) => z.string().trim().max(max);

export const ibanSchema = z
  .string()
  .transform(normalizeIban)
  .refine((v) => v === "" || isValidIban(v), { error: "IBAN no válido (revisa el dígito de control)" });

const prefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,6}$/, { error: "De 1 a 6 letras o números" });

export const companyInputSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  name: z.string().trim().min(2, { error: "Introduce el nombre o razón social" }).max(200),
  taxId: taxIdSchema,
  address: optionalText(200),
  postalCode: z
    .string()
    .trim()
    .regex(/^(\d{5})?$/, { error: "Código postal de 5 dígitos" }),
  city: optionalText(100),
  email: z.union([z.literal(""), z.email({ error: "Email no válido" })]),
  iban: ibanSchema,
  invoicePrefix: prefix,
  quotePrefix: prefix,
  // Only used when creating: opens the main bank account with this balance.
  openingBalanceCents: z.int({ error: "Saldo no válido" }).min(-100_000_000).max(100_000_000).nullable(),
});

export type CompanyInput = z.input<typeof companyInputSchema>;
