import { Document, Page, Text, View } from "@react-pdf/renderer";
import type { Quarter } from "@/lib/fiscal/quarter";
import { formatCents } from "@/lib/money";
import type { QuarterTaxes } from "@/lib/taxes";
import { pdf } from "./pdf-styles";

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={[pdf.between, strong ? { borderTopWidth: 1, marginTop: 4, paddingTop: 4 } : {}]}>
      <Text style={strong ? pdf.bold : undefined}>{label}</Text>
      <Text style={strong ? pdf.bold : undefined}>{value}</Text>
    </View>
  );
}

export function TaxReportPdf({
  company,
  quarter,
  taxes,
  generatedOn,
}: {
  company: { name: string; taxId: string };
  quarter: Quarter;
  taxes: QuarterTaxes;
  generatedOn: string;
}) {
  const { m303, m111, m349 } = taxes;
  const label = `${quarter.quarter}T ${quarter.year}`;

  return (
    <Document title={`Impuestos ${label} · ${company.name}`} author={company.name} language="es">
      <Page size="A4" style={pdf.page}>
        <Text style={pdf.h1}>Resumen de impuestos · {label}</Text>
        <Text>
          {company.name} · NIF {company.taxId}
        </Text>
        <Text style={[pdf.muted, { marginBottom: 16 }]}>
          {taxes.invoiceCount} {taxes.invoiceCount === 1 ? "factura emitida" : "facturas emitidas"} y {taxes.expenseCount}{" "}
          {taxes.expenseCount === 1 ? "gasto" : "gastos"} en el trimestre. Generado el {generatedOn}.
        </Text>

        <View style={[pdf.box, { marginBottom: 12 }]} wrap={false}>
          <Text style={pdf.h2}>Modelo 303 · IVA</Text>
          <Line label="IVA repercutido" value={formatCents(m303.repercutidoCents)} />
          <Line label="IVA soportado deducible" value={`-${formatCents(m303.soportadoCents)}`} />
          <Line
            label={m303.resultadoCents < 0 ? "Resultado: a compensar" : "Resultado: a ingresar"}
            value={formatCents(Math.abs(m303.resultadoCents))}
            strong
          />
          {m303.intraServiciosBaseCents > 0 ? (
            <Text style={[pdf.muted, { marginTop: 4 }]}>
              Incluye {formatCents(m303.intraServiciosBaseCents)} de servicios intracomunitarios sin IVA.
            </Text>
          ) : null}
        </View>

        <View style={[pdf.box, { marginBottom: 12 }]} wrap={false}>
          <Text style={pdf.h2}>Modelo 111 · Retenciones IRPF</Text>
          <Line label="Perceptores" value={String(m111.perceptores)} />
          <Line label="Base de las retenciones" value={formatCents(m111.baseCents)} />
          <Line label="A ingresar" value={formatCents(m111.retencionesCents)} strong />
        </View>

        <View style={pdf.box}>
          <Text style={pdf.h2}>Modelo 349 · Operaciones intracomunitarias</Text>
          {m349.operadores.length ? (
            <>
              <View style={pdf.tableHeader}>
                <Text style={{ width: 110 }}>NIF-IVA</Text>
                <Text style={{ flex: 1 }}>Operador</Text>
                <Text style={{ width: 40 }}>Clave</Text>
                <Text style={[{ width: 90 }, pdf.right]}>Base</Text>
              </View>
              {m349.operadores.map((o) => (
                <View key={`${o.taxId}-${o.clave}`} style={pdf.tableRow} wrap={false}>
                  <Text style={{ width: 110 }}>{o.taxId}</Text>
                  <Text style={{ flex: 1 }}>{o.name}</Text>
                  <Text style={{ width: 40 }}>{o.clave}</Text>
                  <Text style={[{ width: 90 }, pdf.right]}>{formatCents(o.baseCents)}</Text>
                </View>
              ))}
              <Line label="Total" value={formatCents(m349.totalCents)} strong />
            </>
          ) : (
            <Text style={pdf.muted}>Sin operaciones intracomunitarias en este trimestre.</Text>
          )}
        </View>

        <Text style={pdf.footer} fixed>
          Estimación orientativa generada con EnerFactura. No es una declaración oficial.
        </Text>
      </Page>
    </Document>
  );
}
