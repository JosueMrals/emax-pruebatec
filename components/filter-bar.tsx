import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { param, type SearchParams } from "@/lib/filters";

export type FilterField =
  | { type: "search"; name: string; label: string; placeholder: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[]; allLabel: string };

// A plain GET form: filters live in the URL, work without JavaScript and can be shared.
export function FilterBar({
  action,
  fields,
  params,
  resultCount,
  hidden = {},
}: {
  action: string;
  fields: FilterField[];
  params: SearchParams;
  resultCount: number;
  // Context that must survive filtering, e.g. the selected bank account.
  hidden?: Record<string, string>;
}) {
  const active = fields.some((f) => param(params, f.name));
  const clearHref = Object.keys(hidden).length ? `${action}?${new URLSearchParams(hidden)}` : action;
  return (
    <form action={action} method="get" role="search" className="mb-4 grid gap-3 rounded-lg border p-3">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.name} className={`grid gap-1.5 ${f.type === "search" ? "sm:col-span-2 lg:col-span-1" : ""}`}>
            <label htmlFor={`filtro-${f.name}`} className="text-xs font-medium text-muted-foreground">
              {f.label}
            </label>
            {f.type === "search" ? (
              <Input
                id={`filtro-${f.name}`}
                name={f.name}
                type="search"
                placeholder={f.placeholder}
                defaultValue={param(params, f.name)}
              />
            ) : (
              <NativeSelect id={`filtro-${f.name}`} name={f.name} defaultValue={param(params, f.name)} className="w-full">
                <NativeSelectOption value="">{f.allLabel}</NativeSelectOption>
                {f.options.map((o) => (
                  <NativeSelectOption key={o.value} value={o.value}>
                    {o.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {active && (
          <Button asChild variant="ghost" size="sm">
            <Link href={clearHref}>Quitar filtros</Link>
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {resultCount} {resultCount === 1 ? "resultado" : "resultados"}
        </span>
      </div>
    </form>
  );
}
