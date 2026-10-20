import assert from "node:assert/strict";
import { test } from "node:test";
import { nextDocumentNumber } from "./numbering";

test("numeración correlativa por serie y año", () => {
  assert.equal(nextDocumentNumber("F", 2026, null), "F-2026-0001");
  assert.equal(nextDocumentNumber("F", 2026, "F-2026-0009"), "F-2026-0010");
  assert.equal(nextDocumentNumber("P", 2026, "P-2026-0041"), "P-2026-0042");
});

test("empieza de nuevo en otra serie o año, e ignora números ajenos", () => {
  assert.equal(nextDocumentNumber("F", 2027, "F-2026-0120"), "F-2027-0001");
  assert.equal(nextDocumentNumber("FA", 2026, "F-2026-0003"), "FA-2026-0001");
  assert.equal(nextDocumentNumber("F", 2026, "F-2026-abc"), "F-2026-0001");
});
