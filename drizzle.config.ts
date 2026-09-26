import { config as chargerDotenv } from "dotenv";
import { defineConfig } from "drizzle-kit";

/**
 * Configuration drizzle-kit (db:push, db:generate, db:studio).
 *
 * drizzle-kit tourne hors Next.js : on charge nous-mêmes .env.local puis .env.
 * Ne plante pas à l'import si DATABASE_URL manque (url vide) : c'est drizzle-kit
 * qui signalera l'absence de connexion au moment de la commande.
 */

chargerDotenv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
