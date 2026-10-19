import assert from "node:assert/strict";
import { test } from "node:test";
import { type InvoiceExtraction, toExpensePrefill } from "./expense-extraction";

const caseB: InvoiceExtraction = {
  supplier_name: "Asesoría Ficticia SL",
  supplier_tax_id: "B-00.000.004",
  invoice_number: "A-77",
  invoice_date: "2026-10-19",
  description: "Asesoría fiscal octubre",
  base_amount: 1000,
  vat_rate: 21,
  vat_amount: 210,
  irpf_rate: 15,
  irpf_amount: 150,
  total_amount: 1060,
};

test("caso B leído por OCR: prellena el formulario y la comprobación cuadra", () => {
  const r = toExpensePrefill(caseB);
  assert.deepEqual(r.prefill, {
    supplierName: "Asesoría Ficticia SL",
    supplierTaxId: "B00000004",
    number: "A-77",
    date: "2026-10-19",
    description: "Asesoría fiscal octubre",
    base: "1000,00",
    vatRate: 21,
    irpfRate: 15,
  });
  assert.deepEqual(r.check, { ok: true, totalCents: 106_000, expectedTotalCents: 106_000 });
  assert.deepEqual(r.warnings, []);
});

test("total que no cuadra: avisa pero sigue prellenando", () => {
  const r = toExpensePrefill({ ...caseB, total_amount: 1210 });
  assert.equal(r.check.ok, false);
  assert.equal(r.check.expectedTotalCents, 106_000);
  assert.match(r.warnings.join(" "), /no coincide con el total/);
  assert.equal(r.prefill.base, "1000,00");
});

test("tolera el redondeo de céntimos impreso en la factura", () => {
  const r = toExpensePrefill({ ...caseB, base_amount: 3.33, vat_amount: 0.7, irpf_amount: 0.5, total_amount: 3.54 });
  assert.equal(r.check.ok, true);
  assert.equal(r.prefill.base, "3,33");
});

test("deduce el tipo cuando falta o no es válido, y avisa si no puede", () => {
  assert.equal(toExpensePrefill({ ...caseB, vat_rate: null }).prefill.vatRate, 21);
  assert.equal(toExpensePrefill({ ...caseB, irpf_rate: null }).prefill.irpfRate, 15);
  const mixed = toExpensePrefill({ ...caseB, vat_rate: null, vat_amount: 155, total_amount: 1005 });
  assert.equal(mixed.prefill.vatRate, null);
  assert.match(mixed.warnings.join(" "), /tipo de IVA/);
});

test("sin retención: IRPF 0 y total = base + IVA", () => {
  const r = toExpensePrefill({ ...caseB, irpf_rate: null, irpf_amount: null, total_amount: 1210 });
  assert.equal(r.prefill.irpfRate, 0);
  assert.equal(r.check.ok, true);
});

test("campos ilegibles: deja vacío y avisa sin romper", () => {
  const r = toExpensePrefill({
    supplier_name: null,
    supplier_tax_id: null,
    invoice_number: null,
    invoice_date: "19/10/2026",
    description: null,
    base_amount: null,
    vat_rate: null,
    vat_amount: null,
    irpf_rate: null,
    irpf_amount: null,
    total_amount: 50,
  });
  assert.equal(r.prefill.date, "");
  assert.equal(r.prefill.base, "");
  assert.equal(r.check.ok, null);
  assert.ok(r.warnings.length >= 4);
});
