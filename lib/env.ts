import { config as chargerDotenv } from "dotenv";
import { z } from "zod";

/**
 * Variables d'environnement, validées une seule fois par Zod (CLAUDE.md §7).
 *
 * Serveur uniquement : ne jamais importer ce module depuis un composant client.
 * Sous Next.js, `.env.local` est chargé par le framework. Dans les scripts `tsx`
 * (db:push, db:seed…) et les tests, on charge nous-mêmes `.env.local` puis `.env`.
 *
 * Toutes les clés externes sont optionnelles : avec USE_MOCKS=true le projet
 * tourne entièrement hors ligne, sans aucune clé (plan B du 18 septembre).
 */

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** `true` → toutes les implémentations mock (ASR, LLM, embeddings, WhatsApp, stockage). */
  USE_MOCKS: z.enum(["true", "false", "1", "0"]).default("false"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  /** Postgres + pgvector (Neon ou Supabase). Obligatoire pour db:push / db:seed. */
  DATABASE_URL: z.string().min(1).optional(),

  /** ASR niveau 1 (FR/EN) — Groq whisper-large-v3-turbo. */
  GROQ_API_KEY: z.string().min(1).optional(),
  /** ASR niveau 2 (dioula/baoulé) — endpoint HTTP de l'Omnilingual ASR auto-hébergé. */
  OMNI_ASR_URL: z.string().min(1).optional(),

  /** LLM de structuration + embeddings — Gemini (une seule clé). */
  GEMINI_API_KEY: z.string().min(1).optional(),

  /** Supabase Storage (S3-compatible) pour les blobs audio. */
  SUPABASE_URL: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("audio"),

  /** WhatsApp Cloud API — numéro de TEST Meta. */
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),

  /** URL publique de l'application (webhook, liens dans les notifications). */
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
});

type EnvBrut = z.infer<typeof EnvSchema>;

export interface Env extends Omit<EnvBrut, "USE_MOCKS"> {
  USE_MOCKS: boolean;
}

let cache: Env | undefined;

/**
 * Retourne l'environnement validé (mis en cache après le premier appel).
 * Lève une erreur explicite si une variable a une valeur invalide.
 */
export function getEnv(): Env {
  if (cache) return cache;

  // Hors Next.js (scripts tsx, vitest) : charger .env.local puis .env.
  // Sous Next.js les fichiers sont déjà chargés ; dotenv n'écrase jamais une valeur existante.
  if (!process.env.NEXT_RUNTIME) {
    chargerDotenv({ path: [".env.local", ".env"], quiet: true });
  }

  // Une clé laissée vide (`GROQ_API_KEY=`) vaut « absente » : c'est l'erreur de
  // configuration la plus probable, elle ne doit pas empêcher la démo de démarrer.
  const sansVides = Object.fromEntries(
    Object.entries(process.env).filter(([, valeur]) => valeur !== undefined && valeur.trim() !== ""),
  );
  const resultat = EnvSchema.safeParse(sansVides);
  if (!resultat.success) {
    throw new Error(`Variables d'environnement invalides :\n${z.prettifyError(resultat.error)}`);
  }
  const brut = resultat.data;
  cache = { ...brut, USE_MOCKS: brut.USE_MOCKS === "true" || brut.USE_MOCKS === "1" };
  return cache;
}

/** Raccourci : `true` quand les services doivent utiliser leurs mocks. */
export function utiliserMocks(): boolean {
  return getEnv().USE_MOCKS;
}

/** Réservé aux tests : vide le cache pour relire process.env. */
export function reinitialiserEnvPourTests(): void {
  cache = undefined;
}
