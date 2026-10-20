import assert from "node:assert/strict";
import { test } from "node:test";
import { canChangeQuoteStatus, canConvertQuote, nextQuoteStatuses } from "./quotes";

test("presupuesto: circuito borrador → enviado → aceptado → facturable", () => {
  assert.equal(canChangeQuoteStatus("BORRADOR", "ENVIADO"), true);
  assert.equal(canChangeQuoteStatus("ENVIADO", "ACEPTADO"), true);
  assert.equal(canConvertQuote("ACEPTADO"), true);
});

test("presupuesto: solo se factura si está aceptado, y nunca a mano", () => {
  assert.equal(canConvertQuote("ENVIADO"), false);
  assert.equal(canConvertQuote("FACTURADO"), false);
  assert.equal(canChangeQuoteStatus("ACEPTADO", "FACTURADO"), false);
  assert.deepEqual(nextQuoteStatuses("FACTURADO"), []);
});

test("presupuesto rechazado puede volver a borrador para rehacerlo", () => {
  assert.equal(canChangeQuoteStatus("RECHAZADO", "BORRADOR"), true);
  assert.equal(canChangeQuoteStatus("RECHAZADO", "ACEPTADO"), false);
});
