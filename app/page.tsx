import Link from "next/link";
import { Suspense } from "react";
import { DashboardSummary } from "@/components/dashboard-summary";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Dashboard" description="Resumen del trimestre actual y facturas por cobrar." />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/facturas/nueva">Nueva factura</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/gastos/nuevo">Nuevo gasto</Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando resumen…</p>}>
        <DashboardSummary />
      </Suspense>
    </>
  );
}
