import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";

// Prisma CLI doesn't read .env.local; reuse Next's loader so both share one env file.
loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations need a direct (non-pooled) connection.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
