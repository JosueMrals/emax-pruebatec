import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { param, type SearchParams, searchText } from "@/lib/filters";
import { formatCents } from "@/lib/money";

const TABS = [
  { value: "clientes", label: "Clientes" },
  { value: "proveedores", label: "Proveedores" },
] as const;

async function Contacts({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const [company, params] = await Promise.all([requireCompany(), searchParams]);
  const tab = param(params, "tipo") === "proveedores" ? "proveedores" : "clientes";
  const q = searchText(params);
  const match = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { taxId: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { city: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // Rows share one shape so the table renders clients and suppliers alike.
  const rows =
    tab === "clientes"
      ? await Promise.all([
          db.client.findMany({ where: { companyId: company.id, ...match }, orderBy: { name: "asc" } }),
          db.invoice.groupBy({ by: ["clientId"], where: { companyId: company.id }, _sum: { totalCents: true }, _count: true }),
        ]).then(([clients, totals]) =>
          clients.map((c) => {
            const t = totals.find((x) => x.clientId === c.id);
            return { ...c, docs: t?._count ?? 0, totalCents: t?._sum.totalCents ?? 0 };
          }),
        )
      : await Promise.all([
          db.supplier.findMany({ where: { companyId: company.id, ...match }, orderBy: { name: "asc" } }),
          db.expense.groupBy({ by: ["supplierId"], where: { companyId: company.id }, _sum: { totalCents: true }, _count: true }),
        ]).then(([suppliers, totals]) =>
          suppliers.map((s) => {
            const t = totals.find((x) => x.supplierId === s.id);
            return { ...s, docs: t?._count ?? 0, totalCents: t?._sum.totalCents ?? 0 };
          }),
        );

  return (
    <>
      <nav aria-label="Tipo de contacto" className="mb-4 flex gap-1">
        {TABS.map((t) => (
          <Button key={t.value} asChild size="sm" variant={t.value === tab ? "default" : "outline"}>
            <Link href={`/contactos?tipo=${t.value}`} aria-current={t.value === tab ? "page" : undefined}>
              {t.label}
            </Link>
          </Button>
        ))}
      </nav>
      <FilterBar
        action="/contactos"
        params={params}
        resultCount={rows.length}
        hidden={{ tipo: tab }}
        fields={[{ type: "search", name: "q", label: "Buscar", placeholder: "Nombre, NIF, email o ciudad" }]}
      />
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="text-right">{tab === "clientes" ? "Facturado" : "Gastado"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/contactos/${tab}/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.name}
                  </Link>
                  {r.countryCode !== "ES" && (
                    <Badge variant="secondary" className="ml-2">
                      {r.countryCode}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{r.taxId}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[r.email, r.phone, r.city].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(r.totalCents)}
                  <div className="text-xs text-muted-foreground">
                    {r.docs} {tab === "clientes" ? (r.docs === 1 ? "factura" : "facturas") : r.docs === 1 ? "gasto" : "gastos"}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q ? "Ningún contacto coincide con la búsqueda." : `Todavía no hay ${tab}.`}
        </p>
      )}
    </>
  );
}

export default function ContactosPage({ searchParams }: PageProps<"/contactos">) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Contactos" description="Clientes y proveedores de la empresa activa, con su historial." />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/contactos/nuevo?tipo=clientes">Nuevo cliente</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contactos/nuevo?tipo=proveedores">Nuevo proveedor</Link>
          </Button>
        </div>
      </div>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando contactos…</p>}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </>
  );
}
