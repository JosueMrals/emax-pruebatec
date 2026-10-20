import assert from "node:assert/strict";
import { test } from "node:test";
import { formatIban, isValidIban } from "./iban";

test("IBAN: valida el dígito de control", () => {
  assert.equal(isValidIban("ES91 2100 0418 4502 0005 1332"), true);
  assert.equal(isValidIban("es9121000418450200051332"), true);
  assert.equal(isValidIban("ES9121000418450200051333"), false);
  assert.equal(isValidIban("DE89370400440532013000"), true);
  assert.equal(isValidIban("ES91210004184502"), false);
  assert.equal(isValidIban("hola"), false);
});

test("IBAN: formato en bloques de 4", () => {
  assert.equal(formatIban("es9121000418450200051332"), "ES91 2100 0418 4502 0005 1332");
});
