"use client";

import { useActionState } from "react";
import { markInvoicePaid } from "@/actions/invoices";
import { Button } from "@/components/ui/button";

export function MarkPaidButton({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) {
  const [state, action, pending] = useActionState(markInvoicePaid, { error: null });

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={invoiceId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Marcar ${invoiceNumber} como cobrada`}
      >
        {pending ? "Guardando…" : "Marcar cobrada"}
      </Button>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
