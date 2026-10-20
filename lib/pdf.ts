import "server-only";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { SalesPdfData } from "@/components/pdf/sales-document-pdf";
import { SalesDocumentPdf } from "@/components/pdf/sales-document-pdf";
import type { Company, Client, InvoiceLine, QuoteLine } from "@/lib/generated/prisma/client";

export async function pdfResponse(document: ReactElement<DocumentProps>, filename: string): Promise<Response> {
  const buffer = await renderToBuffer(document);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: opens in the browser's viewer, from where it can be saved or printed.
      "Content-Disposition": `inline; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export function notFoundText(message: string): Response {
  return new Response(message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

interface StoredSalesDocument {
  number: string;
  issueDate: Date;
  validUntil?: Date | null;
  operationType: SalesPdfData["operationType"];
  notes: string | null;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  client: Client;
  lines: (InvoiceLine | QuoteLine)[];
}

export function salesDocumentPdf(kind: SalesPdfData["kind"], company: Company, doc: StoredSalesDocument) {
  return createElement(SalesDocumentPdf, {
    data: {
      kind,
      number: doc.number,
      issueDate: doc.issueDate,
      validUntil: doc.validUntil,
      operationType: doc.operationType,
      notes: doc.notes,
      company,
      client: doc.client,
      lines: doc.lines,
      baseCents: doc.baseCents,
      vatCents: doc.vatCents,
      totalCents: doc.totalCents,
    },
  }) as unknown as ReactElement<DocumentProps>;
}
