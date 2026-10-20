// Parses the CSV export of a Spanish bank into signed movements (positive = money in).

export interface ParsedMovement {
  date: string; // YYYY-MM-DD
  description: string;
  amountCents: number;
  importKey: string; // stable per movement, so re-importing the same file skips duplicates
}

export interface CsvParseResult {
  movements: ParsedMovement[];
  errors: { line: number; message: string }[];
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const HEADERS = {
  date: ["fecha", "fechaoperacion", "foperacion", "fechavalor", "fvalor", "date"],
  description: ["concepto", "descripcion", "description", "movimiento", "detalle", "conceptocomun"],
  amount: ["importe", "amount", "cantidad", "importeeur"],
  debit: ["cargo", "cargos", "debe", "debit"],
  credit: ["abono", "abonos", "haber", "credit"],
};

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

// "1.234,56" / "-1234.56" / "1,234.56" / "12,5 €" -> cents. The last separator is the decimal one,
// except a lone "." followed by three digits, which Spanish banks use for thousands ("1.234").
export function parseBankAmount(raw: string): number | null {
  let s = raw.replace(/[\s€]/g, "").replace(/^\+/, "");
  const negative = s.startsWith("-") || (s.startsWith("(") && s.endsWith(")"));
  s = s.replace(/^[-(]|\)$/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let decPart = "";
  if (lastComma > lastDot) {
    intPart = s.slice(0, lastComma).replace(/\./g, "");
    decPart = s.slice(lastComma + 1);
  } else if (lastDot > lastComma) {
    const after = s.slice(lastDot + 1);
    if (lastComma === -1 && after.length === 3 && s.indexOf(".") === lastDot) {
      intPart = s.replace(".", "");
    } else {
      intPart = s.slice(0, lastDot).replace(/,/g, "");
      decPart = after;
    }
  } else {
    intPart = s;
  }
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null;
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  return negative ? -cents : cents;
}

// dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy or yyyy-mm-dd -> YYYY-MM-DD.
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function findColumn(headers: string[], names: string[]): number {
  return headers.findIndex((h) => names.includes(normalize(h)));
}

export function parseBankCsv(text: string): CsvParseResult {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const errors: CsvParseResult["errors"] = [];

  // The header is the first line that names a date column; banks often add title rows above it.
  let headerIndex = -1;
  let delimiter = ";";
  let cols = { date: -1, description: -1, amount: -1, debit: -1, credit: -1 };
  for (let i = 0; i < Math.min(lines.length, 20) && headerIndex === -1; i++) {
    for (const d of [";", ",", "\t"]) {
      const cells = splitCsvLine(lines[i], d);
      const found = {
        date: findColumn(cells, HEADERS.date),
        description: findColumn(cells, HEADERS.description),
        amount: findColumn(cells, HEADERS.amount),
        debit: findColumn(cells, HEADERS.debit),
        credit: findColumn(cells, HEADERS.credit),
      };
      const hasAmount = found.amount !== -1 || (found.debit !== -1 && found.credit !== -1);
      if (found.date !== -1 && found.description !== -1 && hasAmount) {
        headerIndex = i;
        delimiter = d;
        cols = found;
        break;
      }
    }
  }
  if (headerIndex === -1) {
    return {
      movements: [],
      errors: [{ line: 1, message: "No se encontraron las columnas Fecha, Concepto e Importe (o Cargo y Abono)." }],
    };
  }

  const movements: ParsedMovement[] = [];
  const seen = new Map<string, number>();
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvLine(lines[i], delimiter);
    const lineNo = i + 1;
    const date = parseBankDate(cells[cols.date] ?? "");
    const description = (cells[cols.description] ?? "").replace(/\s+/g, " ").trim();

    let amountCents: number | null;
    if (cols.amount !== -1) {
      amountCents = parseBankAmount(cells[cols.amount] ?? "");
    } else {
      const debit = cells[cols.debit] ? parseBankAmount(cells[cols.debit]) : 0;
      const credit = cells[cols.credit] ? parseBankAmount(cells[cols.credit]) : 0;
      amountCents = debit === null || credit === null ? null : Math.abs(credit) - Math.abs(debit);
    }

    if (!date) {
      errors.push({ line: lineNo, message: "Fecha no válida" });
      continue;
    }
    if (amountCents === null || amountCents === 0) {
      errors.push({ line: lineNo, message: "Importe no válido" });
      continue;
    }
    if (!description) {
      errors.push({ line: lineNo, message: "Falta el concepto" });
      continue;
    }

    // Identical movements on the same day are legitimate (two equal card payments); number them.
    const base = `${date}|${amountCents}|${description.toLowerCase().slice(0, 200)}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    movements.push({ date, description: description.slice(0, 500), amountCents, importKey: `${base}|${occurrence}` });
  }
  return { movements, errors };
}
