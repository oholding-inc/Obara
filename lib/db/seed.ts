import { getEnv } from "@/lib/env";
import { creerLogger } from "@/lib/log";

/**
 * `pnpm db:seed` — STUB du jalon 1.
 *
 * Le vrai seed est un livrable du jour 9 (CLAUDE.md §9) : 40 travailleurs,
 * 15 employeurs, 6 métiers, 4 communes d'Abidjan (Yopougon, Abobo, Cocody,
 * Treichville), des missions terminées et des témoignages audio RÉELS issus du
 * corpus. Aucune donnée inventée ici : ce script n'insère rien.
 */

const log = creerLogger("db:seed");

function main(): void {
  const { DATABASE_URL } = getEnv();
  if (!DATABASE_URL) {
    log.error(
      "DATABASE_URL est absent : renseignez-le dans .env.local (Postgres + pgvector, Neon ou Supabase) avant `pnpm db:seed`.",
    );
    process.exit(1);
  }

  log.warn("Seed prévu au jour 9 — rien inséré", {
    attendu: "40 travailleurs, 15 employeurs, 6 métiers, 4 communes, témoignages audio réels (CLAUDE.md §9)",
  });
  process.exit(0);
}

try {
  main();
} catch (erreur: unknown) {
  log.error("échec du script de seed", { erreur });
  process.exit(1);
}
