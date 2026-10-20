import { z } from "zod";
import { getActiveCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { notFoundText, pdfResponse, salesDocumentPdf } from "@/lib/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/facturas/[id]/pdf">) {
  const { id } = await ctx.params;
  const company = await getActiveCompany();
  if (!company || !z.uuid().safeParse(id).success) return notFoundText("Factura no encontrada.");

  // Scoped to the active company: an id from another company is treated as not found.
  const invoice = await db.invoice.findFirst({
    where: { id, companyId: company.id },
    include: { client: true, lines: { orderBy: { id: "asc" } } },
  });
  if (!invoice) return notFoundText("Factura no encontrada.");

  return pdfResponse(salesDocumentPdf("invoice", company, invoice), `${invoice.number}.pdf`);
}
