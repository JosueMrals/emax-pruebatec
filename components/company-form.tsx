"use client";

import { useId, useState, useTransition } from "react";
import { saveCompany } from "@/actions/company";
import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-errors";
import { parseSignedEurosToCents } from "@/lib/money";

export interface CompanyValues {
  id: string;
  name: string;
  taxId: string;
  address: string;
  postalCode: string;
  city: string;
  email: string;
  iban: string;
  invoicePrefix: string;
  quotePrefix: string;
}

export const EMPTY_COMPANY: CompanyValues = {
  id: "",
  name: "",
  taxId: "",
  address: "",
  postalCode: "",
  city: "",
  email: "",
  iban: "",
  invoicePrefix: "F",
  quotePrefix: "P",
};

const FIELDS: { key: keyof CompanyValues; label: string; placeholder?: string; wide?: boolean; type?: string }[] = [
  { key: "name", label: "Nombre o razón social", wide: true },
  { key: "taxId", label: "NIF", placeholder: "B12345678" },
  { key: "email", label: "Email (opcional)", type: "email" },
  { key: "address", label: "Dirección (opcional)", wide: true },
  { key: "postalCode", label: "Código postal (opcional)", placeholder: "28001" },
  { key: "city", label: "Ciudad (opcional)" },
  { key: "iban", label: "IBAN para cobros (opcional)", placeholder: "ES91 2100 0418 4502 0005 1332", wide: true },
  { key: "invoicePrefix", label: "Serie de facturas", placeholder: "F" },
  { key: "quotePrefix", label: "Serie de presupuestos", placeholder: "P" },
];

export function CompanyForm({ initial }: { initial: CompanyValues }) {
  const uid = useId();
  const creating = !initial.id;
  const [values, setValues] = useState(initial);
  const [openingBalance, setOpeningBalance] = useState("");
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [pending, startTransition] = useTransition();

  const errors = result.fieldErrors ?? {};
  const errId = (key: string) => `${uid}-${key}-error`;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const openingBalanceCents = openingBalance.trim() === "" ? null : parseSignedEurosToCents(openingBalance);
    if (creating && openingBalance.trim() !== "" && openingBalanceCents === null) {
      setResult({ error: "Revisa los campos marcados.", fieldErrors: { openingBalanceCents: "Saldo no válido" } });
      return;
    }
    startTransition(async () => {
      setResult(await saveCompany({ ...values, openingBalanceCents }));
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{creating ? "Datos de la empresa" : "Datos de la empresa activa"}</CardTitle>
          <CardDescription>Aparecen como emisor en las facturas y presupuestos en PDF.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, placeholder, wide, type }) => (
            <div key={key} className={`grid content-start gap-2 ${wide ? "sm:col-span-2" : ""}`}>
              <Label htmlFor={`${uid}-${key}`}>{label}</Label>
              <Input
                id={`${uid}-${key}`}
                type={type}
                placeholder={placeholder}
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                aria-invalid={!!errors[key]}
                aria-describedby={errors[key] ? errId(key) : undefined}
              />
              <FieldError id={errId(key)} message={errors[key]} />
            </div>
          ))}
          {creating && (
            <div className="grid content-start gap-2 sm:col-span-2">
              <Label htmlFor={`${uid}-opening`}>Saldo actual de la cuenta bancaria (€, opcional)</Label>
              <Input
                id={`${uid}-opening`}
                inputMode="decimal"
                placeholder="0,00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                aria-invalid={!!errors.openingBalanceCents}
                aria-describedby={errors.openingBalanceCents ? errId("openingBalanceCents") : undefined}
              />
              <FieldError id={errId("openingBalanceCents")} message={errors.openingBalanceCents} />
              <p className="text-sm text-muted-foreground">
                Se crea la «Cuenta principal» con este saldo para importar movimientos y conciliar.
              </p>
            </div>
          )}
          {result.error && (
            <Alert variant="destructive" role="alert" className="sm:col-span-2">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={pending} className="justify-self-start sm:col-span-2">
            {pending ? "Guardando…" : creating ? "Crear empresa" : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
