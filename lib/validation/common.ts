import { z } from "zod";

// Strips spaces, dots and dashes so "b-12.345.678" and "B12345678" are the same NIF.
export const taxIdSchema = z
  .string()
  .transform((s) => s.replace(/[\s.-]/g, "").toUpperCase())
  .pipe(z.string().regex(/^[0-9A-Z]{5,14}$/, { error: "Introduce un NIF o NIF-IVA válido" }));

// Maps issues to "client.taxId" / "lines.0.quantity" style keys the forms look up.
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    errors[issue.path.join(".")] ??= issue.message;
  }
  return errors;
}
