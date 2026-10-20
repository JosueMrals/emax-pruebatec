import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { PageHeader } from "@/components/page-header";

async function NewContact({ searchParams }: { searchParams: PageProps<"/contactos/nuevo">["searchParams"] }) {
  const kind = (await searchParams).tipo === "proveedores" ? "supplier" : "client";
  return (
    <>
      <PageHeader title={kind === "client" ? "Nuevo cliente" : "Nuevo proveedor"} />
      <ContactForm
        initial={{
          kind,
          id: "",
          name: "",
          taxId: "",
          countryCode: "ES",
          email: "",
          phone: "",
          address: "",
          postalCode: "",
          city: "",
          notes: "",
        }}
      />
    </>
  );
}

export default function NuevoContactoPage({ searchParams }: PageProps<"/contactos/nuevo">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
      <NewContact searchParams={searchParams} />
    </Suspense>
  );
}
