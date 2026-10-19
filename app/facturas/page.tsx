import Link from "next/link";
import { Suspense } from "react";
import { InvoiceList } from "@/components/invoice-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function FacturasPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Facturas" description="Facturas emitidas a clientes nacionales e intracomunitarios." />
        <Button asChild>
          <Link href="/facturas/nueva">Nueva factura</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando facturas…</p>}>
        <InvoiceList />
      </Suspense>
    </>
  );
}
