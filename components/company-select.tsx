"use client";

import { useId } from "react";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

export function CompanySelect({
  companies,
  activeId,
  action,
}: {
  companies: { id: string; name: string }[];
  activeId: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const id = useId();
  return (
    <form action={action} className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Empresa activa
      </label>
      <NativeSelect
        id={id}
        name="companyId"
        size="sm"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-56"
      >
        {companies.map((c) => (
          <NativeSelectOption key={c.id} value={c.id}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <noscript>
        <button type="submit" className="text-sm underline">
          Cambiar
        </button>
      </noscript>
    </form>
  );
}
