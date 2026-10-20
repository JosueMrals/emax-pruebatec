import Link from "next/link";
import { Suspense } from "react";
import { ExpenseList } from "@/components/expense-list";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

export default function GastosPage({ searchParams }: PageProps<"/gastos">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Gastos" description="Gastos de proveedores con IVA soportado y retenciones de IRPF." />
        <Button asChild>
          <Link href="/gastos/nuevo">Nuevo gasto</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando gastos…</p>}>
        <ExpenseList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
