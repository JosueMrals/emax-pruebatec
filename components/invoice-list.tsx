import Link from "next/link";
import { connection } from "next/server";
import { MarkPaidButton } from "@/components/mark-paid-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

// issueDate is a DATE stored at UTC midnight; format in UTC so it never shifts a day.
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export async function InvoiceList() {
  await connection();
  const invoices = await db.invoice.findMany({
    include: { client: { select: { name: true } } },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
  });

  if (!invoices.length) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Todavía no hay facturas.{" "}
        <Link href="/facturas/nueva" className="font-medium text-foreground underline underline-offset-4">
          Crea la primera
        </Link>
        .
      </p>
    );
  }

  return (
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
            <TableCell>{dateFmt.format(inv.issueDate)}</TableCell>
            <TableCell>
              <div>{inv.client.name}</div>
              {inv.operationType === "INTRA_SERVICIOS" && <Badge variant="secondary">Intracomunitaria</Badge>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(inv.baseCents)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatCents(inv.vatCents)}</TableCell>
            <TableCell className="text-right font-medium tabular-nums">{formatCents(inv.totalCents)}</TableCell>
            <TableCell>
              {inv.status === "COBRADA" ? <Badge>Cobrada</Badge> : <Badge variant="outline">Pendiente</Badge>}
            </TableCell>
            <TableCell className="text-right">
              {inv.status === "PENDIENTE" && <MarkPaidButton invoiceId={inv.id} invoiceNumber={inv.number} />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
