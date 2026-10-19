import Link from "next/link";
import { connection } from "next/server";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

export async function ExpenseList() {
  await connection();
  const expenses = await db.expense.findMany({
    include: { supplier: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  if (!expenses.length) {
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
  );
}
