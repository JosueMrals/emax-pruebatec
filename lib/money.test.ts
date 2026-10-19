import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEurosToCents } from "./money";

test("parseEurosToCents convierte sin errores de coma flotante", () => {
  assert.equal(parseEurosToCents("1000"), 100_000);
  assert.equal(parseEurosToCents("1000,5"), 100_050);
  assert.equal(parseEurosToCents("1.005"), null);
  assert.equal(parseEurosToCents("1,005"), null);
  assert.equal(parseEurosToCents("0.29"), 29);
  assert.equal(parseEurosToCents("-5"), null);
  assert.equal(parseEurosToCents(""), null);
});
