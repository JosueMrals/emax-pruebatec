"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-errors";
import { COMPANY_COOKIE } from "@/lib/company";
import { db } from "@/lib/db";
import { fieldErrorsFrom } from "@/lib/validation/common";
import { companyInputSchema } from "@/lib/validation/company";

async function setActiveCompany(id: string) {
  (await cookies()).set(COMPANY_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function saveCompany(input: unknown): Promise<ActionResult> {
  const parsed = companyInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Revisa los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const { id, openingBalanceCents, ...fields } = parsed.data;
  const data = {
    ...fields,
    address: fields.address || null,
    postalCode: fields.postalCode || null,
    city: fields.city || null,
    email: fields.email || null,
    iban: fields.iban || null,
  };

  try {
    if (id) {
      const { count } = await db.company.updateMany({ where: { id }, data });
      if (count === 0) return { error: "La empresa ya no existe." };
    } else {
      // A new company starts with its main bank account so banking works from day one.
      const company = await db.company.create({
        data: {
          ...data,
          bankAccounts: {
            create: {
              name: "Cuenta principal",
              iban: data.iban,
              openingBalanceCents: openingBalanceCents ?? 0,
            },
          },
        },
      });
      await setActiveCompany(company.id);
    }
  } catch (e) {
    console.error("saveCompany", e);
    return { error: "No se pudo guardar la empresa. Inténtalo de nuevo." };
  }

  redirect(id ? "/configuracion?guardado=1" : "/");
}

export async function switchCompany(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("companyId"));
  if (id.success && (await db.company.count({ where: { id: id.data } }))) {
    await setActiveCompany(id.data);
  }
  redirect("/");
}
