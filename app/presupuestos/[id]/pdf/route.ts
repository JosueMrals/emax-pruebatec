import { z } from "zod";
import { getActiveCompany } from "@/lib/company";
import { db } from "@/lib/db";
import { notFoundText, pdfResponse, salesDocumentPdf } from "@/lib/pdf";

export async function GET(_request: Request, ctx: RouteContext<"/presupuestos/[id]/pdf">) {
  const { id } = await ctx.params;
  const company = await getActiveCompany();
  if (!company || !z.uuid().safeParse(id).success) return notFoundText("Presupuesto no encontrado.");

  const quote = await db.quote.findFirst({
    where: { id, companyId: company.id },
    include: { client: true, lines: { orderBy: { id: "asc" } } },
  });
  if (!quote) return notFoundText("Presupuesto no encontrado.");

  return pdfResponse(salesDocumentPdf("quote", company, quote), `${quote.number}.pdf`);
}
