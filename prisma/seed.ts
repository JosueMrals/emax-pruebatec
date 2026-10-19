import { loadEnvConfig } from "@next/env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

loadEnvConfig(process.cwd());

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

// All data is fictitious.
const clients = [
  { name: "Empresa Demo SL", taxId: "B00000001", countryCode: "ES", email: "facturas@empresademo.example" },
  { name: "Estudio Ejemplo SC", taxId: "J00000002", countryCode: "ES", email: "admin@estudioejemplo.example" },
  { name: "Beispiel Software GmbH", taxId: "DE000000003", countryCode: "DE", email: "billing@beispiel.example" },
];

const suppliers = [
  { name: "Asesoría Ficticia SL", taxId: "B00000004", countryCode: "ES" },
  { name: "Coworking Inventado SL", taxId: "B00000005", countryCode: "ES" },
];

async function main() {
  // Upsert by taxId so the seed can run repeatedly.
  for (const c of clients) {
    await db.client.upsert({ where: { taxId: c.taxId }, update: c, create: c });
  }
  for (const s of suppliers) {
    await db.supplier.upsert({ where: { taxId: s.taxId }, update: s, create: s });
  }
  console.log(`Seed: ${clients.length} clientes, ${suppliers.length} proveedores`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
