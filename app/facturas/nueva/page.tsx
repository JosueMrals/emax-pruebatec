import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { todayInSpain } from "@/lib/dates";
import { db } from "@/lib/db";

async function NewInvoice() {
  await connection();
  const clients = await db.client.findMany({
    select: { id: true, name: true, taxId: true, countryCode: true },
    orderBy: { name: "asc" },
  });
  return <InvoiceForm clients={clients} defaultDate={todayInSpain()} />;
}

export default function NuevaFacturaPage() {
  return (
    <>
      <PageHeader title="Nueva factura" description="Los totales se calculan mientras escribes." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <NewInvoice />
      </Suspense>
    </>
  );
}
