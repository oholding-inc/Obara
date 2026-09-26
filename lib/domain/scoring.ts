import type { Reason } from "./schemas";

/**
 * Formule de score du matching hybride (CLAUDE.md §5), PURE et sans I/O.
 *
 *   score = POIDS_FILTRES × scoreFiltres + POIDS_COSINUS × cosinus
 *
 * - `scoreFiltres` résume les trois filtres durs (métier, zone, disponibilité) ;
 * - `cosinus` est la similarité vectorielle des deux annonces, bornée à [0, 1].
 *
 * Ce module ne fait PAS le matching (pas de SQL, pas de pgvector) : il calcule
 * un score à partir de faits déjà établis, et produit les `reasons` affichées
 * au jury pour expliquer pourquoi deux annonces ont matché.
 */

// ---------------------------------------------------------------------------
// Pondérations — ajustables, tant que chaque groupe somme à 1
// ---------------------------------------------------------------------------

/** Part des filtres durs dans le score final (CLAUDE.md §5 : 0.6). */
export const POIDS_FILTRES = 0.6;
/** Part de la similarité sémantique dans le score final (CLAUDE.md §5 : 0.4). */
export const POIDS_COSINUS = 0.4;

/** Poids relatifs des trois filtres à l'intérieur de `scoreFiltres`. Somme = 1. */
export const POIDS_METIER = 0.5;
export const POIDS_ZONE = 0.3;
export const POIDS_DISPONIBILITE = 0.2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Résultat des filtres durs entre deux annonces : chaque filtre est satisfait ou non. */
export interface Filtres {
  metier: boolean;
  zone: boolean;
  disponibilite: boolean;
}

export interface ResultatScore {
  /** Score final dans [0, 1], arrondi à 4 décimales. */
  score: number;
  /** Score des filtres dans [0, 1], avant pondération par POIDS_FILTRES. */
  scoreFiltres: number;
  /** Cosinus borné à [0, 1] (négatif ou NaN → 0), arrondi à 4 décimales. */
  cosinus: number;
  /** Une entrée par contribution non nulle ; la somme des poids vaut `score` (à l'arrondi près). */
  reasons: Reason[];
}

// ---------------------------------------------------------------------------
// Calcul
// ---------------------------------------------------------------------------

const LIBELLES_FILTRES: Readonly<Record<keyof Filtres, string>> = {
  metier: "Même métier",
  zone: "Même commune ou quartier",
  disponibilite: "Disponibilités compatibles",
};

const POIDS_PAR_FILTRE: Readonly<Record<keyof Filtres, number>> = {
  metier: POIDS_METIER,
  zone: POIDS_ZONE,
  disponibilite: POIDS_DISPONIBILITE,
};

const ORDRE_FILTRES: readonly (keyof Filtres)[] = ["metier", "zone", "disponibilite"];

function arrondir(valeur: number): number {
  return Math.round(valeur * 10_000) / 10_000;
}

/** Ramène un cosinus dans [0, 1] : une similarité négative ne vaut rien, un NaN non plus. */
function bornerCosinus(cosinus: number): number {
  if (Number.isNaN(cosinus)) return 0;
  return Math.min(1, Math.max(0, cosinus));
}

/** Score des filtres durs dans [0, 1] : chaque filtre satisfait apporte son poids. */
export function scoreFiltres(filtres: Filtres): number {
  const total = ORDRE_FILTRES.reduce((somme, filtre) => somme + (filtres[filtre] ? POIDS_PAR_FILTRE[filtre] : 0), 0);
  return arrondir(total);
}

/**
 * Score final et `reasons` associées.
 *
 * Chaque reason porte sa contribution EFFECTIVE au score final
 * (métier satisfait → POIDS_FILTRES × POIDS_METIER = 0.3), pour que le jury
 * lise directement « d'où vient » le score.
 */
export function calculerScore(filtres: Filtres, cosinus: number): ResultatScore {
  const cosinusBorne = arrondir(bornerCosinus(cosinus));
  const valeurFiltres = scoreFiltres(filtres);
  const reasons: Reason[] = [];

  for (const filtre of ORDRE_FILTRES) {
    if (!filtres[filtre]) continue;
    reasons.push({
      code: filtre,
      libelle: LIBELLES_FILTRES[filtre],
      poids: arrondir(POIDS_FILTRES * POIDS_PAR_FILTRE[filtre]),
    });
  }

  if (cosinusBorne > 0) {
    reasons.push({
      code: "semantique",
      libelle: "Proximité sémantique des annonces",
      poids: arrondir(POIDS_COSINUS * cosinusBorne),
    });
  }

  return {
    score: arrondir(POIDS_FILTRES * valeurFiltres + POIDS_COSINUS * cosinusBorne),
    scoreFiltres: valeurFiltres,
    cosinus: cosinusBorne,
    reasons,
  };
}

/**
 * Similarité cosinus entre deux vecteurs de même dimension, dans [-1, 1].
 * Lève une Error si les dimensions diffèrent ; renvoie 0 si l'un des vecteurs est nul.
 */
export function similariteCosinus(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`similariteCosinus : dimensions différentes (${a.length} et ${b.length})`);
  }
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  for (let i = 0; i < a.length; i++) {
    produit += a[i] * b[i];
    normeA += a[i] * a[i];
    normeB += b[i] * b[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  const cosinus = produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
  // Les erreurs d'arrondi flottant peuvent dépasser 1 d'un epsilon.
  return Math.min(1, Math.max(-1, cosinus));
}
