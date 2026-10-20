import { connection } from "next/server";
import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loadMovementPrefill } from "@/lib/bank/movement-prefill";
import { nameMentioned } from "@/lib/bank/reconcile";
import { todayInSpain } from "@/lib/dates";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";

async function NewInvoice({ searchParams }: { searchParams: PageProps<"/facturas/nueva">["searchParams"] }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const [clients, { movement, notice }] = await Promise.all([
    db.client.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true, taxId: true, countryCode: true },
      orderBy: { name: "asc" },
    }),
    loadMovementPrefill(company.id, params.movimiento, "invoice"),
  ]);
  // Preselect the client only when exactly one is named in the bank concept.
  const named = movement ? clients.filter((c) => nameMentioned(movement.description, c.name)) : [];

  return (
    <>
      {notice && (
        <Alert variant="destructive" role="alert" className="mb-6">
          <AlertDescription>{notice} Puedes crear la factura sin conciliar.</AlertDescription>
        </Alert>
      )}
      <InvoiceForm
        clients={clients}
        defaultDate={todayInSpain()}
        fromMovement={movement}
        defaultClientId={named.length === 1 ? named[0].id : ""}
      />
    </>
  );
}

export default function NuevaFacturaPage({ searchParams }: PageProps<"/facturas/nueva">) {
  return (
    <>
      <PageHeader title="Nueva factura" description="Los totales se calculan mientras escribes." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <NewInvoice searchParams={searchParams} />
      </Suspense>
    </>
  );
}
