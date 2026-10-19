import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/expense-form";
import { PageHeader } from "@/components/page-header";
import { todayInSpain } from "@/lib/dates";
import { db } from "@/lib/db";

async function NewExpense() {
  await connection();
  const suppliers = await db.supplier.findMany({
    select: { id: true, name: true, taxId: true },
    orderBy: { name: "asc" },
  });
  return <ExpenseForm suppliers={suppliers} defaultDate={todayInSpain()} />;
}

export default function NuevoGastoPage() {
  return (
    <>
      <PageHeader title="Nuevo gasto" description="Los totales se calculan mientras escribes." />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
        <NewExpense />
      </Suspense>
    </>
  );
}
