import Link from "next/link";
import { connection } from "next/server";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
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
  const company = await requireCompany();
  const quarter = currentQuarter();
  const { start, end } = quarterRange(quarter);

  const [income, expenses, pending, pendingInvoices, accounts, movementSum, unreconciled, openQuotes] = await Promise.all([
    db.invoice.aggregate({ where: { companyId: company.id, issueDate: { gte: start, lt: end } }, _sum: { baseCents: true }, _count: true }),
    db.expense.aggregate({ where: { companyId: company.id, date: { gte: start, lt: end } }, _sum: { baseCents: true }, _count: true }),
    db.invoice.aggregate({ where: { companyId: company.id, status: "PENDIENTE" }, _sum: { totalCents: true }, _count: true }),
    db.invoice.findMany({
      where: { companyId: company.id, status: "PENDIENTE" },
      select: { id: true, number: true, issueDate: true, totalCents: true, client: { select: { name: true } } },
      orderBy: [{ issueDate: "asc" }, { number: "asc" }],
      take: 5,
    }),
    db.bankAccount.aggregate({ where: { companyId: company.id }, _sum: { openingBalanceCents: true }, _count: true }),
    db.bankMovement.aggregate({ where: { account: { companyId: company.id } }, _sum: { amountCents: true } }),
    db.bankMovement.count({ where: { account: { companyId: company.id }, invoiceId: null, expenseId: null } }),
    db.quote.aggregate({
      where: { companyId: company.id, status: { in: ["BORRADOR", "ENVIADO", "ACEPTADO"] } },
      _sum: { totalCents: true },
      _count: true,
    }),
  ]);
  const bankBalanceCents = (accounts._sum.openingBalanceCents ?? 0) + (movementSum._sum.amountCents ?? 0);

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

      <section aria-label="Tesorería y presupuestos" className="grid gap-4 sm:grid-cols-3">
        <Link href="/banco" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Stat
            title="Saldo en bancos"
            value={formatCents(bankBalanceCents)}
            detail={`${accounts._count} ${accounts._count === 1 ? "cuenta" : "cuentas"}`}
            tone={bankBalanceCents < 0 ? "negative" : undefined}
          />
        </Link>
        <Link href="/banco/conciliacion" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Stat
            title="Movimientos sin conciliar"
            value={String(unreconciled)}
            detail={unreconciled ? "Revisa la conciliación" : "Todo conciliado"}
          />
        </Link>
        <Link href="/presupuestos" className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Stat
            title="Presupuestos abiertos"
            value={formatCents(openQuotes._sum.totalCents ?? 0)}
            detail={`${openQuotes._count} sin facturar ni rechazar`}
          />
        </Link>
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
