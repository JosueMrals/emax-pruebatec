import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { requireCompany } from "@/lib/company";
import { todayInSpain } from "@/lib/dates";
import { db } from "@/lib/db";

async function NewQuote() {
  await connection();
  const company = await requireCompany();
  const clients = await db.client.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, taxId: true, countryCode: true },
    orderBy: { name: "asc" },
  });
  return <InvoiceForm kind="quote" clients={clients} defaultDate={todayInSpain()} />;
}

export default function NuevoPresupuestoPage() {
  return (
    <>
      <PageHeader title="Nuevo presupuesto" description="Los totales se calculan mientras escribes." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <NewQuote />
      </Suspense>
    </>
  );
}
