import Link from "next/link";
import { connection } from "next/server";
import { FilterBar } from "@/components/filter-bar";
import { QuoteActions } from "@/components/quote-actions";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { currentQuarter, dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { periodDateFilter, periodOptions, pickOption, type SearchParams, searchText } from "@/lib/filters";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { QUOTE_STATUS_LABELS, QUOTE_STATUSES } from "@/lib/quotes";

export async function QuoteList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const q = searchText(params);

  const where: Prisma.QuoteWhereInput = {
    companyId: company.id,
    status: pickOption(params, "estado", QUOTE_STATUSES),
    issueDate: periodDateFilter(params),
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { client: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [quotes, total] = await Promise.all([
    db.quote.findMany({
      where,
      include: { client: { select: { name: true } }, invoice: { select: { number: true } } },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    }),
    db.quote.count({ where: { companyId: company.id } }),
  ]);

  if (!total) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay presupuestos.{" "}
        <Link href="/presupuestos/nuevo" className="font-medium text-foreground underline underline-offset-4">
          Crea el primero
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <FilterBar
        action="/presupuestos"
        params={params}
        resultCount={quotes.length}
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Número o cliente" },
          {
            type: "select",
            name: "estado",
            label: "Estado",
            allLabel: "Todos",
            options: QUOTE_STATUSES.map((s) => ({ value: s, label: QUOTE_STATUS_LABELS[s] })),
          },
          { type: "select", name: "periodo", label: "Trimestre", allLabel: "Todos", options: periodOptions(currentQuarter()) },
        ]}
      />
      {quotes.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.map((quote) => (
              <TableRow key={quote.id}>
                <TableCell className="font-medium">{quote.number}</TableCell>
                <TableCell>
                  <div>{dateFormat.format(quote.issueDate)}</div>
                  {quote.validUntil && (
                    <div className="text-xs text-muted-foreground">Válido hasta {dateFormat.format(quote.validUntil)}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div>{quote.client.name}</div>
                  {quote.operationType === "INTRA_SERVICIOS" && <Badge variant="secondary">Intracomunitario</Badge>}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCents(quote.totalCents)}</TableCell>
                <TableCell>
                  <Badge variant={quote.status === "ACEPTADO" || quote.status === "FACTURADO" ? "default" : "outline"}>
                    {QUOTE_STATUS_LABELS[quote.status]}
                  </Badge>
                  {quote.invoice && (
                    <div className="text-xs text-muted-foreground">Factura {quote.invoice.number}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-start justify-end gap-2">
                    <a
                      href={`/presupuestos/${quote.id}/pdf`}
                      className="py-1 text-sm font-medium underline underline-offset-4"
                      aria-label={`Descargar PDF de ${quote.number}`}
                    >
                      PDF
                    </a>
                    <QuoteActions id={quote.id} number={quote.number} status={quote.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ningún presupuesto coincide con estos filtros.
        </p>
      )}
    </>
  );
}
