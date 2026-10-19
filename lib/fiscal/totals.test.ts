import assert from "node:assert/strict";
import { test } from "node:test";
import { invoiceTotals } from "./totals";
import { isEuVatNumber, operationTypeFor } from "./operations";

test("caso A: factura nacional, base 1.000 € al 21 % → total 1.210 €", () => {
  const t = invoiceTotals([{ quantity: 1, unitPriceCents: 100_000, vatRate: 21 }], "NACIONAL");
  assert.equal(t.baseCents, 100_000);
  assert.equal(t.vatCents, 21_000);
  assert.equal(t.totalCents, 121_000);
});

test("caso C: servicio a cliente alemán, base 2.000 € → IVA 0", () => {
  const op = operationTypeFor("DE");
  assert.equal(op, "INTRA_SERVICIOS");
  const t = invoiceTotals([{ quantity: 2, unitPriceCents: 100_000, vatRate: 21 }], op);
  assert.equal(t.baseCents, 200_000);
  assert.equal(t.vatCents, 0);
  assert.equal(t.totalCents, 200_000);
  assert.equal(t.lines[0].vatRate, 0);
});

test("varias líneas con tipos distintos suman el IVA por línea", () => {
  const t = invoiceTotals(
    [
      { quantity: 3, unitPriceCents: 1_000, vatRate: 21 },
      { quantity: 1, unitPriceCents: 999, vatRate: 10 },
      { quantity: 2, unitPriceCents: 250, vatRate: 4 },
      { quantity: 1, unitPriceCents: 500, vatRate: 0 },
    ],
    "NACIONAL",
  );
  assert.deepEqual(
    t.lines.map((l) => l.vatCents),
    [630, 100, 20, 0],
  );
  assert.equal(t.baseCents, 4_999);
  assert.equal(t.vatCents, 750);
  assert.equal(t.totalCents, 5_749);
});

test("NIF-IVA: prefijo del país obligatorio, Grecia usa EL", () => {
  assert.equal(isEuVatNumber("DE123456789", "DE"), true);
  assert.equal(isEuVatNumber("123456789", "DE"), false);
  assert.equal(isEuVatNumber("FR123456789", "DE"), false);
  assert.equal(isEuVatNumber("EL123456789", "GR"), true);
});
