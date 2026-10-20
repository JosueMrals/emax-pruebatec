import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { QuoteList } from "@/components/quote-list";
import { Button } from "@/components/ui/button";

export default function PresupuestosPage({ searchParams }: PageProps<"/presupuestos">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Presupuestos"
          description="Envía presupuestos y, cuando el cliente los acepte, conviértelos en factura con un clic."
        />
        <Button asChild>
          <Link href="/presupuestos/nuevo">Nuevo presupuesto</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando presupuestos…</p>}>
        <QuoteList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
