import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { MetierCode } from "@/lib/domain/metiers";
import {
  DISPONIBILITES,
  KINDS_LISTING,
  LANGUES,
  ROLES,
  STATUTS_LISTING,
  STATUTS_MATCH,
  STATUTS_MISSION,
  type PayloadEvent,
  type Reason,
  type Structured,
} from "@/lib/domain/schemas";

/**
 * Schéma Drizzle — traduction exacte de CLAUDE.md §4 (modèle de données).
 *
 * - Les énumérations SQL sont construites à partir des tuples de lib/domain/schemas.ts :
 *   une seule source de vérité, jamais de valeurs dupliquées.
 * - `listings.embedding` est un `vector(768)` pgvector, calculé SUR LE TEXTE FRANÇAIS
 *   NORMALISÉ (CLAUDE.md §5), jamais sur le dioula ou le baoulé brut.
 * - JAMAIS DE BLOB AUDIO EN BASE : `audio_url` (listings, profiles, testimonials) pointe
 *   vers Supabase Storage (CLAUDE.md §3).
 * - `events` est la télémétrie de démo : chaque étape du pipeline y écrit (CLAUDE.md §7).
 *
 * Pré-requis : l'extension `vector` doit exister avant `drizzle-kit push`
 * (voir lib/db/ensure-extensions.ts, enchaîné par `pnpm db:push`).
 */

// ---------------------------------------------------------------------------
// Énumérations SQL
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ROLES);
export const langEnum = pgEnum("lang", LANGUES);
export const kindListingEnum = pgEnum("listing_kind", KINDS_LISTING);
export const statutListingEnum = pgEnum("listing_status", STATUTS_LISTING);
export const statutMatchEnum = pgEnum("match_status", STATUTS_MATCH);
export const statutMissionEnum = pgEnum("mission_status", STATUTS_MISSION);
export const disponibiliteEnum = pgEnum("disponibilite", DISPONIBILITES);

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Numéro WhatsApp au format international, identifiant de connexion (OTP simulé). */
  phone: text("phone").notNull().unique(),
  role: roleEnum("role").notNull(),
  displayName: text("display_name").notNull(),
  /** Langue des notifications vocales (CLAUDE.md §2, plan 6). */
  langPref: langEnum("lang_pref").notNull().default("fr"),
  idVerified: boolean("id_verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// profiles (1 ↔ 1 avec users)
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * Codes de l'énumération fermée METIER_CODES (lib/domain/metiers.ts).
   * Défaut applicatif (`$defaultFn`) et non `.default([])` : drizzle-kit 0.31 relit
   * tout défaut SQL de tableau vide comme '{""}', et chaque `db:push` y verrait une
   * modification. Conséquence : pas de DEFAULT en SQL, tout INSERT SQL brut
   * (seed, demo:reset) doit fournir `metiers` et `zones`.
   */
  metiers: text("metiers").array().$type<MetierCode[]>().notNull().$defaultFn(() => []),
  /** Codes de zones (lib/domain/zones.ts : communes et quartiers d'Abidjan). Défaut applicatif : voir `metiers`. */
  zones: text("zones").array().notNull().$defaultFn(() => []),
  dispo: disponibiliteEnum("dispo"),
  tarifMin: integer("tarif_min"),
  tarifMax: integer("tarif_max"),
  /** URL Supabase Storage — jamais le blob. */
  bioAudioUrl: text("bio_audio_url"),
  bioText: text("bio_text"),
});

// ---------------------------------------------------------------------------
// listings (offres des travailleurs, demandes des employeurs)
// ---------------------------------------------------------------------------

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: kindListingEnum("kind").notNull(),
    /** URL Supabase Storage du vocal d'origine — jamais le blob. */
    audioUrl: text("audio_url"),
    /** Transcription brute, dans la langue détectée (jamais embeddée telle quelle). */
    transcriptRaw: text("transcript_raw"),
    langDetected: langEnum("lang_detected"),
    /** Confiance de l'ASR, entre 0 et 1. */
    confidence: real("confidence"),
    /** Sortie du LLM validée par StructuredSchema (Zod) — français canonique. */
    structured: jsonb("structured").$type<Structured>(),
    /** Embedding Gemini du texte français normalisé (CLAUDE.md §5). */
    embedding: vector("embedding", { dimensions: 768 }),
    /** Étape du pipeline vocal, affichée en direct sur le tableau de bord. */
    status: statutListingEnum("status").notNull().default("recu"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Similarité cosinus pour le classement du matching hybride (CLAUDE.md §5).
    // Pas de `.with({ lists: 100 })` : c'est déjà le défaut de pgvector, et drizzle-kit
    // relit l'option en texte ("100" ≠ 100), ce qui recréerait l'index à chaque db:push.
    index("listings_embedding_idx").using("ivfflat", t.embedding.op("vector_cosine_ops")),
    // Filtres SQL durs : on cherche les offres/demandes actives.
    index("listings_kind_status_idx").on(t.kind, t.status),
    index("listings_user_id_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// matches (une offre ↔ une demande, avec le score et ses raisons)
// ---------------------------------------------------------------------------

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offreId: uuid("offre_id")
      .notNull()
      .references(() => listings.id),
    demandeId: uuid("demande_id")
      .notNull()
      .references(() => listings.id),
    /** Score final = 0.6 × filtres + 0.4 × cosinus (lib/domain/scoring.ts). */
    score: real("score").notNull(),
    /** Pourquoi ces deux-là ont matché — affiché au jury (ReasonsSchema). */
    reasons: jsonb("reasons").$type<Reason[]>().notNull().default([]),
    status: statutMatchEnum("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("matches_offre_demande_unique").on(t.offreId, t.demandeId)],
);

// ---------------------------------------------------------------------------
// missions (l'historique de travail — la thèse produit, CLAUDE.md §1)
// ---------------------------------------------------------------------------

export const missions = pgTable("missions", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  /** Montant en francs CFA (paiement simulé, CLAUDE.md §3). */
  amountFcfa: integer("amount_fcfa"),
  status: statutMissionEnum("status").notNull().default("planifiee"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// testimonials (réputation vocale — le moment différenciant, CLAUDE.md §2 plan 5)
// ---------------------------------------------------------------------------

export const testimonials = pgTable(
  "testimonials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    missionId: uuid("mission_id")
      .notNull()
      .references(() => missions.id),
    /** Qui parle (l'ancien employeur, en général). */
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    /** De qui on parle (le travailleur). */
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => users.id),
    /** URL Supabase Storage du témoignage vocal — jamais le blob. */
    audioUrl: text("audio_url"),
    transcript: text("transcript"),
    /** Note de 1 à 5 (contrainte CHECK). */
    rating: integer("rating"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("testimonials_rating_check", sql`${t.rating} between 1 and 5`)],
);

// ---------------------------------------------------------------------------
// events (télémétrie de démo : chaque étape du pipeline y écrit)
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Ex. `audio_recu`, `transcrit`, `structure`, `match_trouve`, `notification_envoyee`. */
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<PayloadEvent>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_created_at_idx").on(t.createdAt), index("events_kind_idx").on(t.kind)],
);

// ---------------------------------------------------------------------------
// Relations (API de requêtes relationnelles de Drizzle)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles),
  listings: many(listings),
  temoignagesRediges: many(testimonials, { relationName: "auteur" }),
  temoignagesRecus: many(testimonials, { relationName: "sujet" }),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export const listingsRelations = relations(listings, ({ one, many }) => ({
  user: one(users, { fields: [listings.userId], references: [users.id] }),
  matchesEnTantQuOffre: many(matches, { relationName: "offre" }),
  matchesEnTantQueDemande: many(matches, { relationName: "demande" }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  offre: one(listings, {
    fields: [matches.offreId],
    references: [listings.id],
    relationName: "offre",
  }),
  demande: one(listings, {
    fields: [matches.demandeId],
    references: [listings.id],
    relationName: "demande",
  }),
  missions: many(missions),
}));

export const missionsRelations = relations(missions, ({ one, many }) => ({
  match: one(matches, { fields: [missions.matchId], references: [matches.id] }),
  testimonials: many(testimonials),
}));

export const testimonialsRelations = relations(testimonials, ({ one }) => ({
  mission: one(missions, { fields: [testimonials.missionId], references: [missions.id] }),
  author: one(users, {
    fields: [testimonials.authorId],
    references: [users.id],
    relationName: "auteur",
  }),
  subject: one(users, {
    fields: [testimonials.subjectId],
    references: [users.id],
    relationName: "sujet",
  }),
}));

// ---------------------------------------------------------------------------
// Types inférés
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Mission = typeof missions.$inferSelect;
export type NewMission = typeof missions.$inferInsert;
export type Testimonial = typeof testimonials.$inferSelect;
export type NewTestimonial = typeof testimonials.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
