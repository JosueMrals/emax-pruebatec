import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/lib/db";

export const COMPANY_COOKIE = "empresa";

// Active company from the cookie; falls back to the oldest company. Null only when none exists yet.
export const getActiveCompany = cache(async () => {
  const id = (await cookies()).get(COMPANY_COOKIE)?.value;
  const fromCookie = id && z.uuid().safeParse(id).success ? await db.company.findUnique({ where: { id } }) : null;
  return fromCookie ?? (await db.company.findFirst({ orderBy: { createdAt: "asc" } }));
});

// For pages: sends the user to the initial setup when there is no company.
export async function requireCompany() {
  const company = await getActiveCompany();
  if (!company) redirect("/configuracion");
  return company;
}
