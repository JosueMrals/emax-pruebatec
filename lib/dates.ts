import { type Quarter, quarterOf } from "@/lib/fiscal/quarter";

// Today's calendar date in Spain as YYYY-MM-DD, independent of the server's timezone.
export function todayInSpain(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

// Calendar days are stored at UTC midnight; format them in UTC so they never shift a day.
export const dateFormat = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export function currentQuarter(): Quarter {
  return quarterOf(new Date(`${todayInSpain()}T00:00:00Z`));
}
