import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ImportCsvForm, MovementForm, NewAccountForm } from "@/components/bank-forms";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { currentQuarter, dateFormat, todayInSpain } from "@/lib/dates";
import { db } from "@/lib/db";
import { param, periodDateFilter, periodOptions, type SearchParams, searchText } from "@/lib/filters";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatIban } from "@/lib/iban";
import { formatCents } from "@/lib/money";

async function Bank({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);

  const accounts = await db.bankAccount.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "asc" } });
  const [sums, pendingCounts] = await Promise.all([
    db.bankMovement.groupBy({
      by: ["accountId"],
      where: { account: { companyId: company.id } },
      _sum: { amountCents: true },
    }),
    db.bankMovement.groupBy({
      by: ["accountId"],
      where: { account: { companyId: company.id }, invoiceId: null, expenseId: null },
      _count: true,
    }),
  ]);
  const balance = (id: string, opening: number) => opening + (sums.find((s) => s.accountId === id)?._sum.amountCents ?? 0);
  const pendingOf = (id: string) => pendingCounts.find((c) => c.accountId === id)?._count ?? 0;

  const selected = accounts.find((a) => a.id === param(params, "cuenta")) ?? accounts[0];

  return (
    <div className="grid gap-6">
      <section aria-label="Cuentas" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/banco?cuenta=${a.id}`}
            aria-current={a.id === selected?.id ? "true" : undefined}
            className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Card className={a.id === selected?.id ? "ring-2 ring-primary" : ""}>
              <CardHeader>
                <CardDescription>{a.name}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{formatCents(balance(a.id, a.openingBalanceCents))}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {a.iban ? formatIban(a.iban) : "Sin IBAN"} · {pendingOf(a.id)} sin conciliar
              </CardContent>
            </Card>
          </Link>
        ))}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nueva cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <NewAccountForm />
          </CardContent>
        </Card>
      </section>

      {selected && <Movements account={selected} params={params} />}
    </div>
  );
}

async function Movements({
  account,
  params,
}: {
  account: { id: string; name: string };
  params: SearchParams;
}) {
  const q = searchText(params);
  const state = param(params, "estado");
  const where: Prisma.BankMovementWhereInput = {
    accountId: account.id,
    date: periodDateFilter(params),
    ...(state === "pendiente" && { invoiceId: null, expenseId: null }),
    ...(state === "conciliado" && { OR: [{ invoiceId: { not: null } }, { expenseId: { not: null } }] }),
    ...(q && { description: { contains: q, mode: "insensitive" } }),
  };
  const movements = await db.bankMovement.findMany({
    where,
    include: {
      invoice: { select: { number: true } },
      expense: { select: { description: true, supplier: { select: { name: true } } } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar extracto · {account.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportCsvForm accountId={account.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Añadir movimiento a mano</CardTitle>
          </CardHeader>
          <CardContent>
            <MovementForm accountId={account.id} defaultDate={todayInSpain()} />
          </CardContent>
        </Card>
      </div>

      <section aria-label={`Movimientos de ${account.name}`}>
        <h2 className="mb-3 text-lg font-semibold">Movimientos</h2>
        <FilterBar
          action="/banco"
          params={params}
          resultCount={movements.length}
          hidden={{ cuenta: account.id }}
          fields={[
            { type: "search", name: "q", label: "Buscar", placeholder: "Concepto" },
            {
              type: "select",
              name: "estado",
              label: "Conciliación",
              allLabel: "Todos",
              options: [
                { value: "pendiente", label: "Sin conciliar" },
                { value: "conciliado", label: "Conciliados" },
              ],
            },
            { type: "select", name: "periodo", label: "Trimestre", allLabel: "Todos", options: periodOptions(currentQuarter()) },
          ]}
        />
        {movements.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead className="text-right">Importe</TableHead>
                <TableHead>Conciliación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{dateFormat.format(m.date)}</TableCell>
                  <TableCell className="max-w-md whitespace-normal">{m.description}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCents(m.amountCents)}</TableCell>
                  <TableCell>
                    {m.invoice ? (
                      <Badge>Factura {m.invoice.number}</Badge>
                    ) : m.expense ? (
                      <Badge>Gasto · {m.expense.supplier.name}</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No hay movimientos{q || param(params, "estado") || param(params, "periodo") ? " con estos filtros" : ""}.
            Importa el extracto o añade uno a mano.
          </p>
        )}
      </section>
    </>
  );
}

export default function BancoPage({ searchParams }: PageProps<"/banco">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Banco" description="Saldos, extractos importados y movimientos de tus cuentas." />
        <Button asChild>
          <Link href="/banco/conciliacion">Conciliar movimientos</Link>
        </Button>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando cuentas…</p>}>
        <Bank searchParams={searchParams} />
      </Suspense>
    </>
  );
}
