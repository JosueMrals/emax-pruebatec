"use client";

import { useId, useRef, useState, useTransition } from "react";
import { createInvoice } from "@/actions/invoices";
import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EU_COUNTRIES, operationTypeFor } from "@/lib/fiscal/operations";
import { invoiceTotals, VAT_RATES } from "@/lib/fiscal/totals";
import type { ActionResult } from "@/lib/action-errors";
import { formatCents, parseEurosToCents } from "@/lib/money";

export interface ClientOption {
  id: string;
  name: string;
  taxId: string;
  countryCode: string;
}

interface LineState {
  key: number;
  description: string;
  quantity: string;
  price: string;
  vatRate: number;
}

export function InvoiceForm({ clients, defaultDate }: { clients: ClientOption[]; defaultDate: string }) {
  const uid = useId();
  const nextKey = useRef(1);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");
  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState({ name: "", taxId: "", countryCode: "ES", email: "" });
  const [issueDate, setIssueDate] = useState(defaultDate);
  const [lines, setLines] = useState<LineState[]>([{ key: 0, description: "", quantity: "1", price: "", vatRate: 21 }]);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [pending, startTransition] = useTransition();

  const countryCode =
    clientMode === "new" ? newClient.countryCode : (clients.find((c) => c.id === clientId)?.countryCode ?? "ES");
  const operationType = operationTypeFor(countryCode);
  const intra = operationType === "INTRA_SERVICIOS";

  const parsedLines = lines.map((l) => ({
    quantity: /^\d+$/.test(l.quantity.trim()) ? Number(l.quantity) : NaN,
    unitPriceCents: parseEurosToCents(l.price),
  }));
  // The preview treats incomplete lines as zero; the server recomputes from validated input.
  const totals = invoiceTotals(
    lines.map((l, i) => ({
      quantity: Number.isNaN(parsedLines[i].quantity) ? 0 : parsedLines[i].quantity,
      unitPriceCents: parsedLines[i].unitPriceCents ?? 0,
      vatRate: l.vatRate,
    })),
    operationType,
  );

  const errors = result.fieldErrors ?? {};
  const errId = (key: string) => `${uid}-${key}-error`;
  const a11y = (key: string) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? errId(key) : undefined,
  });

  function updateLine(key: number, patch: Partial<LineState>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      client:
        clientMode === "existing"
          ? { mode: "existing" as const, id: clientId }
          : { mode: "new" as const, ...newClient },
      issueDate,
      lines: lines.map((l, i) => ({
        description: l.description,
        quantity: parsedLines[i].quantity,
        unitPriceCents: parsedLines[i].unitPriceCents,
        vatRate: l.vatRate,
      })),
      notes,
    };
    startTransition(async () => {
      setResult(await createInvoice(payload));
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Tipo de cliente</legend>
              {(["existing", "new"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clientMode"
                    value={mode}
                    checked={clientMode === mode}
                    onChange={() => setClientMode(mode)}
                    disabled={mode === "existing" && !clients.length}
                    className="size-4 accent-primary"
                  />
                  {mode === "existing" ? "Cliente existente" : "Nuevo cliente"}
                </label>
              ))}
            </fieldset>

            {clientMode === "existing" ? (
              <div className="grid gap-2">
                <Label htmlFor={`${uid}-client`}>Cliente</Label>
                <NativeSelect
                  id={`${uid}-client`}
                  className="w-full"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  {...a11y("client.id")}
                >
                  <NativeSelectOption value="">Selecciona un cliente…</NativeSelectOption>
                  {clients.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name} · {c.taxId}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id={errId("client.id")} message={errors["client.id"]} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={`${uid}-name`}>Nombre o razón social</Label>
                  <Input
                    id={`${uid}-name`}
                    value={newClient.name}
                    onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                    {...a11y("client.name")}
                  />
                  <FieldError id={errId("client.name")} message={errors["client.name"]} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${uid}-country`}>País</Label>
                  <NativeSelect
                    id={`${uid}-country`}
                    className="w-full"
                    value={newClient.countryCode}
                    onChange={(e) => setNewClient({ ...newClient, countryCode: e.target.value })}
                    {...a11y("client.countryCode")}
                  >
                    {EU_COUNTRIES.map((c) => (
                      <NativeSelectOption key={c.code} value={c.code}>
                        {c.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <FieldError id={errId("client.countryCode")} message={errors["client.countryCode"]} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${uid}-taxid`}>{newClient.countryCode === "ES" ? "NIF" : "NIF-IVA"}</Label>
                  <Input
                    id={`${uid}-taxid`}
                    value={newClient.taxId}
                    placeholder={
                      newClient.countryCode === "ES"
                        ? "B12345678"
                        : `${newClient.countryCode === "GR" ? "EL" : newClient.countryCode}123456789`
                    }
                    onChange={(e) => setNewClient({ ...newClient, taxId: e.target.value })}
                    {...a11y("client.taxId")}
                  />
                  <FieldError id={errId("client.taxId")} message={errors["client.taxId"]} />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor={`${uid}-email`}>Email (opcional)</Label>
                  <Input
                    id={`${uid}-email`}
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    {...a11y("client.email")}
                  />
                  <FieldError id={errId("client.email")} message={errors["client.email"]} />
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:max-w-48">
              <Label htmlFor={`${uid}-date`}>Fecha de emisión</Label>
              <Input
                id={`${uid}-date`}
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                {...a11y("issueDate")}
              />
              <FieldError id={errId("issueDate")} message={errors.issueDate} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conceptos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {lines.map((line, i) => {
              const p = `lines.${i}`;
              return (
                <fieldset
                  key={line.key}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_6rem_9rem_6rem]"
                >
                  <legend className="sr-only">Línea {i + 1}</legend>
                  <div className="grid gap-2 sm:col-span-4">
                    <Label htmlFor={`${uid}-${p}-desc`}>Descripción</Label>
                    <Input
                      id={`${uid}-${p}-desc`}
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                      {...a11y(`${p}.description`)}
                    />
                    <FieldError id={errId(`${p}.description`)} message={errors[`${p}.description`]} />
                  </div>
                  <div className="grid content-start gap-2">
                    <Label htmlFor={`${uid}-${p}-qty`}>Cantidad</Label>
                    <Input
                      id={`${uid}-${p}-qty`}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      {...a11y(`${p}.quantity`)}
                    />
                    <FieldError id={errId(`${p}.quantity`)} message={errors[`${p}.quantity`]} />
                  </div>
                  <div className="grid content-start gap-2">
                    <Label htmlFor={`${uid}-${p}-price`}>Precio unitario (€)</Label>
                    <Input
                      id={`${uid}-${p}-price`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={line.price}
                      onChange={(e) => updateLine(line.key, { price: e.target.value })}
                      {...a11y(`${p}.unitPriceCents`)}
                    />
                    <FieldError id={errId(`${p}.unitPriceCents`)} message={errors[`${p}.unitPriceCents`]} />
                  </div>
                  <div className="grid content-start gap-2">
                    <Label htmlFor={`${uid}-${p}-vat`}>IVA</Label>
                    <NativeSelect
                      id={`${uid}-${p}-vat`}
                      className="w-full"
                      value={intra ? 0 : line.vatRate}
                      disabled={intra}
                      onChange={(e) => updateLine(line.key, { vatRate: Number(e.target.value) })}
                    >
                      {VAT_RATES.map((r) => (
                        <NativeSelectOption key={r} value={r}>
                          {r} %
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:col-span-4">
                    <span className="text-sm text-muted-foreground tabular-nums">
                      Importe: {formatCents(totals.lines[i].baseCents)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                      aria-label={`Eliminar línea ${i + 1}`}
                    >
                      Eliminar
                    </Button>
                  </div>
                </fieldset>
              );
            })}
            <FieldError id={errId("lines")} message={errors.lines} />
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                setLines((ls) => [...ls, { key: nextKey.current++, description: "", quantity: "1", price: "", vatRate: 21 }])
              }
            >
              Añadir línea
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-2">
          <Label htmlFor={`${uid}-notes`}>Notas (opcional)</Label>
          <Textarea id={`${uid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} {...a11y("notes")} />
          <FieldError id={errId("notes")} message={errors.notes} />
        </div>
      </div>

      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Base imponible</dt>
            <dd className="text-right tabular-nums">{formatCents(totals.baseCents)}</dd>
            <dt className="text-muted-foreground">IVA</dt>
            <dd className="text-right tabular-nums">{formatCents(totals.vatCents)}</dd>
            <dt className="border-t pt-2 font-semibold">Total</dt>
            <dd className="border-t pt-2 text-right font-semibold tabular-nums">{formatCents(totals.totalCents)}</dd>
          </dl>
          {intra && (
            <p className="rounded-md bg-muted p-3 text-sm">
              Servicio intracomunitario: IVA 0 % por inversión del sujeto pasivo. Se incluirá en el Modelo 349 con
              clave S.
            </p>
          )}
          {result.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Guardar factura"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
