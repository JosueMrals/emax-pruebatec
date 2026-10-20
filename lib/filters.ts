import { type Quarter, quarterRange, shiftQuarter } from "@/lib/fiscal/quarter";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

// Free-text search, capped so a crafted URL can't send huge LIKE patterns.
export function searchText(params: SearchParams): string {
  return param(params, "q").slice(0, 100);
}

export function pickOption<T extends string>(params: SearchParams, key: string, allowed: readonly T[]): T | undefined {
  const value = param(params, key);
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

// "2026-T4" -> { year: 2026, quarter: 4 }; anything else means "all periods".
export function parsePeriod(value: string): Quarter | null {
  const match = /^(\d{4})-T([1-4])$/.exec(value);
  return match ? { year: Number(match[1]), quarter: Number(match[2]) as Quarter["quarter"] } : null;
}

export function periodValue({ year, quarter }: Quarter): string {
  return `${year}-T${quarter}`;
}

// The current quarter and the previous ones, newest first, for the period selector.
export function periodOptions(current: Quarter, count = 8): { value: string; label: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const q = shiftQuarter(current, -i);
    return { value: periodValue(q), label: `${q.quarter}T ${q.year}` };
  });
}

export function periodDateFilter(params: SearchParams) {
  const period = parsePeriod(param(params, "periodo"));
  if (!period) return undefined;
  const { start, end } = quarterRange(period);
  return { gte: start, lt: end };
}
