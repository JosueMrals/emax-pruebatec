import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ReconcileForm, UnreconcileButton } from "@/components/reconcile-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type MatchCandidate, suggestMatches } from "@/lib/bank/reconcile";
import { requireCompany } from "@/lib/company";
import { dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function Reconciliation() {
  await connection();
  const company = await requireCompany();
  const inCompany = { account: { companyId: company.id } };

  const [pending, reconciled, invoices, expenses] = await Promise.all([
    db.bankMovement.findMany({
      where: { ...inCompany, invoiceId: null, expenseId: null },
      include: { account: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
    db.bankMovement.findMany({
      where: { ...inCompany, OR: [{ invoiceId: { not: null } }, { expenseId: { not: null } }] },
      include: {
        invoice: { select: { number: true, client: { select: { name: true } } } },
        expense: { select: { number: true, description: true, supplier: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: 20,
    }),
    // Open documents: not yet linked to any movement.
    db.invoice.findMany({
      where: { companyId: company.id, bankMovement: null },
      select: { id: true, number: true, issueDate: true, totalCents: true, client: { select: { name: true } } },
    }),
    db.expense.findMany({
      where: { companyId: company.id, bankMovement: null },
      select: { id: true, number: true, date: true, totalCents: true, description: true, supplier: { select: { name: true } } },
    }),
  ]);

  const candidates: MatchCandidate[] = [
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      reference: i.number,
      contactName: i.client.name,
      date: iso(i.issueDate),
      totalCents: i.totalCents,
    })),
    ...expenses.map((e) => ({
      type: "expense" as const,
      id: e.id,
      reference: e.number,
      contactName: e.supplier.name,
      date: iso(e.date),
      totalCents: e.totalCents,
    })),
  ];
  const expenseDescriptions = new Map(expenses.map((e) => [e.id, e.description]));

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Pendientes de conciliar ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead className="w-[45%]">Documento sugerido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((m) => {
                  const suggestions = suggestMatches(
                    { date: iso(m.date), description: m.description, amountCents: m.amountCents },
                    candidates,
                  );
                  return (
                    <TableRow key={m.id} className="align-top">
                      <TableCell>{dateFormat.format(m.date)}</TableCell>
                      <TableCell className="whitespace-normal">
                        <div>{m.description}</div>
                        <div className="text-xs text-muted-foreground">{m.account.name}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCents(m.amountCents)}</TableCell>
                      <TableCell className="whitespace-normal">
                        {suggestions.length ? (
                          <ReconcileForm
                            movementId={m.id}
                            suggestions={suggestions.map((s) => ({
                              value: `${s.type}:${s.id}`,
                              label:
                                s.type === "invoice"
                                  ? `Factura ${s.reference} · ${s.contactName} · ${formatCents(s.totalCents)}`
                                  : `Gasto ${s.contactName} · ${expenseDescriptions.get(s.id) ?? ""} · ${formatCents(s.totalCents)}`,
                              reasons: s.reasons,
                            }))}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {m.amountCents > 0
                              ? "Ninguna factura abierta con este importe."
                              : "Ningún gasto abierto con este importe."}{" "}
                            <Link
                              href={`${m.amountCents > 0 ? "/facturas/nueva" : "/gastos/nuevo"}?movimiento=${m.id}`}
                              className="font-medium text-foreground underline underline-offset-4"
                            >
                              {m.amountCents > 0 ? "Crear factura con este importe" : "Registrar gasto con este importe"}
                            </Link>
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Todo conciliado.{" "}
              <Link href="/banco" className="font-medium text-foreground underline underline-offset-4">
                Importa un extracto
              </Link>{" "}
              para seguir.
            </p>
          )}
        </CardContent>
      </Card>

      {reconciled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Conciliados recientemente</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciled.map((m) => {
                  const doc = m.invoice
                    ? `Factura ${m.invoice.number} · ${m.invoice.client.name}`
                    : `Gasto ${m.expense?.supplier.name} · ${m.expense?.description}`;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>{dateFormat.format(m.date)}</TableCell>
                      <TableCell className="whitespace-normal">{m.description}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(m.amountCents)}</TableCell>
                      <TableCell className="whitespace-normal">{doc}</TableCell>
                      <TableCell>
                        <UnreconcileButton movementId={m.id} label={doc} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function ReconciledNotice({ searchParams }: { searchParams: PageProps<"/banco/conciliacion">["searchParams"] }) {
  const { conciliado } = await searchParams;
  if (typeof conciliado !== "string" || !conciliado) return null;
  return (
    <Alert role="status" className="mb-6">
      <AlertDescription>{conciliado.slice(0, 200)} creado y conciliado con su movimiento.</AlertDescription>
    </Alert>
  );
}

export default function ConciliacionPage({ searchParams }: PageProps<"/banco/conciliacion">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Conciliación bancaria"
          description="Empareja cada movimiento con su factura o gasto. Conciliar un cobro marca la factura como cobrada."
        />
        <Button asChild variant="outline">
          <Link href="/banco">Volver al banco</Link>
        </Button>
      </div>
      <Suspense fallback={null}>
        <ReconciledNotice searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Buscando coincidencias…</p>}>
        <Reconciliation />
      </Suspense>
    </>
  );
}
