export interface Quarter {
  year: number;
  quarter: 1 | 2 | 3 | 4;
}

// Dates are calendar days stored at UTC midnight, so quarters are computed in UTC.
export function quarterOf(date: Date): Quarter {
  return { year: date.getUTCFullYear(), quarter: (Math.floor(date.getUTCMonth() / 3) + 1) as Quarter["quarter"] };
}

// Half-open range [start, end) for filtering by date.
export function quarterRange({ year, quarter }: Quarter): { start: Date; end: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 1)),
  };
}

export function shiftQuarter({ year, quarter }: Quarter, delta: number): Quarter {
  const index = year * 4 + (quarter - 1) + delta;
  return { year: Math.floor(index / 4), quarter: ((index % 4) + 1) as Quarter["quarter"] };
}
