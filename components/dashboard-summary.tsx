import Link from "next/link";
import { connection } from "next/server";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { currentQuarter, dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { quarterRange } from "@/lib/fiscal/quarter";
import { formatCents } from "@/lib/money";

function Stat({ title, value, detail, tone }: { title: string; value: string; detail: string; tone?: "negative" }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${tone === "negative" ? "text-destructive" : ""}`}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  );
}

export async function DashboardSummary() {
  await connection();
  const quarter = currentQuarter();
  const { start, end } = quarterRange(quarter);

  const [income, expenses, pending, pendingInvoices] = await Promise.all([
    db.invoice.aggregate({ where: { issueDate: { gte: start, lt: end } }, _sum: { baseCents: true }, _count: true }),
    db.expense.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { baseCents: true }, _count: true }),
    db.invoice.aggregate({ where: { status: "PENDIENTE" }, _sum: { totalCents: true }, _count: true }),
    db.invoice.findMany({
      where: { status: "PENDIENTE" },
      select: { id: true, number: true, issueDate: true, totalCents: true, client: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { number: "asc" }],
      take: 5,
    }),
  ]);

  const incomeCents = income._sum.baseCents ?? 0;
  const expensesCents = expenses._sum.baseCents ?? 0;
  const balanceCents = incomeCents - expensesCents;
  const label = `${quarter.quarter}T ${quarter.year}`;

  return (
    <div className="grid gap-6">
      <section aria-label={`Resumen del ${label}`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          title={`Ingresos ${label}`}
          value={formatCents(incomeCents)}
          detail={`${income._count} ${income._count === 1 ? "factura" : "facturas"} · base sin IVA`}
        />
        <Stat
          title={`Gastos ${label}`}
          value={formatCents(expensesCents)}
          detail={`${expenses._count} ${expenses._count === 1 ? "gasto" : "gastos"} · base sin IVA`}
        />
        <Stat
          title={`Balance ${label}`}
          value={formatCents(balanceCents)}
          detail="Ingresos menos gastos"
          tone={balanceCents < 0 ? "negative" : undefined}
        />
        <Stat
          title="Pendiente de cobro"
          value={formatCents(pending._sum.totalCents ?? 0)}
          detail={`${pending._count} ${pending._count === 1 ? "factura" : "facturas"} · total con IVA`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Facturas pendientes de cobro</CardTitle>
          <CardDescription>Las más antiguas primero.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingInvoices.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.number}</TableCell>
                    <TableCell>{dateFormat.format(inv.issueDate)}</TableCell>
                    <TableCell>{inv.client.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(inv.totalCents)}</TableCell>
                    <TableCell className="text-right">
                      <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.number} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No hay facturas pendientes de cobro.</p>
          )}
          {pending._count > pendingInvoices.length && (
            <p className="mt-4 text-sm">
              <Link href="/facturas" className="font-medium underline underline-offset-4">
                Ver las {pending._count} facturas pendientes
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
