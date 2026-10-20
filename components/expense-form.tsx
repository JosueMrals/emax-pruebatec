"use client";

import { useId, useState, useTransition } from "react";
import { createExpense } from "@/actions/expenses";
import { BankMovementNotice, BankTotalCheck } from "@/components/bank-target";
import { FieldError } from "@/components/field-error";
import { OcrUpload } from "@/components/ocr-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-errors";
import type { MovementPrefill } from "@/lib/bank/movement-prefill";
import { solveBaseForTotal } from "@/lib/fiscal/solve-base";
import { expenseTotals, IRPF_RATES } from "@/lib/fiscal/expenses";
import { VAT_RATES } from "@/lib/fiscal/totals";
import { centsToInput, formatCents, parseEurosToCents } from "@/lib/money";
import type { OcrResult } from "@/lib/ocr/expense-extraction";
import { normalizeTaxId } from "@/lib/tax-id";

export interface SupplierOption {
  id: string;
  name: string;
  taxId: string;
}

function baseForTotal(totalCents: number, vatRate: number, irpfRate: number) {
  return solveBaseForTotal(totalCents, (baseCents) => expenseTotals({ baseCents, vatRate, irpfRate }).totalCents);
}

export function ExpenseForm({
  suppliers,
  defaultDate,
  fromMovement,
  defaultSupplierId = "",
}: {
  suppliers: SupplierOption[];
  defaultDate: string;
  // Bank payment this expense is created from: prefills it and reconciles it on save.
  fromMovement?: MovementPrefill;
  defaultSupplierId?: string;
}) {
  const uid = useId();
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">(suppliers.length ? "existing" : "new");
  const [supplierId, setSupplierId] = useState(defaultSupplierId);
  const [newSupplier, setNewSupplier] = useState({ name: "", taxId: "" });
  const [date, setDate] = useState(fromMovement?.date ?? defaultDate);
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState(fromMovement?.description ?? "");
  const [base, setBase] = useState(() =>
    fromMovement ? centsToInput(baseForTotal(fromMovement.amountCents, 21, 0).baseCents) : "",
  );
  const [vatRate, setVatRate] = useState(21);
  const [irpfRate, setIrpfRate] = useState(0);
  const [deductible, setDeductible] = useState(true);
  const [ocrTotalCents, setOcrTotalCents] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [pending, startTransition] = useTransition();

  const baseCents = parseEurosToCents(base);
  // The preview treats an invalid base as zero; the server recomputes from validated input.
  const totals = expenseTotals({ baseCents: baseCents ?? 0, vatRate, irpfRate });

  const errors = result.fieldErrors ?? {};
  const errId = (key: string) => `${uid}-${key}-error`;
  const a11y = (key: string) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? errId(key) : undefined,
  });

  // Prefills every field the OCR could read and keeps the rest as they were.
  function applyOcr({ prefill, check }: OcrResult) {
    const match = prefill.supplierTaxId
      ? suppliers.find((s) => normalizeTaxId(s.taxId) === prefill.supplierTaxId)
      : undefined;
    if (match) {
      setSupplierMode("existing");
      setSupplierId(match.id);
    } else if (prefill.supplierName || prefill.supplierTaxId) {
      setSupplierMode("new");
      setNewSupplier({ name: prefill.supplierName, taxId: prefill.supplierTaxId });
    }
    if (prefill.date) setDate(prefill.date);
    if (prefill.number) setNumber(prefill.number);
    if (prefill.description) setDescription(prefill.description);
    if (prefill.base) setBase(prefill.base);
    if (prefill.vatRate !== null) setVatRate(prefill.vatRate);
    if (prefill.irpfRate !== null) setIrpfRate(prefill.irpfRate);
    setOcrTotalCents(check.totalCents);
    setResult({ error: null });
  }

  // Recomputes the base so base + IVA - IRPF equals the bank amount with the current rates.
  function adjustToBank(): boolean {
    if (!fromMovement) return false;
    const { baseCents: solved, exact } = baseForTotal(fromMovement.amountCents, vatRate, irpfRate);
    setBase(centsToInput(solved));
    return exact;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      supplier:
        supplierMode === "existing"
          ? { mode: "existing" as const, id: supplierId }
          : { mode: "new" as const, ...newSupplier },
      date,
      number,
      description,
      baseCents,
      vatRate,
      irpfRate,
      deductible,
      source: ocrTotalCents === null ? ("MANUAL" as const) : ("OCR" as const),
      movementId: fromMovement?.id ?? "",
    };
    startTransition(async () => {
      setResult(await createExpense(payload));
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="grid min-w-0 gap-6">
        {fromMovement && <BankMovementNotice movement={fromMovement} kind="expense" />}
        <OcrUpload onResult={applyOcr} />

        <Card>
          <CardHeader>
            <CardTitle>Proveedor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">Tipo de proveedor</legend>
              {(["existing", "new"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="supplierMode"
                    value={mode}
                    checked={supplierMode === mode}
                    onChange={() => setSupplierMode(mode)}
                    disabled={mode === "existing" && !suppliers.length}
                    className="size-4 accent-primary"
                  />
                  {mode === "existing" ? "Proveedor existente" : "Nuevo proveedor"}
                </label>
              ))}
            </fieldset>

            {supplierMode === "existing" ? (
              <div className="grid gap-2">
                <Label htmlFor={`${uid}-supplier`}>Proveedor</Label>
                <NativeSelect
                  id={`${uid}-supplier`}
                  className="w-full"
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  {...a11y("supplier.id")}
                >
                  <NativeSelectOption value="">Selecciona un proveedor…</NativeSelectOption>
                  {suppliers.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {s.name} · {s.taxId}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError id={errId("supplier.id")} message={errors["supplier.id"]} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                <div className="grid gap-2">
                  <Label htmlFor={`${uid}-name`}>Nombre o razón social</Label>
                  <Input
                    id={`${uid}-name`}
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                    {...a11y("supplier.name")}
                  />
                  <FieldError id={errId("supplier.name")} message={errors["supplier.name"]} />
                </div>
                <div className="grid content-start gap-2">
                  <Label htmlFor={`${uid}-taxid`}>NIF</Label>
                  <Input
                    id={`${uid}-taxid`}
                    placeholder="B12345678"
                    value={newSupplier.taxId}
                    onChange={(e) => setNewSupplier({ ...newSupplier, taxId: e.target.value })}
                    {...a11y("supplier.taxId")}
                  />
                  <FieldError id={errId("supplier.taxId")} message={errors["supplier.taxId"]} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gasto</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid content-start gap-2">
              <Label htmlFor={`${uid}-date`}>Fecha</Label>
              <Input
                id={`${uid}-date`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                {...a11y("date")}
              />
              <FieldError id={errId("date")} message={errors.date} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${uid}-number`}>Nº de factura del proveedor (opcional)</Label>
              <Input
                id={`${uid}-number`}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                {...a11y("number")}
              />
              <FieldError id={errId("number")} message={errors.number} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`${uid}-desc`}>Concepto</Label>
              <Input
                id={`${uid}-desc`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                {...a11y("description")}
              />
              <FieldError id={errId("description")} message={errors.description} />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${uid}-base`}>Base imponible (€)</Label>
              <Input
                id={`${uid}-base`}
                inputMode="decimal"
                placeholder="0,00"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                {...a11y("baseCents")}
              />
              <FieldError id={errId("baseCents")} message={errors.baseCents} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid content-start gap-2">
                <Label htmlFor={`${uid}-vat`}>IVA</Label>
                <NativeSelect
                  id={`${uid}-vat`}
                  className="w-full"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value))}
                >
                  {VAT_RATES.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {r} %
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid content-start gap-2">
                <Label htmlFor={`${uid}-irpf`}>Retención IRPF</Label>
                <NativeSelect
                  id={`${uid}-irpf`}
                  className="w-full"
                  value={irpfRate}
                  onChange={(e) => setIrpfRate(Number(e.target.value))}
                >
                  {IRPF_RATES.map((r) => (
                    <NativeSelectOption key={r} value={r}>
                      {r} %
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={deductible}
                onChange={(e) => setDeductible(e.target.checked)}
                className="size-4 accent-primary"
              />
              IVA deducible
            </label>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Base imponible</dt>
            <dd className="text-right tabular-nums">{formatCents(totals.baseCents)}</dd>
            <dt className="text-muted-foreground">IVA ({vatRate} %)</dt>
            <dd className="text-right tabular-nums">{formatCents(totals.vatCents)}</dd>
            <dt className="text-muted-foreground">IRPF ({irpfRate} %)</dt>
            <dd className="text-right tabular-nums">−{formatCents(totals.irpfCents)}</dd>
            <dt className="border-t pt-2 font-semibold">Total a pagar</dt>
            <dd className="border-t pt-2 text-right font-semibold tabular-nums">{formatCents(totals.totalCents)}</dd>
            {ocrTotalCents !== null && (
              <>
                <dt className="text-muted-foreground">Total en la factura</dt>
                <dd className="text-right tabular-nums">{formatCents(ocrTotalCents)}</dd>
              </>
            )}
          </dl>
          {fromMovement && (
            <BankTotalCheck targetCents={fromMovement.amountCents} totalCents={totals.totalCents} onAdjust={adjustToBank} />
          )}
          {ocrTotalCents !== null && Math.abs(ocrTotalCents - totals.totalCents) > 2 && (
            <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">
              El total calculado no coincide con el de la factura. Revisa la base y los tipos de IVA e IRPF.
            </p>
          )}
          {totals.irpfCents > 0 && (
            <p className="rounded-md bg-muted p-3 text-sm">
              La retención de {formatCents(totals.irpfCents)} la ingresas tú en Hacienda con el Modelo 111.
            </p>
          )}
          {!deductible && (
            <p className="rounded-md bg-muted p-3 text-sm">Este IVA no restará en el Modelo 303.</p>
          )}
          {result.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{result.error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Guardar gasto"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
