"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, isUniqueViolation } from "@/lib/action-errors";
import { getActiveCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { fieldErrorsFrom } from "@/lib/validation/common";
import { contactInputSchema } from "@/lib/validation/contact";

const NO_COMPANY: ActionResult = { error: "Configura tu empresa antes de continuar." };
const PATH = { client: "clientes", supplier: "proveedores" } as const;

export async function saveContact(input: unknown): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = contactInputSchema.safeParse(input);
  if (!parsed.success) return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };

  const { kind, id, ...fields } = parsed.data;
  const data = {
    ...fields,
    email: fields.email || null,
    phone: fields.phone || null,
    address: fields.address || null,
    postalCode: fields.postalCode || null,
    city: fields.city || null,
    notes: fields.notes || null,
  };
  const where = { id, companyId: company.id };

  let savedId = id;
  try {
    if (kind === "client") {
      if (id) {
        if (!(await db.client.updateMany({ where, data })).count) return { error: "El cliente ya no existe." };
      } else {
        savedId = (await db.client.create({ data: { ...data, companyId: company.id } })).id;
      }
    } else if (id) {
      if (!(await db.supplier.updateMany({ where, data })).count) return { error: "El proveedor ya no existe." };
    } else {
      savedId = (await db.supplier.create({ data: { ...data, companyId: company.id } })).id;
    }
  } catch (e) {
    if (isUniqueViolation(e, "taxId")) {
      return { error: "Ya existe un contacto con ese NIF.", fieldErrors: { taxId: "NIF ya registrado" } };
    }
    console.error("saveContact", e);
    return { error: "No se pudo guardar el contacto. Inténtalo de nuevo." };
  }

  redirect(`/contactos/${PATH[kind]}/${savedId}?guardado=1`);
}

const deleteInput = z.object({ kind: z.enum(["client", "supplier"]), id: z.uuid() });

export async function deleteContact(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const company = await getActiveCompany();
  if (!company) return NO_COMPANY;
  const parsed = deleteInput.safeParse({ kind: formData.get("kind"), id: formData.get("id") });
  if (!parsed.success) return { error: "Contacto no válido." };
  const { kind, id } = parsed.data;

  // Contacts with documents are kept: deleting them would break invoices, quotes and tax history.
  const used =
    kind === "client"
      ? (await db.invoice.count({ where: { clientId: id } })) + (await db.quote.count({ where: { clientId: id } }))
      : await db.expense.count({ where: { supplierId: id } });
  if (used) return { error: "No se puede eliminar: tiene documentos asociados." };

  const { count } =
    kind === "client"
      ? await db.client.deleteMany({ where: { id, companyId: company.id } })
      : await db.supplier.deleteMany({ where: { id, companyId: company.id } });
  if (!count) return { error: "El contacto ya no existe." };

  redirect(`/contactos?tipo=${PATH[kind]}`);
}
