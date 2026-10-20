import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/expense-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loadMovementPrefill } from "@/lib/bank/movement-prefill";
import { nameMentioned } from "@/lib/bank/reconcile";
import { todayInSpain } from "@/lib/dates";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";

async function NewExpense({ searchParams }: { searchParams: PageProps<"/gastos/nuevo">["searchParams"] }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const [suppliers, { movement, notice }] = await Promise.all([
    db.supplier.findMany({
      where: { companyId: company.id },
      select: { id: true, name: true, taxId: true },
      orderBy: { name: "asc" },
    }),
    loadMovementPrefill(company.id, params.movimiento, "expense"),
  ]);
  // Preselect the supplier only when exactly one is named in the bank concept.
  const named = movement ? suppliers.filter((s) => nameMentioned(movement.description, s.name)) : [];

  return (
    <>
      {notice && (
        <Alert variant="destructive" role="alert" className="mb-6">
          <AlertDescription>{notice} Puedes registrar el gasto sin conciliar.</AlertDescription>
        </Alert>
      )}
      <ExpenseForm
        suppliers={suppliers}
        defaultDate={todayInSpain()}
        fromMovement={movement}
        defaultSupplierId={named.length === 1 ? named[0].id : ""}
      />
    </>
  );
}

export default function NuevoGastoPage({ searchParams }: PageProps<"/gastos/nuevo">) {
  return (
    <>
      <PageHeader title="Nuevo gasto" description="Los totales se calculan mientras escribes." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <NewExpense searchParams={searchParams} />
      </Suspense>
    </>
  );
}
