import { connection } from "next/server";
import { Suspense } from "react";
import { ExpenseForm } from "@/components/expense-form";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";

async function NewExpense() {
  await connection();
  const suppliers = await db.supplier.findMany({
    select: { id: true, name: true, taxId: true },
    orderBy: { name: "asc" },
  });
  // Default to today's date in Spain, not UTC.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  return <ExpenseForm suppliers={suppliers} defaultDate={today} />;
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
