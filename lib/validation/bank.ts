import { z } from "zod";
import { ibanSchema } from "./company";

export const bankAccountInputSchema = z.object({
  name: z.string().trim().min(2, { error: "Pon un nombre a la cuenta" }).max(100),
  iban: ibanSchema,
  openingBalanceCents: z.int({ error: "Saldo no válido" }).min(-100_000_000).max(100_000_000),
});

export const movementInputSchema = z.object({
  accountId: z.uuid({ error: "Elige una cuenta" }),
  date: z.iso.date({ error: "Fecha no válida" }),
  description: z.string().trim().min(1, { error: "Escribe el concepto" }).max(500),
  amountCents: z
    .int({ error: "Importe no válido" })
    .min(-100_000_000)
    .max(100_000_000)
    .refine((v) => v !== 0, { error: "El importe no puede ser 0" }),
});

export const reconcileInputSchema = z.object({
  movementId: z.uuid(),
  target: z.string().regex(/^(invoice|expense):[0-9a-f-]{36}$/i),
});
