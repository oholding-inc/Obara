import { z } from "zod";
import { METIER_CODES } from "./metiers";

/**
 * Schémas Zod et énumérations fermées du domaine.
 *
 * Source de vérité unique : le schéma Drizzle (lib/db/schema.ts) et les services
 * importent ces tuples pour leurs `pgEnum` et leurs types. Rien n'est dupliqué.
 */

// ---------------------------------------------------------------------------
// Langues
// ---------------------------------------------------------------------------

/** fr / en (niveau 1, Groq) — dyu (dioula) / bci (baoulé) (niveau 2, Omnilingual ASR). */
export const LANGUES = ["fr", "en", "dyu", "bci"] as const;
export const LangueSchema = z.enum(LANGUES);
export type Langue = z.infer<typeof LangueSchema>;

export const LIBELLES_LANGUES: Record<Langue, string> = {
  fr: "Français",
  en: "Anglais",
  dyu: "Dioula",
  bci: "Baoulé",
};

// ---------------------------------------------------------------------------
// Utilisateurs et annonces
// ---------------------------------------------------------------------------

export const ROLES = ["worker", "employer", "agency"] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** `offre` = un travailleur propose ses services ; `demande` = un employeur cherche quelqu'un. */
export const KINDS_LISTING = ["offre", "demande"] as const;
export const KindListingSchema = z.enum(KINDS_LISTING);
export type KindListing = z.infer<typeof KindListingSchema>;

/** Étapes du pipeline vocal (CLAUDE.md §5) — c'est ce que le tableau de bord affiche en direct. */
export const STATUTS_LISTING = ["recu", "transcrit", "structure", "actif", "clos", "erreur"] as const;
export const StatutListingSchema = z.enum(STATUTS_LISTING);
export type StatutListing = z.infer<typeof StatutListingSchema>;

export const STATUTS_MATCH = ["proposed", "accepted", "declined"] as const;
export const StatutMatchSchema = z.enum(STATUTS_MATCH);
export type StatutMatch = z.infer<typeof StatutMatchSchema>;

export const STATUTS_MISSION = ["planifiee", "en_cours", "terminee", "annulee"] as const;
export const StatutMissionSchema = z.enum(STATUTS_MISSION);
export type StatutMission = z.infer<typeof StatutMissionSchema>;

// ---------------------------------------------------------------------------
// Disponibilité (énumération fermée, comme le métier — indispensable au filtre SQL)
// ---------------------------------------------------------------------------

export const DISPONIBILITES = [
  "matin",
  "apres-midi",
  "soir",
  "journee",
  "nuit",
  "week-end",
  "flexible",
  "inconnue",
] as const;
export const DisponibiliteSchema = z.enum(DISPONIBILITES);
export type Disponibilite = z.infer<typeof DisponibiliteSchema>;

export const LIBELLES_DISPONIBILITES: Record<Disponibilite, string> = {
  matin: "Le matin",
  "apres-midi": "L'après-midi",
  soir: "Le soir",
  journee: "Toute la journée",
  nuit: "La nuit",
  "week-end": "Le week-end",
  flexible: "Flexible",
  inconnue: "Non précisée",
};

// ---------------------------------------------------------------------------
// `structured` — sortie du LLM, validée strictement (CLAUDE.md §4)
// ---------------------------------------------------------------------------

export const MetierCodeSchema = z.enum(METIER_CODES);

/**
 * Le LLM ne peut pas inventer de métier : il choisit dans METIER_CODES ou renvoie `autre`.
 * Les libellés de zones sont des chaînes libres ici ; leur rattachement aux zones
 * connues se fait via lib/domain/zones.ts (trouverZone).
 */
export const StructuredSchema = z.object({
  metier: MetierCodeSchema,
  metier_libelle: z.string().min(1),
  zones: z.array(z.string().min(1)).max(10).default([]),
  disponibilite: DisponibiliteSchema.default("inconnue"),
  experience_annees: z.number().int().min(0).max(60).nullable().default(null),
  tarif_indicatif_fcfa: z.number().int().min(0).max(10_000_000).nullable().default(null),
  mots_cles: z.array(z.string().min(1)).max(20).default([]),
});

/** Forme validée (après `parse`). */
export type Structured = z.infer<typeof StructuredSchema>;
/** Forme acceptée en entrée (champs optionnels avant application des défauts). */
export type StructuredEntree = z.input<typeof StructuredSchema>;

// ---------------------------------------------------------------------------
// `reasons` — pourquoi deux annonces ont matché (affiché au jury)
// ---------------------------------------------------------------------------

export const ReasonSchema = z.object({
  /** Identifiant stable : `metier`, `zone`, `disponibilite`, `semantique`… */
  code: z.string().min(1),
  /** Phrase courte en français, affichable telle quelle. */
  libelle: z.string().min(1),
  /** Contribution au score final, entre 0 et 1. */
  poids: z.number().min(0).max(1),
});
export const ReasonsSchema = z.array(ReasonSchema);
export type Reason = z.infer<typeof ReasonSchema>;

// ---------------------------------------------------------------------------
// `events.payload` — télémétrie de démo
// ---------------------------------------------------------------------------

export const PayloadEventSchema = z.record(z.string(), z.unknown());
export type PayloadEvent = z.infer<typeof PayloadEventSchema>;
