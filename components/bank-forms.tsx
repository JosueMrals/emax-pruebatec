"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { addMovement, createBankAccount, type ImportResult, importMovements } from "@/actions/bank";
import { FieldError } from "@/components/field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-errors";
import { parseSignedEurosToCents } from "@/lib/money";

function useFieldErrors(result: ActionResult) {
  const uid = useId();
  const errors = result.fieldErrors ?? {};
  const errId = (key: string) => `${uid}-${key}-error`;
  return {
    uid,
    errors,
    errId,
    a11y: (key: string) => ({ "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? errId(key) : undefined }),
  };
}

export function ImportCsvForm({ accountId }: { accountId: string }) {
  const id = useId();
  const [state, action, pending] = useActionState<ImportResult, FormData>(importMovements, { error: null });
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="accountId" value={accountId} />
      <div className="grid gap-2">
        <Label htmlFor={id}>Extracto en CSV (máx. 1 MB)</Label>
        <Input id={id} name="file" type="file" accept=".csv,text/csv,text/plain" required />
        <p className="text-xs text-muted-foreground">
          Columnas Fecha, Concepto e Importe (o Cargo y Abono). Separador «;» o «,». Si vuelves a importar el mismo
          extracto, los movimientos repetidos se omiten.
        </p>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="justify-self-start">
        {pending ? "Importando…" : "Importar movimientos"}
      </Button>
      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.imported !== undefined && !state.error && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {state.imported} {state.imported === 1 ? "movimiento importado" : "movimientos importados"}
          {state.duplicates ? `, ${state.duplicates} ya existían` : ""}.
        </p>
      )}
      {state.lineErrors && state.lineErrors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {state.lineErrors.map((e) => (
            <li key={e.line}>
              Línea {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export function MovementForm({ accountId, defaultDate }: { accountId: string; defaultDate: string }) {
  const [values, setValues] = useState({ date: defaultDate, description: "", amount: "" });
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [pending, startTransition] = useTransition();
  const { uid, errors, errId, a11y } = useFieldErrors(result);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amountCents = parseSignedEurosToCents(values.amount);
    startTransition(async () => {
      const res = await addMovement({ accountId, date: values.date, description: values.description, amountCents });
      setResult(res);
      if (!res.error) setValues({ ...values, description: "", amount: "" });
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-[9rem_1fr_8rem_auto] sm:items-start">
      <div className="grid gap-2">
        <Label htmlFor={`${uid}-date`}>Fecha</Label>
        <Input
          id={`${uid}-date`}
          type="date"
          value={values.date}
          onChange={(e) => setValues({ ...values, date: e.target.value })}
          {...a11y("date")}
        />
        <FieldError id={errId("date")} message={errors.date} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${uid}-desc`}>Concepto</Label>
        <Input
          id={`${uid}-desc`}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          {...a11y("description")}
        />
        <FieldError id={errId("description")} message={errors.description} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${uid}-amount`}>Importe (€)</Label>
        <Input
          id={`${uid}-amount`}
          inputMode="decimal"
          placeholder="-25,50"
          value={values.amount}
          onChange={(e) => setValues({ ...values, amount: e.target.value })}
          {...a11y("amountCents")}
        />
        <FieldError id={errId("amountCents")} message={errors.amountCents} />
      </div>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        {pending ? "Guardando…" : "Añadir"}
      </Button>
      <p className="text-xs text-muted-foreground sm:col-span-4">Usa importe negativo para pagos y positivo para cobros.</p>
      {result.error && (
        <Alert variant="destructive" role="alert" className="sm:col-span-4">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

export function NewAccountForm() {
  const [values, setValues] = useState({ name: "", iban: "", opening: "" });
  const [result, setResult] = useState<ActionResult>({ error: null });
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const { uid, errors, errId, a11y } = useFieldErrors(result);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const openingBalanceCents = values.opening.trim() ? parseSignedEurosToCents(values.opening) : 0;
    startTransition(async () => {
      const res = await createBankAccount({ name: values.name, iban: values.iban, openingBalanceCents });
      setResult(res);
      if (!res.error) {
        setValues({ name: "", iban: "", opening: "" });
        setDone(true);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
      <div className="grid content-start gap-2">
        <Label htmlFor={`${uid}-name`}>Nombre</Label>
        <Input
          id={`${uid}-name`}
          placeholder="Cuenta de ahorro"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          {...a11y("name")}
        />
        <FieldError id={errId("name")} message={errors.name} />
      </div>
      <div className="grid content-start gap-2">
        <Label htmlFor={`${uid}-opening`}>Saldo inicial (€)</Label>
        <Input
          id={`${uid}-opening`}
          inputMode="decimal"
          placeholder="0,00"
          value={values.opening}
          onChange={(e) => setValues({ ...values, opening: e.target.value })}
          {...a11y("openingBalanceCents")}
        />
        <FieldError id={errId("openingBalanceCents")} message={errors.openingBalanceCents} />
      </div>
      <div className="grid content-start gap-2 sm:col-span-2">
        <Label htmlFor={`${uid}-iban`}>IBAN (opcional)</Label>
        <Input
          id={`${uid}-iban`}
          value={values.iban}
          onChange={(e) => setValues({ ...values, iban: e.target.value })}
          {...a11y("iban")}
        />
        <FieldError id={errId("iban")} message={errors.iban} />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
        {pending ? "Creando…" : "Crear cuenta"}
      </Button>
      {result.error && (
        <Alert variant="destructive" role="alert" className="sm:col-span-2">
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      )}
      {done && !result.error && (
        <p role="status" className="text-sm text-muted-foreground sm:col-span-2">
          Cuenta creada.
        </p>
      )}
    </form>
  );
}
