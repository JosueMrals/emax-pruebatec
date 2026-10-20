import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePeriod, periodDateFilter, periodOptions, pickOption, searchText } from "./filters";

test("periodo: interpreta 2026-T4 y descarta valores no válidos", () => {
  assert.deepEqual(parsePeriod("2026-T4"), { year: 2026, quarter: 4 });
  assert.equal(parsePeriod("2026-T5"), null);
  assert.equal(parsePeriod(""), null);
  const range = periodDateFilter({ periodo: "2026-T1" });
  assert.equal(range?.gte.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(range?.lt.toISOString(), "2026-04-01T00:00:00.000Z");
  assert.equal(periodDateFilter({}), undefined);
});

test("opciones de periodo: trimestre actual y anteriores, cruzando el año", () => {
  assert.deepEqual(
    periodOptions({ year: 2026, quarter: 2 }, 3).map((o) => o.value),
    ["2026-T2", "2026-T1", "2025-T4"],
  );
});

test("opciones cerradas y búsqueda acotada", () => {
  assert.equal(pickOption({ estado: "COBRADA" }, "estado", ["PENDIENTE", "COBRADA"] as const), "COBRADA");
  assert.equal(pickOption({ estado: "BORRADA" }, "estado", ["PENDIENTE", "COBRADA"] as const), undefined);
  assert.equal(pickOption({ estado: ["PENDIENTE", "COBRADA"] }, "estado", ["PENDIENTE"] as const), "PENDIENTE");
  assert.equal(searchText({ q: `  ${"x".repeat(200)} ` }).length, 100);
});
