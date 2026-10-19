import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";

async function NewInvoice() {
  await connection();
  const clients = await db.client.findMany({
    select: { id: true, name: true, taxId: true, countryCode: true },
    orderBy: { name: "asc" },
  });
  // Default to today's date in Spain, not UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  return <InvoiceForm clients={clients} defaultDate={today} />;
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
