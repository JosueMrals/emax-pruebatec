import Link from "next/link";
import { Suspense } from "react";
import { CompanyForm, type CompanyValues, EMPTY_COMPANY } from "@/components/company-form";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getActiveCompany } from "@/lib/company";
import { formatIban } from "@/lib/iban";

async function Settings({ searchParams }: { searchParams: PageProps<"/configuracion">["searchParams"] }) {
  const params = await searchParams;
  const company = await getActiveCompany();

  if (!company) {
    return (
      <>
        <PageHeader
          title="Configuración inicial"
          description="Crea tu empresa para empezar a emitir presupuestos y facturas."
        />
        <CompanyForm initial={EMPTY_COMPANY} />
      </>
    );
  }

  if (params.nueva === "1") {
    return (
      <>
        <PageHeader title="Nueva empresa" description="Cada empresa tiene sus propios contactos, documentos y banco." />
        <CompanyForm initial={EMPTY_COMPANY} />
      </>
    );
  }

  const values: CompanyValues = {
    id: company.id,
    name: company.name,
    taxId: company.taxId,
    address: company.address ?? "",
    postalCode: company.postalCode ?? "",
    city: company.city ?? "",
    email: company.email ?? "",
    iban: company.iban ? formatIban(company.iban) : "",
    invoicePrefix: company.invoicePrefix,
    quotePrefix: company.quotePrefix,
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Configuración" description="Datos de la empresa activa y series de numeración." />
        <Button asChild variant="outline">
          <Link href="/configuracion?nueva=1">Añadir otra empresa</Link>
        </Button>
      </div>
      {params.guardado === "1" && (
        <Alert role="status" className="mb-6">
          <AlertDescription>Cambios guardados.</AlertDescription>
        </Alert>
      )}
      <CompanyForm key={company.id} initial={values} />
    </>
  );
}

export default function ConfiguracionPage({ searchParams }: PageProps<"/configuracion">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <Settings searchParams={searchParams} />
    </Suspense>
  );
}
