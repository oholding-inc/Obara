import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Client Drizzle + postgres.js — singleton paresseux.
 *
 * - Aucune connexion n'est ouverte à l'import du module : tout se passe dans getDb().
 * - L'instance est mémorisée sur globalThis pour survivre au rechargement à chaud
 *   de `next dev` (sinon chaque HMR ouvrirait un nouveau pool).
 * - `prepare: false` : compatible avec les poolers en mode transaction (Neon, pgbouncer,
 *   Supabase Supavisor) qui ne supportent pas les requêtes préparées.
 * - `max: 5` : suffisant pour la démo, et compatible avec les fonctions serverless Vercel.
 *
 * Serveur uniquement (importe lib/env.ts) : ne jamais l'importer depuis un composant client.
 */

type ClientDb = PostgresJsDatabase<typeof schema> & { $client: Sql };

interface CacheGlobalDb {
  __obaraDb?: ClientDb;
}

const cacheGlobal = globalThis as typeof globalThis & CacheGlobalDb;

/** Retourne le client Drizzle (créé au premier appel). Lève une erreur si DATABASE_URL manque. */
export function getDb(): ClientDb {
  if (cacheGlobal.__obaraDb) return cacheGlobal.__obaraDb;

  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL est absent : renseignez-le dans .env.local (Postgres + pgvector, Neon ou Supabase) avant d'utiliser la base.",
    );
  }

  const client = postgres(DATABASE_URL, { prepare: false, max: 5 });
  const db = drizzle(client, { schema });
  cacheGlobal.__obaraDb = db;
  return db;
}

export { schema };
export type Db = ReturnType<typeof getDb>;
