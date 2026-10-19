import { z } from "zod";
import { normalizeTaxId } from "@/lib/tax-id";

export const taxIdSchema = z
  .string()
  .transform(normalizeTaxId)
  .pipe(z.string().regex(/^[0-9A-Z]{5,14}$/, { error: "Introduce un NIF o NIF-IVA válido" }));

// Maps issues to "client.taxId" / "lines.0.quantity" style keys the forms look up.
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".")] ??= issue.message;
  }
  return errors;
}
