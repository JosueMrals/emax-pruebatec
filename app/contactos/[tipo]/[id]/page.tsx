import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { ContactForm, type ContactValues, DeleteContactButton } from "@/components/contact-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { dateFormat } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { QUOTE_STATUS_LABELS } from "@/lib/quotes";

type Params = PageProps<"/contactos/[tipo]/[id]">;

function toValues(kind: ContactValues["kind"], c: {
  id: string;
  name: string;
  taxId: string;
  countryCode: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  notes: string | null;
}): ContactValues {
  return {
    kind,
    id: c.id,
    name: c.name,
    taxId: c.taxId,
    countryCode: c.countryCode,
    email: c.email ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    postalCode: c.postalCode ?? "",
    city: c.city ?? "",
    notes: c.notes ?? "",
  };
}

interface HistoryRow {
  key: string;
  date: Date;
  label: string;
  status: string;
  totalCents: number;
  pdf?: string;
}

async function ContactDetail({ params, searchParams }: Params) {
  await connection();
  const [{ tipo, id }, query, company] = await Promise.all([params, searchParams, requireCompany()]);
  if (!["clientes", "proveedores"].includes(tipo) || !z.uuid().safeParse(id).success) notFound();

  let values: ContactValues;
  let history: HistoryRow[];
  if (tipo === "clientes") {
    const client = await db.client.findFirst({
      where: { id, companyId: company.id },
      include: {
        invoices: { orderBy: { issueDate: "desc" } },
        quotes: { orderBy: { issueDate: "desc" } },
      },
    });
    if (!client) notFound();
    values = toValues("client", client);
    history = [
      ...client.invoices.map((i) => ({
        key: i.id,
        date: i.issueDate,
        label: `Factura ${i.number}`,
        status: i.status === "COBRADA" ? "Cobrada" : "Pendiente",
        totalCents: i.totalCents,
        pdf: `/facturas/${i.id}/pdf`,
      })),
      ...client.quotes.map((q) => ({
        key: q.id,
        date: q.issueDate,
        label: `Presupuesto ${q.number}`,
        status: QUOTE_STATUS_LABELS[q.status],
        totalCents: q.totalCents,
        pdf: `/presupuestos/${q.id}/pdf`,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());
  } else {
    const supplier = await db.supplier.findFirst({
      where: { id, companyId: company.id },
      include: { expenses: { orderBy: { date: "desc" }, include: { bankMovement: { select: { id: true } } } } },
    });
    if (!supplier) notFound();
    values = toValues("supplier", supplier);
    history = supplier.expenses.map((e) => ({
      key: e.id,
      date: e.date,
      label: e.description,
      status: e.bankMovement ? "Pagado" : "Sin conciliar",
      totalCents: e.totalCents,
    }));
  }

  return (
    <>
      <PageHeader title={values.name} description={`${tipo === "clientes" ? "Cliente" : "Proveedor"} · ${values.taxId}`} />
      {query.guardado === "1" && (
        <Alert role="status" className="mb-6">
          <AlertDescription>Contacto guardado.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <ContactForm key={values.id} initial={values} />
        <Card>
          <CardHeader>
            <CardTitle>Historial</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {history.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h) => (
                    <TableRow key={h.key}>
                      <TableCell className="whitespace-normal">
                        {h.pdf ? (
                          <a href={h.pdf} className="font-medium underline-offset-4 hover:underline">
                            {h.label}
                          </a>
                        ) : (
                          h.label
                        )}
                        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          {dateFormat.format(h.date)} <Badge variant="outline">{h.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCents(h.totalCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Sin documentos todavía.</p>
                <DeleteContactButton kind={values.kind} id={values.id} name={values.name} />
              </>
            )}
            <Link
              href={`/contactos?tipo=${tipo}`}
              className="text-sm font-medium underline underline-offset-4"
            >
              Volver a {tipo}
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function ContactPage(props: Params) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando contacto…</p>}>
      <ContactDetail {...props} />
    </Suspense>
  );
}
