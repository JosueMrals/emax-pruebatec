import assert from "node:assert/strict";
import { test } from "node:test";
import { type MatchCandidate, suggestMatches } from "./reconcile";

const invoiceA: MatchCandidate = {
  type: "invoice",
  id: "a",
  reference: "F-2026-0001",
  contactName: "Empresa Demo SL",
  date: "2026-10-19",
  totalCents: 121_000,
};
const invoiceOther: MatchCandidate = { ...invoiceA, id: "o", reference: "F-2026-0007", contactName: "Estudio Ejemplo SC", date: "2026-10-01" };
const expenseB: MatchCandidate = {
  type: "expense",
  id: "b",
  reference: "A-77",
  contactName: "Asesoría Ficticia SL",
  date: "2026-10-19",
  totalCents: 106_000,
};

test("cobro: solo facturas con el importe exacto; la referencia en el concepto manda", () => {
  const s = suggestMatches(
    { date: "2026-10-25", description: "TRANSF. EMPRESA DEMO SL F20260001", amountCents: 121_000 },
    [invoiceOther, invoiceA, expenseB],
  );
  assert.deepEqual(
    s.map((m) => m.id),
    ["a", "o"],
  );
  assert.ok(s[0].reasons.some((r) => r.includes("F-2026-0001")));
  assert.ok(s[0].reasons.some((r) => r.includes("Empresa Demo SL")));
});

test("pago: casa con gastos por importe absoluto y nombre del proveedor con tildes", () => {
  const s = suggestMatches({ date: "2026-10-21", description: "RECIBO ASESORIA FICTICIA", amountCents: -106_000 }, [
    invoiceA,
    expenseB,
  ]);
  assert.deepEqual(
    s.map((m) => m.id),
    ["b"],
  );
  assert.ok(s[0].reasons.some((r) => r.includes("Asesoría Ficticia SL")));
});

test("sin coincidencia de importe o con pago muy anterior al documento: nada", () => {
  assert.deepEqual(suggestMatches({ date: "2026-10-20", description: "X", amountCents: 121_001 }, [invoiceA]), []);
  assert.deepEqual(suggestMatches({ date: "2026-09-01", description: "X", amountCents: 121_000 }, [invoiceA]), []);
});

test("a igualdad de pistas, gana la fecha más cercana", () => {
  const near = { ...invoiceOther, id: "near", reference: null, contactName: "Otro", date: "2026-10-18" };
  const far = { ...near, id: "far", date: "2026-08-01" };
  assert.deepEqual(
    suggestMatches({ date: "2026-10-20", description: "INGRESO", amountCents: 121_000 }, [far, near]).map((m) => m.id),
    ["near", "far"],
  );
});
