import { Document, Page, Text, View } from "@react-pdf/renderer";
import { dateFormat } from "@/lib/dates";
import { EU_COUNTRIES } from "@/lib/fiscal/operations";
import { vatBreakdown } from "@/lib/fiscal/totals";
import { formatIban } from "@/lib/iban";
import { formatCents } from "@/lib/money";
import { pdf } from "./pdf-styles";

interface Party {
  name: string;
  taxId: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  email?: string | null;
  countryCode?: string;
}

export interface SalesPdfData {
  kind: "invoice" | "quote";
  number: string;
  issueDate: Date;
  validUntil?: Date | null;
  operationType: "NACIONAL" | "INTRA_SERVICIOS";
  notes: string | null;
  company: Party & { iban: string | null };
  client: Party;
  lines: { description: string; quantity: number; unitPriceCents: number; vatRate: number; baseCents: number; vatCents: number }[];
  baseCents: number;
  vatCents: number;
  totalCents: number;
}

function PartyBlock({ title, party, taxLabel }: { title: string; party: Party; taxLabel: string }) {
  const place = [party.postalCode, party.city].filter(Boolean).join(" ");
  const country =
    party.countryCode && party.countryCode !== "ES"
      ? EU_COUNTRIES.find((c) => c.code === party.countryCode)?.name
      : undefined;
  return (
    <View style={[pdf.box, { flex: 1 }]}>
      <Text style={pdf.label}>{title}</Text>
      <Text style={pdf.bold}>{party.name}</Text>
      <Text>
        {taxLabel}: {party.taxId}
      </Text>
      {party.address ? <Text>{party.address}</Text> : null}
      {place || country ? <Text>{[place, country].filter(Boolean).join(" · ")}</Text> : null}
      {party.email ? <Text style={pdf.muted}>{party.email}</Text> : null}
    </View>
  );
}

const COLS = { desc: { flex: 1 }, qty: { width: 40 }, price: { width: 70 }, vat: { width: 40 }, amount: { width: 75 } };

export function SalesDocumentPdf({ data }: { data: SalesPdfData }) {
  const isQuote = data.kind === "quote";
  const intra = data.operationType === "INTRA_SERVICIOS";
  const title = isQuote ? "Presupuesto" : "Factura";

  return (
    <Document title={`${title} ${data.number}`} author={data.company.name} language="es">
      <Page size="A4" style={pdf.page}>
        <View style={[pdf.between, { marginBottom: 18 }]}>
          <View>
            <Text style={pdf.h1}>{title}</Text>
            <Text style={pdf.bold}>Nº {data.number}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>Fecha: {dateFormat.format(data.issueDate)}</Text>
            {isQuote && data.validUntil ? <Text>Válido hasta: {dateFormat.format(data.validUntil)}</Text> : null}
          </View>
        </View>

        <View style={[pdf.row, { gap: 10, marginBottom: 18 }]}>
          <PartyBlock title="Emisor" party={data.company} taxLabel="NIF" />
          <PartyBlock title="Cliente" party={data.client} taxLabel={intra ? "NIF-IVA" : "NIF"} />
        </View>

        <View style={pdf.tableHeader}>
          <Text style={COLS.desc}>Concepto</Text>
          <Text style={[COLS.qty, pdf.right]}>Cant.</Text>
          <Text style={[COLS.price, pdf.right]}>Precio</Text>
          <Text style={[COLS.vat, pdf.right]}>IVA</Text>
          <Text style={[COLS.amount, pdf.right]}>Importe</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={pdf.tableRow} wrap={false}>
            <Text style={COLS.desc}>{l.description}</Text>
            <Text style={[COLS.qty, pdf.right]}>{l.quantity}</Text>
            <Text style={[COLS.price, pdf.right]}>{formatCents(l.unitPriceCents)}</Text>
            <Text style={[COLS.vat, pdf.right]}>{l.vatRate} %</Text>
            <Text style={[COLS.amount, pdf.right]}>{formatCents(l.baseCents)}</Text>
          </View>
        ))}

        <View style={{ marginTop: 12, marginLeft: "auto", width: 230 }} wrap={false}>
          <View style={pdf.between}>
            <Text>Base imponible</Text>
            <Text>{formatCents(data.baseCents)}</Text>
          </View>
          {vatBreakdown(data.lines).map((r) => (
            <View key={r.vatRate} style={pdf.between}>
              <Text>
                IVA {r.vatRate} % sobre {formatCents(r.baseCents)}
              </Text>
              <Text>{formatCents(r.vatCents)}</Text>
            </View>
          ))}
          <View style={[pdf.between, { borderTopWidth: 1, marginTop: 4, paddingTop: 4 }]}>
            <Text style={[pdf.bold, { fontSize: 11 }]}>Total</Text>
            <Text style={[pdf.bold, { fontSize: 11 }]}>{formatCents(data.totalCents)}</Text>
          </View>
        </View>

        {intra ? (
          <Text style={pdf.note}>
            Inversión del sujeto pasivo (art. 196 de la Directiva 2006/112/CE). Prestación de servicios
            intracomunitaria: el IVA lo liquida el destinatario.
          </Text>
        ) : null}
        {!isQuote && data.company.iban ? (
          <Text style={{ marginTop: 12 }}>
            Forma de pago: transferencia bancaria a {formatIban(data.company.iban)}
          </Text>
        ) : null}
        {data.notes ? (
          <View style={{ marginTop: 12 }}>
            <Text style={pdf.label}>Notas</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}

        <Text style={pdf.footer} fixed>
          {isQuote ? "Este presupuesto no es una factura. " : ""}
          {data.company.name} · NIF {data.company.taxId} · Generado con EnerFactura
        </Text>
      </Page>
    </Document>
  );
}
