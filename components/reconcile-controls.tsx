"use client";

import { useActionState, useId } from "react";
import { reconcileMovement, unreconcileMovement } from "@/actions/bank";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export interface SuggestionOption {
  value: string; // "invoice:<id>" | "expense:<id>"
  label: string;
  reasons: string[];
}

export function ReconcileForm({ movementId, suggestions }: { movementId: string; suggestions: SuggestionOption[] }) {
  const id = useId();
  const [state, action, pending] = useActionState(reconcileMovement, { error: null });
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="movementId" value={movementId} />
      <label htmlFor={id} className="sr-only">
        Documento con el que conciliar
      </label>
      <div className="flex flex-wrap gap-2">
        <NativeSelect id={id} name="target" size="sm" defaultValue={suggestions[0]?.value} className="min-w-0 flex-1">
          {suggestions.map((s) => (
            <NativeSelectOption key={s.value} value={s.value}>
              {s.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Conciliando…" : "Conciliar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{suggestions[0]?.reasons.join(" · ")}</p>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function UnreconcileButton({ movementId, label }: { movementId: string; label: string }) {
  const [state, action, pending] = useActionState(unreconcileMovement, { error: null });
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="movementId" value={movementId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label={`Deshacer conciliación: ${label}`}>
        {pending ? "Deshaciendo…" : "Deshacer"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
