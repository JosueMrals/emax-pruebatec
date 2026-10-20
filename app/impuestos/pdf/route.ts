import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { TaxReportPdf } from "@/components/pdf/tax-report-pdf";
import { getActiveCompany } from "@/lib/company";
import { currentQuarter, dateFormat, todayInSpain } from "@/lib/dates";
import type { Quarter } from "@/lib/fiscal/quarter";
import { notFoundText, pdfResponse } from "@/lib/pdf";
import { loadQuarterTaxes } from "@/lib/taxes";

export async function GET(request: Request) {
  const company = await getActiveCompany();
  if (!company) return notFoundText("Configura tu empresa primero.");

  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const q = Number(url.searchParams.get("q"));
  const quarter: Quarter =
    Number.isInteger(year) && year >= 2000 && year <= 2100 && [1, 2, 3, 4].includes(q)
      ? { year, quarter: q as Quarter["quarter"] }
      : currentQuarter();

  const taxes = await loadQuarterTaxes(company.id, quarter);
  const document = createElement(TaxReportPdf, {
    company,
    quarter,
    taxes,
    generatedOn: dateFormat.format(new Date(`${todayInSpain()}T00:00:00Z`)),
  }) as unknown as ReactElement<DocumentProps>;

  return pdfResponse(document, `impuestos-${quarter.year}-${quarter.quarter}T.pdf`);
}
