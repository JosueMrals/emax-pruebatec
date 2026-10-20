// End-to-end circuit against the real database (npm run test:e2e).
// Runs the real Server Actions with Next request APIs mocked, inside a throwaway company that is
// always deleted at the end, so existing data is never touched.
import { mock } from "node:test";
import { loadEnvConfig } from "@next/env";

const jar = new Map<string, string>();
mock.module("next/headers", {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
      set: (name: string, value: string) => void jar.set(name, value),
    }),
  },
});
mock.module("next/navigation", {
  namedExports: {
    redirect: (to: string) => {
      throw Object.assign(new Error("redirect"), { digest: `NEXT_REDIRECT;${to}` });
    },
    notFound: () => {
      throw new Error("notFound");
    },
  },
});
mock.module("next/cache", { namedExports: { refresh: () => {} } });
loadEnvConfig(process.cwd());

const TEST_COMPANY_COOKIE = "__test_company";
let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${detail ? ` · ${detail}` : ""}`);
}
async function run(p: Promise<unknown>): Promise<{ redirect?: string; result?: Record<string, unknown> }> {
  try {
    return { result: (await p) as Record<string, unknown> };
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (digest?.startsWith("NEXT_REDIRECT;")) return { redirect: digest.split(";")[1] };
    throw e;
  }
}
const fd = (o: Record<string, string | Blob>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

async function main() {
  const { saveCompany } = await import("../actions/company");
  const { saveContact } = await import("../actions/contacts");
  const { createQuote, changeQuoteStatus, convertQuoteToInvoice } = await import("../actions/quotes");
  const { createInvoice, markInvoicePaid } = await import("../actions/invoices");
  const { createExpense } = await import("../actions/expenses");
  const { addMovement, importMovements, reconcileMovement, unreconcileMovement } = await import("../actions/bank");
  const { solveBaseForTotal } = await import("../lib/fiscal/solve-base");
  const { invoiceTotals } = await import("../lib/fiscal/totals");
  const { db } = await import("../lib/db");

  try {
  // 1. Initial setup: a new company with its main bank account.
  const created = await run(
    saveCompany({
      id: "",
      name: "Circuito E2E SL",
      taxId: "B99999990",
      address: "Calle Prueba 1",
      postalCode: "28080",
      city: "Madrid",
      email: "",
      iban: "ES91 2100 0418 4502 0005 1332",
      invoicePrefix: "F",
      quotePrefix: "P",
      openingBalanceCents: 100_000,
    }),
  );
  const companyId = jar.get("empresa")!;
  jar.set(TEST_COMPANY_COOKIE, companyId);
  check("configuración inicial crea empresa y la activa", created.redirect === "/" && !!companyId);
  const account = await db.bankAccount.findFirstOrThrow({ where: { companyId } });
  check("cuenta principal creada con saldo inicial", account.openingBalanceCents === 100_000);
  const badIban = await run(saveCompany({ ...{ id: "", name: "X SL", taxId: "B99999991", address: "", postalCode: "", city: "", email: "" }, iban: "ES9121000418450200051333", invoicePrefix: "F", quotePrefix: "P", openingBalanceCents: null }));
  check("IBAN con dígito de control erróneo se rechaza", !!(badIban.result?.fieldErrors as Record<string, string>)?.iban);

  // 2. Advanced contacts.
  const contact = (o: Record<string, string>) => ({ id: "", countryCode: "ES", email: "", phone: "", address: "", postalCode: "", city: "", notes: "", ...o });
  await run(saveContact(contact({ kind: "client", name: "Empresa Demo SL", taxId: "B00000001", phone: "+34 600 000 000", city: "Madrid" })));
  await run(saveContact(contact({ kind: "client", name: "Beispiel Software GmbH", taxId: "DE000000003", countryCode: "DE" })));
  await run(saveContact(contact({ kind: "supplier", name: "Asesoría Ficticia SL", taxId: "B00000004" })));
  const deNoVat = await run(saveContact(contact({ kind: "client", name: "Sin Prefijo GmbH", taxId: "123456789", countryCode: "DE" })));
  check("cliente UE sin NIF-IVA se rechaza", !!deNoVat.result?.error);
  const client = await db.client.findFirstOrThrow({ where: { companyId, taxId: "B00000001" } });
  const de = await db.client.findFirstOrThrow({ where: { companyId, taxId: "DE000000003" } });
  const supplier = await db.supplier.findFirstOrThrow({ where: { companyId, taxId: "B00000004" } });
  check("contactos con datos ampliados", client.phone === "+34 600 000 000" && client.city === "Madrid");

  // 3. Quote -> sent -> accepted -> invoice (case A).
  const line = (unitPriceCents: number) => [{ description: "Consultoría", quantity: 1, unitPriceCents, vatRate: 21 }];
  await run(createQuote({ client: { mode: "existing", id: client.id }, issueDate: "2026-10-19", validUntil: "2026-11-19", lines: line(100_000), notes: "" }));
  const quote = await db.quote.findFirstOrThrow({ where: { companyId } });
  check("presupuesto numerado P-2026-0001 con total 1.210 €", quote.number === "P-2026-0001" && quote.totalCents === 121_000);
  const early = await run(convertQuoteToInvoice({ error: null }, fd({ id: quote.id })));
  check("no se factura un presupuesto en borrador", !!early.result?.error);
  await run(changeQuoteStatus({ error: null }, fd({ id: quote.id, status: "ENVIADO" })));
  await run(changeQuoteStatus({ error: null }, fd({ id: quote.id, status: "ACEPTADO" })));
  const converted = await run(convertQuoteToInvoice({ error: null }, fd({ id: quote.id })));
  const invoiceA = await db.invoice.findFirstOrThrow({ where: { companyId, clientId: client.id }, include: { quote: true } });
  check(
    "presupuesto aceptado → factura F-2026-0001 de 1.210 €",
    converted.redirect === "/facturas" && invoiceA.number === "F-2026-0001" && invoiceA.totalCents === 121_000 && invoiceA.quote?.status === "FACTURADO",
  );
  const twice = await run(convertQuoteToInvoice({ error: null }, fd({ id: quote.id })));
  check("un presupuesto no se factura dos veces", !!twice.result?.error);

  // 4. Case C (intra-community) and case B (expense).
  await run(createInvoice({ client: { mode: "existing", id: de.id }, issueDate: "2026-10-20", lines: line(200_000), notes: "" }));
  const invoiceC = await db.invoice.findFirstOrThrow({ where: { companyId, clientId: de.id } });
  check("caso C: F-2026-0002 intracomunitaria sin IVA", invoiceC.number === "F-2026-0002" && invoiceC.vatCents === 0 && invoiceC.operationType === "INTRA_SERVICIOS");
  await run(createExpense({ supplier: { mode: "existing", id: supplier.id }, date: "2026-10-19", number: "A-77", description: "Asesoría fiscal", baseCents: 100_000, vatRate: 21, irpfRate: 15, deductible: true, source: "MANUAL" }));
  const expenseB = await db.expense.findFirstOrThrow({ where: { companyId } });
  check("caso B: gasto de 1.060 €", expenseB.totalCents === 106_000);

  // 5. Bank CSV import, twice.
  const csv = [
    "Fecha;Concepto;Importe;Saldo",
    "21/10/2026;TRANSFERENCIA EMPRESA DEMO SL F-2026-0001;1.210,00;2.210,00",
    "22/10/2026;RECIBO ASESORIA FICTICIA A-77;-1.060,00;1.150,00",
    "23/10/2026;TRANSFER BEISPIEL SOFTWARE;2.000,00;3.150,00",
    "23/10/2026;COMISION MANTENIMIENTO;-5,00;3.145,00",
    "24/10/2026;LINEA ROTA;abc;0",
  ].join("\n");
  const file = () => new File([csv], "extracto.csv", { type: "text/csv" });
  const first = (await importMovements({ error: null }, fd({ accountId: account.id, file: file() })));
  check("CSV: 4 movimientos importados, 1 línea con error", first.imported === 4 && (first.lineErrors ?? []).length === 1, JSON.stringify(first));
  const second = (await importMovements({ error: null }, fd({ accountId: account.id, file: file() })));
  check("CSV reimportado: 0 nuevos, 4 duplicados", second.imported === 0 && second.duplicates === 4);

  // 6. Reconciliation.
  const mv = (desc: string) => db.bankMovement.findFirstOrThrow({ where: { accountId: account.id, description: { contains: desc } } });
  const mA = await mv("EMPRESA DEMO");
  const mB = await mv("ASESORIA");
  const mC = await mv("BEISPIEL");
  const wrong = await run(reconcileMovement({ error: null }, fd({ movementId: mA.id, target: `invoice:${invoiceC.id}` })));
  check("conciliar con importe distinto se rechaza", !!wrong.result?.error);
  await run(reconcileMovement({ error: null }, fd({ movementId: mA.id, target: `invoice:${invoiceA.id}` })));
  let a = await db.invoice.findUniqueOrThrow({ where: { id: invoiceA.id } });
  check("cobro conciliado → factura COBRADA en la fecha del banco", a.status === "COBRADA" && a.paidAt?.toISOString().startsWith("2026-10-21") === true);
  await run(unreconcileMovement({ error: null }, fd({ movementId: mA.id })));
  a = await db.invoice.findUniqueOrThrow({ where: { id: invoiceA.id } });
  check("deshacer conciliación devuelve la factura a PENDIENTE", a.status === "PENDIENTE" && a.paidAt === null);
  await run(reconcileMovement({ error: null }, fd({ movementId: mA.id, target: `invoice:${invoiceA.id}` })));
  await run(reconcileMovement({ error: null }, fd({ movementId: mB.id, target: `expense:${expenseB.id}` })));
  await run(reconcileMovement({ error: null }, fd({ movementId: mC.id, target: `invoice:${invoiceC.id}` })));
  const dup = await run(reconcileMovement({ error: null }, fd({ movementId: mC.id, target: `invoice:${invoiceA.id}` })));
  check("un movimiento conciliado no se concilia dos veces", !!dup.result?.error);

  // 6b. Create documents straight from unmatched movements (prefilled and reconciled on save).
  await addMovement({ accountId: account.id, date: "2026-10-24", description: "INGRESO EMPRESA DEMO SL", amountCents: 12_100 });
  const mNew = await mv("INGRESO EMPRESA DEMO");
  const base = solveBaseForTotal(12_100, (b) => invoiceTotals([{ quantity: 1, unitPriceCents: b, vatRate: 21 }], "NACIONAL").totalCents);
  check("base calculada desde el cobro de 121 €: 100 € exactos", base.baseCents === 10_000 && base.exact);
  const invoicesBefore = await db.invoice.count({ where: { companyId } });
  const mismatch = await run(
    createInvoice({ client: { mode: "existing", id: client.id }, issueDate: "2026-10-24", lines: line(9_999), notes: "", movementId: mNew.id }),
  );
  check(
    "total distinto del movimiento: error y no se guarda la factura",
    !!mismatch.result?.error && (await db.invoice.count({ where: { companyId } })) === invoicesBefore,
    String(mismatch.result?.error),
  );
  const fromBank = await run(
    createInvoice({ client: { mode: "existing", id: client.id }, issueDate: "2026-10-24", lines: line(base.baseCents), notes: "", movementId: mNew.id }),
  );
  const linked = await db.bankMovement.findUniqueOrThrow({ where: { id: mNew.id }, include: { invoice: true } });
  check(
    "factura creada desde el cobro: conciliada, cobrada y vuelve a conciliación",
    linked.invoice?.status === "COBRADA" && linked.invoice.totalCents === 12_100 && fromBank.redirect?.startsWith("/banco/conciliacion?conciliado=") === true,
    fromBank.redirect,
  );
  const reused = await run(
    createInvoice({ client: { mode: "existing", id: client.id }, issueDate: "2026-10-24", lines: line(base.baseCents), notes: "", movementId: mNew.id }),
  );
  check("un movimiento ya conciliado no se reutiliza", !!reused.result?.error);
  const fee = await mv("COMISION");
  await run(
    createExpense({
      supplier: { mode: "new", name: "Banco Ficticio SA", taxId: "A00000009" },
      date: "2026-10-23",
      number: "",
      description: "Comisión de mantenimiento",
      baseCents: 500,
      vatRate: 0,
      irpfRate: 0,
      deductible: false,
      source: "MANUAL",
      movementId: fee.id,
    }),
  );
  const feeLinked = await db.bankMovement.findUniqueOrThrow({ where: { id: fee.id } });
  check("gasto creado desde el pago de la comisión queda conciliado", !!feeLinked.expenseId);

  // 7. Tenancy: another company cannot touch these records.
  const other = await db.company.findFirstOrThrow({ where: { id: { not: companyId } } });
  jar.set("empresa", other.id);
  const crossPaid = await run(markInvoicePaid({ error: null }, fd({ id: invoiceC.id })));
  const crossRec = await run(unreconcileMovement({ error: null }, fd({ movementId: mA.id })));
  const crossQuote = await run(createQuote({ client: { mode: "existing", id: client.id }, issueDate: "2026-10-19", validUntil: "", lines: line(1), notes: "" }));
  check("otra empresa no puede cobrar, desconciliar ni usar clientes ajenos", !!crossPaid.result?.error && !!crossRec.result?.error && !!crossQuote.result?.error);
  jar.set("empresa", companyId);

  } finally {
    await deleteTestCompany(db);
    await db.$disconnect();
  }
  console.log(failures ? `${failures} FALLOS` : "Circuito completo OK");
  if (failures) process.exitCode = 1;
}

async function deleteTestCompany(db: (typeof import("../lib/db"))["db"]) {
  const companyId = jar.get(TEST_COMPANY_COOKIE);
  if (!companyId) return;
  // Explicit order: invoices restrict client deletion, so children go first.
  await db.$transaction([
    db.bankMovement.deleteMany({ where: { account: { companyId } } }),
    db.quote.deleteMany({ where: { companyId } }),
    db.invoice.deleteMany({ where: { companyId } }),
    db.expense.deleteMany({ where: { companyId } }),
    db.client.deleteMany({ where: { companyId } }),
    db.supplier.deleteMany({ where: { companyId } }),
    db.bankAccount.deleteMany({ where: { companyId } }),
    db.company.deleteMany({ where: { id: companyId, name: "Circuito E2E SL" } }),
  ]);
  console.log("Empresa de prueba borrada.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
