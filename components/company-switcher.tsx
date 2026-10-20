import { switchCompany } from "@/actions/company";
import { CompanySelect } from "@/components/company-select";
import { getActiveCompany } from "@/lib/company";
import { db } from "@/lib/db";

export async function CompanySwitcher() {
  const active = await getActiveCompany();
  if (!active) return null;
  const companies = await db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <CompanySelect companies={companies} activeId={active.id} action={switchCompany} />;
}
