import { chercherMetierParSynonyme, trouverMetier } from "@/lib/domain/metiers";
import type { MetierCode } from "@/lib/domain/metiers";
import { LIBELLES_DISPONIBILITES, StructuredSchema } from "@/lib/domain/schemas";
import type { Disponibilite, KindListing, Langue, Structured, StructuredEntree } from "@/lib/domain/schemas";
import { contientExpression, mots, normaliser } from "@/lib/domain/texte";
import { chercherZonesDansTexte } from "@/lib/domain/zones";
import { creerLogger } from "@/lib/log";
import { creerFabrique, ServiceNonImplemente } from "./commun";

/**
 * Service LLM — structuration d'une transcription en JSON canonique français,
 * et traduction des notifications vers la langue de l'utilisateur.
 *
 * Rôle : deuxième étape du pipeline vocal (CLAUDE.md §5). Quelle que soit la
 * langue d'entrée (fr, en, dyu, bci), la sortie est (1) un `structured` validé
 * par StructuredSchema — le métier est une énumération fermée, le LLM ne peut
 * rien inventer — et (2) `texteNormaliseFr`, LA phrase française canonique qui
 * sera embeddée. On n'embedde jamais le dioula ou le baoulé brut.
 *
 * Moteur réel prévu (CLAUDE.md §3) : Gemini 2.5 Flash (GEMINI_API_KEY), sortie
 * JSON validée par Zod — jamais de JSON.parse brut.
 *
 * Jalon : 1 = interface + mock déterministe à base de règles ; câblage réel aux
 * jalons suivants. Le mock respecte déjà la règle : tout passe par
 * StructuredSchema.parse().
 */

export interface EntreeStructuration {
  transcript: string;
  langue: Langue;
  kind: KindListing;
}

export interface ResultatStructuration {
  structured: Structured;
  /** Phrase française canonique, seule entrée autorisée du service d'embeddings. */
  texteNormaliseFr: string;
  /** Identifiant du modèle utilisé (`mock-regles`, puis `gemini-2.5-flash`). */
  modele: string;
}

export interface ServiceLLM {
  structurer(entree: EntreeStructuration): Promise<ResultatStructuration>;
  traduireNotification(texte: string, langueCible: Langue): Promise<string>;
}

// ---------------------------------------------------------------------------
// Lexique mock dioula/baoulé → français
// ---------------------------------------------------------------------------

export interface EntreeLexiqueMock {
  langue: "dyu" | "bci";
  /** Expression telle qu'elle sort de l'ASR (orthographe standard) ; comparée après normaliser(). */
  expression: string;
  /** Équivalent français approximatif, suffisant pour les règles du mock. */
  francais: string;
}

/**
 * BÉQUILLE DE MOCK, PAS UNE TRADUCTION. Table de correspondance minimale qui
 * permet aux règles ci-dessous de reconnaître métier, zone et disponibilité
 * dans les transcriptions dioula/baoulé du catalogue. La vraie traduction et la
 * vraie normalisation viendront avec Gemini. Les entrées marquées « à valider »
 * doivent être relues par un locuteur.
 */
export const LEXIQUE_MOCK_LOCAL: readonly EntreeLexiqueMock[] = [
  // --- Dioula (orthographe standard) ---
  { langue: "dyu", expression: "n tɔgɔ ye", francais: "je m'appelle" },
  { langue: "dyu", expression: "so baara kɛla", francais: "aide-ménagère" },
  { langue: "dyu", expression: "so baara", francais: "ménage" },
  { langue: "dyu", expression: "so jɔla", francais: "maçon" },
  { langue: "dyu", expression: "so jɔ", francais: "maçon" },
  { langue: "dyu", expression: "n bɛ se", francais: "je peux" },
  { langue: "dyu", expression: "baara", francais: "travail" },
  { langue: "dyu", expression: "kɛ", francais: "faire" },
  { langue: "dyu", expression: "sɔgɔma", francais: "matin" },
  { langue: "dyu", expression: "tile bɛɛ", francais: "toute la journée" },
  { langue: "dyu", expression: "wula", francais: "après-midi" }, // à valider
  { langue: "dyu", expression: "sufɛ", francais: "soir" }, // à valider
  { langue: "dyu", expression: "su", francais: "nuit" }, // à valider
  { langue: "dyu", expression: "kalo", francais: "mois" },
  { langue: "dyu", expression: "wari", francais: "argent" },
  // --- Baoulé (placeholders, à valider par un locuteur) ---
  { langue: "bci", expression: "min dunman ti", francais: "je m'appelle" },
  { langue: "bci", expression: "sua kplanfuɛ", francais: "maçon" },
  { langue: "bci", expression: "sua kplan", francais: "maçon" },
  { langue: "bci", expression: "di junman", francais: "travailler" },
  { langue: "bci", expression: "junman", francais: "travail" },
  { langue: "bci", expression: "n kwla", francais: "je peux" },
  { langue: "bci", expression: "nglɛmun", francais: "matin" },
  { langue: "bci", expression: "nnɔsua", francais: "soir" },
  { langue: "bci", expression: "kɔnguɛ", francais: "nuit" },
];

interface EntreeLexiqueCompilee {
  langue: "dyu" | "bci";
  motif: RegExp;
  francais: string;
}

function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Lexique trié des expressions les plus longues aux plus courtes (« so jɔla » avant « so jɔ »). */
const LEXIQUE_COMPILE: readonly EntreeLexiqueCompilee[] = [...LEXIQUE_MOCK_LOCAL]
  .map((entree) => ({ ...entree, cle: normaliser(entree.expression) }))
  .sort((a, b) => b.cle.length - a.cle.length)
  .map((entree) => ({
    langue: entree.langue,
    // Mots entiers uniquement : le texte est encadré d'espaces avant application.
    motif: new RegExp(`(?<=\\s)${echapperRegex(entree.cle)}(?=\\s)`, "g"),
    francais: entree.francais,
  }));

/**
 * Normalise la transcription et, pour dyu/bci, remplace les expressions du
 * lexique par leur équivalent français. Pour fr/en, renvoie simplement le texte normalisé.
 */
function appliquerLexique(transcript: string, langue: Langue): string {
  const texte = normaliser(transcript);
  if (langue !== "dyu" && langue !== "bci") return texte;
  let resultat = ` ${texte} `;
  for (const entree of LEXIQUE_COMPILE) {
    if (entree.langue !== langue) continue;
    resultat = resultat.replace(entree.motif, entree.francais);
  }
  return resultat.trim();
}

// ---------------------------------------------------------------------------
// Règles d'extraction
// ---------------------------------------------------------------------------

/** Premier match dans cet ordre (matin avant week-end si les deux sont cités). */
const REGLES_DISPONIBILITE: ReadonlyArray<{ disponibilite: Disponibilite; expressions: readonly string[] }> = [
  { disponibilite: "matin", expressions: ["matin", "matinee", "morning", "mornings"] },
  { disponibilite: "apres-midi", expressions: ["apres midi", "afternoon", "afternoons"] },
  { disponibilite: "soir", expressions: ["soir", "soiree", "evening", "evenings"] },
  { disponibilite: "nuit", expressions: ["nuit", "night", "nights"] },
  {
    disponibilite: "week-end",
    expressions: ["week end", "weekend", "weekends", "samedi", "dimanche", "saturday", "sunday"],
  },
  { disponibilite: "journee", expressions: ["toute la journee", "journee", "all day", "whole day"] },
  {
    disponibilite: "flexible",
    expressions: ["n importe quand", "flexible", "quand vous voulez", "tout le temps", "anytime", "any time"],
  },
];

function extraireDisponibilite(texte: string): Disponibilite {
  for (const regle of REGLES_DISPONIBILITE) {
    if (regle.expressions.some((expression) => contientExpression(texte, expression))) {
      return regle.disponibilite;
    }
  }
  return "inconnue";
}

/** « 3 ans », « 5 ans d'expérience », « 2 years » → entier ; hors 0..60 → null. */
function extraireExperienceAnnees(texte: string): number | null {
  const correspondance = /(?<!\d)(\d{1,2})\s*(ans?|years?)\b/i.exec(texte);
  if (!correspondance) return null;
  const valeur = Number.parseInt(correspondance[1], 10);
  return Number.isInteger(valeur) && valeur >= 0 && valeur <= 60 ? valeur : null;
}

/** « 45 000 francs », « 45.000 F », « 60,000 FCFA » → entier ; hors 0..10 000 000 → null. */
function extraireTarifFcfa(texte: string): number | null {
  const correspondance = /(\d[\d\s.,]*)\s*(fcfa|francs?|f)\b/i.exec(texte);
  if (!correspondance) return null;
  const chiffres = correspondance[1].replace(/\D/g, "");
  if (chiffres.length === 0) return null;
  const valeur = Number.parseInt(chiffres, 10);
  return Number.isInteger(valeur) && valeur >= 0 && valeur <= 10_000_000 ? valeur : null;
}

/**
 * Mots vides (> 4 lettres, forme normalisée) exclus des mots-clés : formules,
 * verbes de présentation, jours, unités, et le vocabulaire de disponibilité
 * déjà porté par `disponibilite`.
 */
const MOTS_VIDES: ReadonlySet<string> = new Set([
  // formules et liaison
  "bonjour",
  "bonsoir",
  "salut",
  "merci",
  "alors",
  "aussi",
  "ainsi",
  "comme",
  "quand",
  "parce",
  "puisque",
  "encore",
  "toujours",
  "depuis",
  "entre",
  "cette",
  "celui",
  "celle",
  "votre",
  "notre",
  "leurs",
  "elles",
  "vous",
  "nous",
  "avoir",
  "faire",
  "meme",
  "beaucoup",
  "petit",
  "grand",
  "autre",
  "autres",
  "toute",
  "toutes",
  "tous",
  // présentation, recherche, offre
  "appelle",
  "habite",
  "cherche",
  "cherchons",
  "propose",
  "voudrais",
  "veux",
  "besoin",
  "personne",
  "quelqu",
  "travail",
  "travaille",
  "travailler",
  "disponible",
  "experience",
  "annees",
  "peux",
  "pouvez",
  "peuvent",
  // temps, unités
  "matin",
  "matinee",
  "soir",
  "soiree",
  "journee",
  "flexible",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
  "semaine",
  "francs",
  "heure",
  "heures",
  // anglais
  "hello",
  "thank",
  "thanks",
  "please",
  "looking",
  "there",
  "which",
  "would",
  "could",
  "about",
  "after",
  "before",
  "month",
  "months",
  "morning",
  "afternoon",
  "evening",
  "evenings",
  "night",
  "weekend",
  "weekends",
  "available",
]);

/**
 * Noms propres probables (forme normalisée) : un mot commençant par une majuscule
 * qui n'ouvre pas une phrase (« Moi c'est Koffi, je suis maçon » → koffi). Les
 * prénoms n'ont rien à faire dans les mots-clés embeddés ; les zones, elles,
 * sont ajoutées à part et ne passent pas par ce filtre.
 */
function nomsPropresProbables(transcript: string): Set<string> {
  const noms = new Set<string>();
  for (const phrase of transcript.split(/[.!?]+/)) {
    const jetons = phrase.split(/[^\p{L}\p{N}]+/u).filter((jeton) => jeton.length > 0);
    for (const jeton of jetons.slice(1)) {
      if (/^\p{Lu}/u.test(jeton)) noms.add(normaliser(jeton));
    }
  }
  return noms;
}

/** Mots significatifs uniques (> 4 lettres, non vides, non numériques), dans l'ordre d'apparition. */
function motsSignificatifs(texte: string, dejaVus: Set<string>): string[] {
  const resultat: string[] = [];
  for (const brut of texte.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    const cle = normaliser(brut);
    if (cle.length <= 4) continue;
    if (/^\p{N}+$/u.test(cle)) continue;
    if (MOTS_VIDES.has(cle)) continue;
    if (dejaVus.has(cle)) continue;
    dejaVus.add(cle);
    resultat.push(brut);
  }
  return resultat;
}

const MAX_MOTS_CLES = 6;

// ---------------------------------------------------------------------------
// Texte français canonique (ce qui sera embeddé)
// ---------------------------------------------------------------------------

function libelleDisponibilite(disponibilite: Disponibilite): string {
  switch (disponibilite) {
    case "inconnue":
      return "disponibilité non précisée";
    case "flexible":
      return "disponibilité flexible";
    default:
      return `disponible ${LIBELLES_DISPONIBILITES[disponibilite].toLowerCase()}`;
  }
}

/** 45000 → « 45 000 » (espace ordinaire U+0020 comme séparateur de milliers, sans dépendre de la locale). */
function formaterNombre(valeur: number): string {
  return String(valeur).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Ex. « Offre : Aide-ménagère à Yopougon — disponible le matin — ménage, repassage,
 * cuisine — 3 ans d'expérience — 45 000 FCFA ».
 */
function composerTexteNormaliseFr(kind: KindListing, structured: Structured): string {
  const parties: string[] = [];

  const entete = kind === "offre" ? "Offre" : "Demande";
  const lieu = structured.zones.length > 0 ? ` à ${structured.zones.join(", ")}` : "";
  parties.push(`${entete} : ${structured.metier_libelle}${lieu}`);

  parties.push(libelleDisponibilite(structured.disponibilite));

  const dejaCites = new Set([structured.metier_libelle, ...structured.zones].map(normaliser));
  const motsRestants = structured.mots_cles.filter((mot) => !dejaCites.has(normaliser(mot)));
  if (motsRestants.length > 0) parties.push(motsRestants.join(", "));

  if (structured.experience_annees !== null) {
    const pluriel = structured.experience_annees > 1 ? "s" : "";
    parties.push(`${structured.experience_annees} an${pluriel} d'expérience`);
  }
  if (structured.tarif_indicatif_fcfa !== null) {
    parties.push(`${formaterNombre(structured.tarif_indicatif_fcfa)} FCFA`);
  }

  return parties.join(" — ");
}

// ---------------------------------------------------------------------------
// Mock déterministe à base de règles
// ---------------------------------------------------------------------------

const MODELE_MOCK = "mock-regles";

const journal = creerLogger("services:llm");

/**
 * Structuration par règles, dans l'ordre du cahier des charges :
 *  (a) lexique dyu/bci → français ; (b) métier par synonyme (sinon `autre`) ;
 *  (c) zones (texte traduit ET transcript brut : les noms de lieux ne changent pas) ;
 *  (d) disponibilité par mots-clés ; (e) expérience ; (f) tarif ; (g) mots-clés.
 * Le résultat passe par StructuredSchema.parse() — règle du projet, même en mock.
 */
function structurerParRegles(entree: EntreeStructuration): ResultatStructuration {
  const texteFr = appliquerLexique(entree.transcript, entree.langue);

  const metierTrouve = chercherMetierParSynonyme(texteFr) ?? chercherMetierParSynonyme(entree.transcript);
  const metier: MetierCode = metierTrouve?.code ?? "autre";
  const metierLibelle = metierTrouve?.libelle ?? trouverMetier("autre")?.libelle ?? "Autre";

  const zonesParCode = new Map<string, string>();
  for (const zone of [...chercherZonesDansTexte(texteFr), ...chercherZonesDansTexte(entree.transcript)]) {
    if (!zonesParCode.has(zone.code)) zonesParCode.set(zone.code, zone.libelle);
  }
  const zones = [...zonesParCode.values()].slice(0, 10);

  const disponibilite = extraireDisponibilite(texteFr);
  const experienceAnnees = extraireExperienceAnnees(texteFr);
  const tarifIndicatifFcfa = extraireTarifFcfa(texteFr);

  // Mots-clés : libellé métier, zones, puis mots significatifs du texte.
  // Pour fr/en on lit le transcript d'origine (accents conservés) ; pour dyu/bci
  // le texte passé par le lexique, où les mots français insérés portent leurs accents.
  const dejaVus = new Set<string>();
  const motsCles: string[] = [];
  if (metier !== "autre") {
    // Mot à mot : motsSignificatifs découpe aux tirets (« Aide-ménagère » → « ménagère »).
    for (const m of mots(metierLibelle)) dejaVus.add(m);
    motsCles.push(metierLibelle);
  }
  for (const zone of zones) {
    if (!dejaVus.has(normaliser(zone))) {
      dejaVus.add(normaliser(zone));
      for (const m of mots(zone)) dejaVus.add(m);
      motsCles.push(zone);
    }
  }
  const sourceMots = entree.langue === "dyu" || entree.langue === "bci" ? texteFr : entree.transcript;
  for (const nom of nomsPropresProbables(entree.transcript)) dejaVus.add(nom);
  motsCles.push(...motsSignificatifs(sourceMots, dejaVus));

  const candidat: StructuredEntree = {
    metier,
    metier_libelle: metierLibelle,
    zones,
    disponibilite,
    experience_annees: experienceAnnees,
    tarif_indicatif_fcfa: tarifIndicatifFcfa,
    mots_cles: motsCles.slice(0, MAX_MOTS_CLES),
  };
  const structured = StructuredSchema.parse(candidat);

  return {
    structured,
    texteNormaliseFr: composerTexteNormaliseFr(entree.kind, structured),
    modele: MODELE_MOCK,
  };
}

class ServiceLLMMock implements ServiceLLM {
  async structurer(entree: EntreeStructuration): Promise<ResultatStructuration> {
    const resultat = structurerParRegles(entree);
    journal.debug("structuration mock", {
      langue: entree.langue,
      kind: entree.kind,
      metier: resultat.structured.metier,
      zones: resultat.structured.zones,
      disponibilite: resultat.structured.disponibilite,
      texteNormaliseFr: resultat.texteNormaliseFr,
    });
    return resultat;
  }

  /** fr/en : texte tel quel ; dyu/bci : préfixe de langue (la vraie traduction viendra avec Gemini). */
  async traduireNotification(texte: string, langueCible: Langue): Promise<string> {
    const traduit = langueCible === "fr" || langueCible === "en" ? texte : `[${langueCible}] ${texte}`;
    journal.debug("traduction mock", { langueCible, longueur: texte.length });
    return traduit;
  }
}

// ---------------------------------------------------------------------------
// Classe réelle — câblage Gemini 2.5 Flash aux jalons suivants
// ---------------------------------------------------------------------------

const JALON_LLM_REEL = "jalon 2, pipeline vocal — Gemini 2.5 Flash, sortie JSON validée par StructuredSchema";

class ServiceLLMReel implements ServiceLLM {
  async structurer(): Promise<ResultatStructuration> {
    throw new ServiceNonImplemente("LLM", JALON_LLM_REEL);
  }

  async traduireNotification(): Promise<string> {
    throw new ServiceNonImplemente("LLM", JALON_LLM_REEL);
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

export const getServiceLLM: () => ServiceLLM = creerFabrique<ServiceLLM>(
  () => new ServiceLLMMock(),
  () => new ServiceLLMReel(),
);
