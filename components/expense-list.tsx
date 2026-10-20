import Link from "next/link";
import { connection } from "next/server";
import { FilterBar } from "@/components/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { currentQuarter, dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { param, periodDateFilter, periodOptions, pickOption, type SearchParams, searchText } from "@/lib/filters";
import type { Prisma } from "@/lib/generated/prisma/client";
import { formatCents } from "@/lib/money";

const SOURCES = ["MANUAL", "OCR"] as const;

export async function ExpenseList({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const q = searchText(params);
  const deductible = param(params, "deducible");

  const where: Prisma.ExpenseWhereInput = {
    companyId: company.id,
    source: pickOption(params, "origen", SOURCES),
    deductible: deductible === "si" ? true : deductible === "no" ? false : undefined,
    date: periodDateFilter(params),
    ...(q && {
      OR: [
        { description: { contains: q, mode: "insensitive" } },
        { number: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const [expenses, total] = await Promise.all([
    db.expense.findMany({
      where,
      include: { supplier: { select: { name: true } }, bankMovement: { select: { id: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.expense.count({ where: { companyId: company.id } }),
  ]);

  if (!total) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay gastos.{" "}
        <Link href="/gastos/nuevo" className="font-medium text-foreground underline underline-offset-4">
          Registra el primero
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <FilterBar
        action="/gastos"
        params={params}
        resultCount={expenses.length}
        fields={[
          { type: "search", name: "q", label: "Buscar", placeholder: "Proveedor, concepto o número" },
          {
            type: "select",
            name: "deducible",
            label: "IVA",
            allLabel: "Todos",
            options: [
              { value: "si", label: "Deducible" },
              { value: "no", label: "No deducible" },
            ],
          },
          {
            type: "select",
            name: "origen",
            label: "Origen",
            allLabel: "Todos",
            options: [
              { value: "MANUAL", label: "Manual" },
              { value: "OCR", label: "OCR" },
            ],
          },
          { type: "select", name: "periodo", label: "Trimestre", allLabel: "Todos", options: periodOptions(currentQuarter()) },
        ]}
      />
      {expenses.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">IVA</TableHead>
              <TableHead className="text-right">IRPF</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((exp) => (
              <TableRow key={exp.id}>
                <TableCell>{dateFormat.format(exp.date)}</TableCell>
                <TableCell>{exp.supplier.name}</TableCell>
                <TableCell>
                  <div>{exp.description}</div>
                  <div className="flex flex-wrap gap-1">
                    {exp.number && <span className="text-xs text-muted-foreground">Nº {exp.number}</span>}
                    {!exp.deductible && <Badge variant="outline">IVA no deducible</Badge>}
                    {exp.source === "OCR" && <Badge variant="secondary">OCR</Badge>}
                    {exp.bankMovement && <Badge>Pagado · conciliado</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(exp.baseCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(exp.vatCents)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {exp.irpfCents ? `−${formatCents(exp.irpfCents)}` : "—"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatCents(exp.totalCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Ningún gasto coincide con estos filtros.
        </p>
      )}
    </>
  );
}
