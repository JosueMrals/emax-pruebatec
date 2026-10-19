export type OperationType = "NACIONAL" | "INTRA_SERVICIOS";

// EU member states. Greece uses the "EL" prefix in its VAT numbers.
export const EU_COUNTRIES = [
  { code: "ES", name: "España" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Bélgica" },
  { code: "BG", name: "Bulgaria" },
  { code: "CY", name: "Chipre" },
  { code: "CZ", name: "Chequia" },
  { code: "DE", name: "Alemania" },
  { code: "DK", name: "Dinamarca" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finlandia" },
  { code: "FR", name: "Francia" },
  { code: "GR", name: "Grecia" },
  { code: "HR", name: "Croacia" },
  { code: "HU", name: "Hungría" },
  { code: "IE", name: "Irlanda" },
  { code: "IT", name: "Italia" },
  { code: "LT", name: "Lituania" },
  { code: "LU", name: "Luxemburgo" },
  { code: "LV", name: "Letonia" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Países Bajos" },
  { code: "PL", name: "Polonia" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Rumanía" },
  { code: "SE", name: "Suecia" },
  { code: "SI", name: "Eslovenia" },
  { code: "SK", name: "Eslovaquia" },
] as const;

export type CountryCode = (typeof EU_COUNTRIES)[number]["code"];

export function isEuCountry(code: string): code is CountryCode {
  return EU_COUNTRIES.some((c) => c.code === code);
}

// Only services are in scope: a client in another EU country makes it an intra-community service.
export function operationTypeFor(countryCode: string): OperationType {
  return countryCode === "ES" ? "NACIONAL" : "INTRA_SERVICIOS";
}

// Format check only (prefix + 2-12 alphanumerics); it does not query VIES.
export function isEuVatNumber(taxId: string, countryCode: string): boolean {
  const prefix = countryCode === "GR" ? "EL" : countryCode;
  return new RegExp(`^${prefix}[0-9A-Z]{2,12}$`).test(taxId);
}
