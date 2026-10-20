import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBankAmount, parseBankCsv, parseBankDate } from "./csv";

test("importes en formatos de banco español", () => {
  assert.equal(parseBankAmount("1.210,00"), 121_000);
  assert.equal(parseBankAmount("-1.060,00 €"), -106_000);
  assert.equal(parseBankAmount("1234.5"), 123_450);
  assert.equal(parseBankAmount("1,234.56"), 123_456);
  assert.equal(parseBankAmount("1.234"), 123_400);
  assert.equal(parseBankAmount("+25"), 2_500);
  assert.equal(parseBankAmount("(12,30)"), -1_230);
  assert.equal(parseBankAmount("12,345"), null);
  assert.equal(parseBankAmount("abc"), null);
});

test("fechas dd/mm/aaaa, dd-mm-aa e ISO; rechaza fechas imposibles", () => {
  assert.equal(parseBankDate("19/10/2026"), "2026-10-19");
  assert.equal(parseBankDate("5-1-26"), "2026-01-05");
  assert.equal(parseBankDate("2026-10-19"), "2026-10-19");
  assert.equal(parseBankDate("31/02/2026"), null);
  assert.equal(parseBankDate("ayer"), null);
});

test("CSV con títulos encima, punto y coma y comillas", () => {
  const csv = [
    "﻿Extracto de cuenta;;",
    "Cuenta ES91 2100 0418 4502 0005 1332;;",
    "Fecha;Concepto;Importe;Saldo",
    '20/10/2026;"TRANSFERENCIA DE EMPRESA DEMO SL; F-2026-0001";1.210,00;6.210,00',
    "21/10/2026;RECIBO ASESORIA FICTICIA SL;-1.060,00;5.150,00",
    "",
  ].join("\r\n");
  const { movements, errors } = parseBankCsv(csv);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    movements.map((m) => [m.date, m.description, m.amountCents]),
    [
      ["2026-10-20", "TRANSFERENCIA DE EMPRESA DEMO SL; F-2026-0001", 121_000],
      ["2026-10-21", "RECIBO ASESORIA FICTICIA SL", -106_000],
    ],
  );
});

test("CSV con columnas de cargo y abono separadas por comas", () => {
  const csv = "F. Valor,Descripción,Cargo,Abono\n01/10/2026,Cuota autónomo,300.00,\n02/10/2026,Cobro cliente,,500.00\n";
  assert.deepEqual(
    parseBankCsv(csv).movements.map((m) => m.amountCents),
    [-30_000, 50_000],
  );
});

test("movimientos idénticos el mismo día tienen claves distintas y estables", () => {
  const csv = "Fecha;Concepto;Importe\n01/10/2026;CAFE;-2,50\n01/10/2026;CAFE;-2,50\n";
  const a = parseBankCsv(csv).movements.map((m) => m.importKey);
  const b = parseBankCsv(csv).movements.map((m) => m.importKey);
  assert.equal(new Set(a).size, 2);
  assert.deepEqual(a, b);
});

test("líneas erróneas se informan sin bloquear el resto, y sin cabecera se avisa", () => {
  const csv = "Fecha;Concepto;Importe\n32/10/2026;X;1\n01/10/2026;Y;abc\n02/10/2026;Z;10\n";
  const r = parseBankCsv(csv);
  assert.equal(r.movements.length, 1);
  assert.deepEqual(
    r.errors.map((e) => e.line),
    [2, 3],
  );
  assert.equal(parseBankCsv("a;b;c\n1;2;3").errors.length, 1);
});
