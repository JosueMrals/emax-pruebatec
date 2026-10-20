import { z } from "zod";
import { isEuCountry, isEuVatNumber } from "@/lib/fiscal/operations";
import { taxIdSchema } from "./common";

const text = (max: number) => z.string().trim().max(max);

export const contactInputSchema = z
  .object({
    kind: z.enum(["client", "supplier"]),
    id: z.union([z.literal(""), z.uuid()]),
    name: z.string().trim().min(2, { error: "Introduce el nombre o razón social" }).max(200),
    taxId: taxIdSchema,
    countryCode: z.string().refine(isEuCountry, { error: "Elige un país de la UE" }),
    email: z.union([z.literal(""), z.email({ error: "Email no válido" })]),
    phone: z
      .string()
      .trim()
      .regex(/^[+\d\s().-]{0,20}$/, { error: "Teléfono no válido" }),
    address: text(200),
    postalCode: text(10),
    city: text(100),
    notes: text(1000),
  })
  // Same rules as invoices and expenses: EU clients need a VAT number; suppliers are Spanish only.
  .refine((c) => c.kind === "client" || c.countryCode === "ES", {
    path: ["countryCode"],
    error: "Los proveedores de otros países aún no están soportados",
  })
  .refine((c) => c.countryCode === "ES" || isEuVatNumber(c.taxId, c.countryCode), {
    path: ["taxId"],
    error: "Para otros países de la UE usa el NIF-IVA con el prefijo del país (ej. DE123456789)",
  });

export type ContactInput = z.input<typeof contactInputSchema>;
