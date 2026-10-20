import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

loadEnvConfig(process.cwd());

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

// All data is fictitious. Two companies show that contacts, documents and banking are kept apart.
const companies = [
  {
    company: {
      name: "Mi empresa",
      taxId: "B00000000",
      address: "Calle Ficticia 1",
      postalCode: "28001",
      city: "Madrid",
      email: "hola@miempresa.example",
      iban: "ES9121000418450200051332",
    },
    openingBalanceCents: 500_000,
    clients: [
      { name: "Empresa Demo SL", taxId: "B00000001", countryCode: "ES", email: "facturas@empresademo.example" },
      { name: "Estudio Ejemplo SC", taxId: "J00000002", countryCode: "ES", email: "admin@estudioejemplo.example" },
      { name: "Beispiel Software GmbH", taxId: "DE000000003", countryCode: "DE", email: "billing@beispiel.example" },
    ],
    suppliers: [
      { name: "Asesoría Ficticia SL", taxId: "B00000004", countryCode: "ES" },
      { name: "Coworking Inventado SL", taxId: "B00000005", countryCode: "ES" },
    ],
  },
  {
    company: {
      name: "Segunda Empresa Demo SL",
      taxId: "B00000020",
      address: "Avenida Inventada 20",
      postalCode: "08001",
      city: "Barcelona",
      email: "admin@segunda.example",
      iban: "ES7921000813610123456789",
    },
    openingBalanceCents: 120_000,
    clients: [{ name: "Cliente Barcelona SL", taxId: "B00000021", countryCode: "ES", email: "" }],
    suppliers: [{ name: "Gestoría Imaginaria SL", taxId: "B00000022", countryCode: "ES" }],
  },
];

async function main() {
  for (const { company, openingBalanceCents, clients, suppliers } of companies) {
    // Company has no unique key besides id; look it up by NIF so the seed can run repeatedly.
    const existing = await db.company.findFirst({ where: { taxId: company.taxId } });
    const { id: companyId } = existing
      ? await db.company.update({ where: { id: existing.id }, data: company })
      : await db.company.create({ data: company });

    if (!(await db.bankAccount.count({ where: { companyId } }))) {
      await db.bankAccount.create({
        data: { companyId, name: "Cuenta principal", iban: company.iban, openingBalanceCents },
      });
    }
    for (const c of clients) {
      const data = { ...c, companyId, email: c.email || null };
      await db.client.upsert({ where: { companyId_taxId: { companyId, taxId: c.taxId } }, update: data, create: data });
    }
    for (const s of suppliers) {
      const data = { ...s, companyId };
      await db.supplier.upsert({ where: { companyId_taxId: { companyId, taxId: s.taxId } }, update: data, create: data });
    }
    console.log(`Seed: ${company.name} · ${clients.length} clientes, ${suppliers.length} proveedores`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
