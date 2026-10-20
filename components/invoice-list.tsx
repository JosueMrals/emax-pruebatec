import Link from "next/link";
import { connection } from "next/server";
import { FilterBar } from "@/components/filter-bar";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { currentQuarter, dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { periodDateFilter, periodOptions, pickOption, type SearchParams, searchText } from "@/lib/filters";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatCents } from "@/lib/money";

const STATUSES = ["PENDIENTE", "COBRADA"] as const;
const TYPES = ["NACIONAL", "INTRA_SERVICIOS"] as const;

export async function InvoiceList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const q = searchText(params);

  const where: Prisma.InvoiceWhereInput = {
    companyId: company.id,
    status: pickOption(params, "estado", STATUSES),
    operationType: pickOption(params, "tipo", TYPES),
    issueDate: periodDateFilter(params),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
        { client: { taxId: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      include: { client: { select: { name: true } }, bankMovement: { select: { id: true } } },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    }),
    db.invoice.count({ where: { companyId: company.id } }),
  ]);

  if (!total) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay facturas.{" "}
        <Link href="/facturas/nueva" className="font-medium text-foreground underline underline-offset-4">
          Crea la primera
        </Link>{" "}
        o conviértela desde un presupuesto aceptado.
      </p>
    );
  }

  return (
    <>
      <FilterBar
        action="/facturas"
        params={params}
        resultCount={invoices.length}
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Número, cliente o NIF" },
          {
            type: "select",
            name: "estado",
            label: "Estado",
            allLabel: "Todos",
            options: [
              { value: "PENDIENTE", label: "Pendiente" },
              { value: "COBRADA", label: "Cobrada" },
            ],
          },
          {
            type: "select",
            name: "tipo",
            label: "Tipo",
            allLabel: "Todos",
            options: [
              { value: "NACIONAL", label: "Nacional" },
              { value: "INTRA_SERVICIOS", label: "Intracomunitaria" },
            ],
          },
          { type: "select", name: "periodo", label: "Trimestre", allLabel: "Todos", options: periodOptions(currentQuarter()) },
        ]}
      />
      {invoices.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.number}</TableCell>
                <TableCell>{dateFormat.format(inv.issueDate)}</TableCell>
                <TableCell>
                  <div>{inv.client.name}</div>
                  {inv.operationType === "INTRA_SERVICIOS" && <Badge variant="secondary">Intracomunitaria</Badge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(inv.baseCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(inv.vatCents)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCents(inv.totalCents)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {inv.status === "COBRADA" ? <Badge>Cobrada</Badge> : <Badge variant="outline">Pendiente</Badge>}
                    {inv.bankMovement && <Badge variant="secondary">Conciliada</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-start justify-end gap-2">
                    <a
                      href={`/facturas/${inv.id}/pdf`}
                      className="text-sm font-medium underline underline-offset-4"
                      aria-label={`Descargar PDF de ${inv.number}`}
                    >
                      PDF
                    </a>
                    {inv.status === "PENDIENTE" && <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.number} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ninguna factura coincide con estos filtros.
        </p>
      )}
    </>
  );
}
