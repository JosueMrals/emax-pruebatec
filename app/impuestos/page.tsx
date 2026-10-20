import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { TaxSummary } from "@/components/tax-summary";
import { Button } from "@/components/ui/button";
import { currentQuarter } from "@/lib/dates";
import { type Quarter, shiftQuarter } from "@/lib/fiscal/quarter";

// Falls back to the current quarter when the query string is missing or malformed.
function parseQuarter(params: { year?: string | string[]; q?: string | string[] }): Quarter {
  const year = Number(params.year);
  const quarter = Number(params.q);
  if (Number.isInteger(year) && year >= 2000 && year <= 2100 && [1, 2, 3, 4].includes(quarter)) {
    return { year, quarter: quarter as Quarter["quarter"] };
  }
  return currentQuarter();
}

const href = ({ year, quarter }: Quarter) => `/impuestos?year=${year}&q=${quarter}`;
const label = ({ year, quarter }: Quarter) => `${quarter}T ${year}`;

async function QuarterTaxes({ searchParams }: { searchParams: PageProps<"/impuestos">["searchParams"] }) {
  // The default quarter depends on today's date, so this must render at request time.
  await connection();
  const quarter = parseQuarter(await searchParams);
  const prev = shiftQuarter(quarter, -1);
  const next = shiftQuarter(quarter, 1);

  return (
    <div className="grid gap-6">
      <nav aria-label="Trimestre" className="flex items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={href(prev)} aria-label={`Trimestre anterior: ${label(prev)}`}>
            ← {label(prev)}
          </Link>
        </Button>
        <h2 className="text-lg font-semibold tabular-nums">{label(quarter)}</h2>
        <Button asChild variant="outline" size="sm">
          <Link href={href(next)} aria-label={`Trimestre siguiente: ${label(next)}`}>
            {label(next)} →
          </Link>
        </Button>
      </nav>
      <Button asChild variant="secondary" className="justify-self-start">
        <a href={`/impuestos/pdf?year=${quarter.year}&q=${quarter.quarter}`}>Descargar PDF del {label(quarter)}</a>
      </Button>
      <TaxSummary quarter={quarter} />
    </div>
  );
}

export default function ImpuestosPage({ searchParams }: PageProps<"/impuestos">) {
  return (
    <>
      <PageHeader
        title="Impuestos"
        description="Estimación de los modelos 303, 111 y 349 por trimestre. No son declaraciones oficiales."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Calculando…</p>}>
        <QuarterTaxes searchParams={searchParams} />
      </Suspense>
    </>
  );
}
