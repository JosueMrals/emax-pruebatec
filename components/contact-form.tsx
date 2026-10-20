"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { deleteContact, saveContact } from "@/actions/contacts";
import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-errors";
import { EU_COUNTRIES } from "@/lib/fiscal/operations";

export interface ContactValues {
  kind: "client" | "supplier";
  id: string;
  name: string;
  taxId: string;
  countryCode: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  notes: string;
}

export function ContactForm({ initial }: { initial: ContactValues }) {
  const uid = useId();
  const [values, setValues] = useState(initial);
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [pending, startTransition] = useTransition();
  const errors = result.fieldErrors ?? {};
  const errId = (key: string) => `${uid}-${key}-error`;
  const isClient = values.kind === "client";

  const field = (key: keyof ContactValues, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid content-start gap-2">
      <Label htmlFor={`${uid}-${key}`}>{label}</Label>
      <Input
        id={`${uid}-${key}`}
        value={values[key]}
        onChange={(e) => setValues({ ...values, [key]: e.target.value })}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? errId(key) : undefined}
        {...props}
      />
      <FieldError id={errId(key)} message={errors[key]} />
    </div>
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => setResult(await saveContact(values)));
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>{isClient ? "Datos del cliente" : "Datos del proveedor"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("name", "Nombre o razón social")}</div>
          {isClient ? (
            <div className="grid content-start gap-2">
              <Label htmlFor={`${uid}-country`}>País</Label>
              <NativeSelect
                id={`${uid}-country`}
                className="w-full"
                value={values.countryCode}
                onChange={(e) => setValues({ ...values, countryCode: e.target.value })}
                aria-invalid={!!errors.countryCode}
                aria-describedby={errors.countryCode ? errId("countryCode") : undefined}
              >
                {EU_COUNTRIES.map((c) => (
                  <NativeSelectOption key={c.code} value={c.code}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError id={errId("countryCode")} message={errors.countryCode} />
            </div>
          ) : null}
          {field("taxId", values.countryCode === "ES" ? "NIF" : "NIF-IVA", {
            placeholder: values.countryCode === "ES" ? "B12345678" : `${values.countryCode}123456789`,
          })}
          {field("email", "Email (opcional)", { type: "email" })}
          {field("phone", "Teléfono (opcional)", { type: "tel" })}
          <div className="sm:col-span-2">{field("address", "Dirección (opcional)")}</div>
          {field("postalCode", "Código postal (opcional)")}
          {field("city", "Ciudad (opcional)")}
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`${uid}-notes`}>Notas internas (opcional)</Label>
            <Textarea
              id={`${uid}-notes`}
              value={values.notes}
              onChange={(e) => setValues({ ...values, notes: e.target.value })}
            />
          </div>
          {result.error && (
            <Alert variant="destructive" role="alert" className="sm:col-span-2">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={pending} className="justify-self-start">
            {pending ? "Guardando…" : values.id ? "Guardar cambios" : "Crear contacto"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}

export function DeleteContactButton({ kind, id, name }: { kind: ContactValues["kind"]; id: string; name: string }) {
  const [state, action, pending] = useActionState(deleteContact, { error: null });
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) e.preventDefault();
      }}
      className="grid justify-items-start gap-1"
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Eliminando…" : "Eliminar contacto"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
