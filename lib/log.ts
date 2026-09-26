/**
 * Logger unique du projet (CLAUDE.md §7 : pas de console.log ailleurs ;
 * ce fichier est le seul exempté de la règle no-console dans eslint.config.mjs).
 *
 * - En développement : lignes lisibles `[niveau] scope message {ctx}`.
 * - En production (Vercel) : une ligne JSON par événement, facile à filtrer.
 * - Le niveau minimal est piloté par LOG_LEVEL (debug | info | warn | error), défaut `info`.
 *
 * Isomorphe : utilisable côté serveur, dans les scripts `tsx` et, au besoin,
 * dans un composant client (seul `console` est utilisé).
 */

export type NiveauLog = "debug" | "info" | "warn" | "error";
export type ContexteLog = Record<string, unknown>;

export interface Logger {
  debug(message: string, contexte?: ContexteLog): void;
  info(message: string, contexte?: ContexteLog): void;
  warn(message: string, contexte?: ContexteLog): void;
  error(message: string, contexte?: ContexteLog): void;
  /** Crée un logger enfant dont les lignes sont préfixées par `scope`. */
  enfant(scope: string): Logger;
}

const ORDRE: Record<NiveauLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const NIVEAUX: readonly NiveauLog[] = ["debug", "info", "warn", "error"];

function niveauMinimal(): NiveauLog {
  const brut = process.env.LOG_LEVEL;
  return NIVEAUX.includes(brut as NiveauLog) ? (brut as NiveauLog) : "info";
}

/** Rend une erreur sérialisable (JSON.stringify(new Error()) donne `{}`). */
function serialiser(valeur: unknown): unknown {
  if (valeur instanceof Error) {
    return { nom: valeur.name, message: valeur.message, stack: valeur.stack };
  }
  return valeur;
}

function serialiserContexte(contexte: ContexteLog | undefined): ContexteLog | undefined {
  if (!contexte) return undefined;
  const resultat: ContexteLog = {};
  for (const [cle, valeur] of Object.entries(contexte)) {
    resultat[cle] = serialiser(valeur);
  }
  return resultat;
}

function ecrire(niveau: NiveauLog, scope: string, message: string, contexte?: ContexteLog): void {
  if (ORDRE[niveau] < ORDRE[niveauMinimal()]) return;

  const sortie = niveau === "error" ? console.error : niveau === "warn" ? console.warn : console.log;
  const ctx = serialiserContexte(contexte);

  if (process.env.NODE_ENV === "production") {
    sortie(JSON.stringify({ t: new Date().toISOString(), niveau, scope, message, ...ctx }));
    return;
  }

  const prefixe = `[${niveau}] ${scope} ${message}`;
  if (ctx && Object.keys(ctx).length > 0) sortie(prefixe, ctx);
  else sortie(prefixe);
}

export function creerLogger(scope: string): Logger {
  return {
    debug: (message, contexte) => ecrire("debug", scope, message, contexte),
    info: (message, contexte) => ecrire("info", scope, message, contexte),
    warn: (message, contexte) => ecrire("warn", scope, message, contexte),
    error: (message, contexte) => ecrire("error", scope, message, contexte),
    enfant: (sousScope) => creerLogger(`${scope}:${sousScope}`),
  };
}

/** Logger racine. Préférer `log.enfant("asr")` dans chaque module. */
export const log: Logger = creerLogger("obara");
