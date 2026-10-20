import { connection } from "next/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireCompany } from "@/lib/company";
import type { Quarter } from "@/lib/fiscal/quarter";
import { formatCents } from "@/lib/money";
import { loadQuarterTaxes } from "@/lib/taxes";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <>
      <dt className={strong ? "border-t pt-2 font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={`text-right tabular-nums ${strong ? "border-t pt-2 font-semibold" : ""}`}>{value}</dd>
    </>
  );
}

export async function TaxSummary({ quarter }: { quarter: Quarter }) {
  await connection();
  const company = await requireCompany();
  const { invoiceCount, expenseCount, m303, m111, m349 } = await loadQuarterTaxes(company.id, quarter);

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        {invoiceCount} {invoiceCount === 1 ? "factura emitida" : "facturas emitidas"} · {expenseCount}{" "}
        {expenseCount === 1 ? "gasto" : "gastos"} en el trimestre.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Modelo 303 · IVA</CardTitle>
            <CardDescription>IVA repercutido en facturas menos IVA soportado deducible en gastos.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <Row label="IVA repercutido" value={formatCents(m303.repercutidoCents)} />
              <Row label="IVA soportado deducible" value={`−${formatCents(m303.soportadoCents)}`} />
              <Row
                label={m303.resultadoCents < 0 ? "Resultado: a compensar" : "Resultado: a ingresar"}
                value={formatCents(Math.abs(m303.resultadoCents))}
                strong
              />
            </dl>
            {m303.intraServiciosBaseCents > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Incluye {formatCents(m303.intraServiciosBaseCents)} de servicios intracomunitarios sin IVA (inversión
                del sujeto pasivo).
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modelo 111 · Retenciones IRPF</CardTitle>
            <CardDescription>Retenciones practicadas a profesionales en tus gastos.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
              <Row label="Perceptores" value={String(m111.perceptores)} />
              <Row label="Base de las retenciones" value={formatCents(m111.baseCents)} />
              <Row label="A ingresar" value={formatCents(m111.retencionesCents)} strong />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Modelo 349 · Operaciones intracomunitarias</CardTitle>
          <CardDescription>Operadores de la UE agrupados por NIF-IVA y clave (S: servicios prestados).</CardDescription>
        </CardHeader>
        <CardContent>
          {m349.operadores.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIF-IVA</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Clave</TableHead>
                  <TableHead className="text-right">Base imponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m349.operadores.map((o) => (
                  <TableRow key={`${o.taxId}-${o.clave}`}>
                    <TableCell className="font-medium">{o.taxId}</TableCell>
                    <TableCell>{o.name}</TableCell>
                    <TableCell>{o.clave}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(o.baseCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(m349.totalCents)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">Sin operaciones intracomunitarias en este trimestre.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
