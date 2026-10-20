export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

// ISO 13616 check: move the first 4 chars to the end, letters to numbers, remainder mod 97 must be 1.
export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("ES") && iban.length !== 24) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  return remainder === 1;
}

// "ES9121000418450200051332" -> "ES91 2100 0418 4502 0005 1332"
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
