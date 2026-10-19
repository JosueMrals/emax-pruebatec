import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseTotals } from "./expenses";
import { type ExpenseForTaxes, type InvoiceForTaxes, modelo111, modelo303, modelo349 } from "./models";
import { operationTypeFor } from "./operations";
import { quarterOf, quarterRange, shiftQuarter } from "./quarter";
import { invoiceTotals } from "./totals";

function invoice(client: InvoiceForTaxes["client"], unitPriceCents: number, vatRate: number): InvoiceForTaxes {
  const operationType = operationTypeFor(client.countryCode);
  const t = invoiceTotals([{ quantity: 1, unitPriceCents, vatRate }], operationType);
  return { operationType, baseCents: t.baseCents, vatCents: t.vatCents, client };
}

function expense(supplierId: string, baseCents: number, vatRate: number, irpfRate: number, deductible = true): ExpenseForTaxes {
  return { supplierId, deductible, ...expenseTotals({ baseCents, vatRate, irpfRate }) };
}

const demo = { name: "Empresa Demo SL", taxId: "B00000001", countryCode: "ES" };
const beispiel = { name: "Beispiel Software GmbH", taxId: "DE000000003", countryCode: "DE" };

const caseA = invoice(demo, 100_000, 21);
const caseB = expense("asesoria", 100_000, 21, 15);
const caseC = invoice(beispiel, 200_000, 21);

test("caso A: la factura suma 210 € al IVA repercutido del 303", () => {
  const m = modelo303([caseA], []);
  assert.equal(m.repercutidoCents, 21_000);
  assert.equal(m.resultadoCents, 21_000);
});

test("caso B: el gasto suma 210 € al soportado del 303 y 150 € al 111", () => {
  assert.equal(modelo303([], [caseB]).soportadoCents, 21_000);
  assert.deepEqual(modelo111([caseB]), { perceptores: 1, baseCents: 100_000, retencionesCents: 15_000 });
});

test("caso C: servicio a Alemania aparece en el 349 con operador y clave S, sin IVA en el 303", () => {
  assert.deepEqual(modelo349([caseC]), {
    operadores: [{ ...beispiel, clave: "S", baseCents: 200_000 }],
    totalCents: 200_000,
  });
  const m = modelo303([caseC], []);
  assert.equal(m.repercutidoCents, 0);
  assert.equal(m.intraServiciosBaseCents, 200_000);
});

test("trimestre con A, B y C: 303 = 210 − 210 = 0, 111 = 150, 349 solo con C", () => {
  assert.equal(modelo303([caseA, caseC], [caseB]).resultadoCents, 0);
  assert.equal(modelo111([caseB]).retencionesCents, 15_000);
  assert.deepEqual(
    modelo349([caseA, caseC]).operadores.map((o) => o.taxId),
    ["DE000000003"],
  );
});

test("303: el IVA de gastos no deducibles no resta; resultado negativo es a compensar", () => {
  const m = modelo303([], [expense("s1", 10_000, 21, 0, false), expense("s2", 10_000, 21, 0)]);
  assert.equal(m.soportadoCents, 2_100);
  assert.equal(m.resultadoCents, -2_100);
});

test("111: cuenta perceptores distintos e ignora gastos sin retención", () => {
  const m = modelo111([expense("s1", 10_000, 21, 15), expense("s1", 20_000, 21, 15), expense("s2", 50_000, 21, 0)]);
  assert.deepEqual(m, { perceptores: 1, baseCents: 30_000, retencionesCents: 4_500 });
});

test("349: agrupa varias facturas del mismo NIF-IVA", () => {
  const fr = { name: "Exemple SARL", taxId: "FR12345678901", countryCode: "FR" };
  const m = modelo349([caseC, invoice(fr, 5_000, 21), invoice(beispiel, 1_000, 21)]);
  assert.deepEqual(
    m.operadores.map((o) => [o.taxId, o.baseCents]),
    [
      ["DE000000003", 201_000],
      ["FR12345678901", 5_000],
    ],
  );
  assert.equal(m.totalCents, 206_000);
});

test("trimestres: cálculo, rango semiabierto y cambio de año", () => {
  assert.deepEqual(quarterOf(new Date("2026-10-19T00:00:00Z")), { year: 2026, quarter: 4 });
  assert.deepEqual(quarterOf(new Date("2026-03-31T00:00:00Z")), { year: 2026, quarter: 1 });
  const r = quarterRange({ year: 2026, quarter: 4 });
  assert.equal(r.start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(r.end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.deepEqual(shiftQuarter({ year: 2026, quarter: 4 }, 1), { year: 2027, quarter: 1 });
  assert.deepEqual(shiftQuarter({ year: 2026, quarter: 1 }, -1), { year: 2025, quarter: 4 });
});
