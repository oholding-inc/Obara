import postgres from "postgres";
import { getEnv } from "@/lib/env";
import { creerLogger } from "@/lib/log";

/**
 * Pré-requis de `pnpm db:push` : crée l'extension pgvector si elle n'existe pas.
 *
 * drizzle-kit ne crée pas les extensions ; sans `vector`, le type `vector(768)`
 * de listings.embedding (lib/db/schema.ts) est inconnu et le push échoue.
 * Script tsx, enchaîné dans package.json : `tsx lib/db/ensure-extensions.ts && drizzle-kit push`.
 */

const log = creerLogger("db:extensions");

async function main(): Promise<void> {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    log.error(
      "DATABASE_URL est absent : renseignez-le dans .env.local (Postgres + pgvector, Neon ou Supabase) avant `pnpm db:push`.",
    );
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1, prepare: false });
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    log.info("extension pgvector prête");
  } finally {
    await sql.end();
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((erreur: unknown) => {
    log.error("impossible de préparer l'extension pgvector", { erreur });
    process.exit(1);
  });
