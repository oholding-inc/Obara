import type { Langue } from "@/lib/domain/schemas";
import { creerLogger } from "@/lib/log";
import { creerFabrique, hacherFnv1a, ServiceNonImplemente } from "./commun";

/**
 * Service ASR — reconnaissance vocale (audio → texte + langue détectée).
 *
 * Rôle : première étape du pipeline vocal (CLAUDE.md §5). Le tableau de bord
 * affiche en direct « audio reçu → transcription → langue détectée ».
 *
 * Moteurs réels prévus (CLAUDE.md §3) :
 *   - niveau 1, FR/EN : Groq `whisper-large-v3-turbo` (garanti) ;
 *   - niveau 2, dioula/baoulé : Omnilingual ASR `facebook/omniASR-LLM-300M`
 *     auto-hébergé (OMNI_ASR_URL), évalué sur le corpus maison (CER affiché).
 *
 * Jalon : 1 = interface + mock déterministe (ce fichier) ; câblage réel aux
 * jalons suivants — aucun fetch, aucune clé lue ici.
 */

export type MoteurASR = "groq" | "omnilingual" | "mock";

export interface ResultatTranscription {
  texte: string;
  langue: Langue;
  /** Confiance globale, entre 0 et 1. */
  confiance: number;
  dureeAudioMs: number;
  moteur: MoteurASR;
}

export interface OptionsTranscription {
  /** Langue annoncée par l'utilisateur (lang_pref) ; l'ASR peut la contredire. */
  langueAttendue?: Langue;
  mimeType?: string;
  nomFichier?: string;
}

export interface ServiceASR {
  transcrire(audio: Uint8Array, options?: OptionsTranscription): Promise<ResultatTranscription>;
}

// ---------------------------------------------------------------------------
// Catalogue mock
// ---------------------------------------------------------------------------

export interface TranscriptionMock {
  /** Clé stable ; si `options.nomFichier` la contient, cette entrée est choisie. */
  cle: string;
  langue: Langue;
  texte: string;
  confiance: number;
}

/**
 * Confiance fixe par langue, reflétant le dégradé assumé (CLAUDE.md §5) :
 * niveau 1 (Groq, FR/EN) très fiable ; niveau 2 (Omnilingual, dioula/baoulé)
 * plus faible, et on ne le cache pas.
 */
const CONFIANCE_MOCK_PAR_LANGUE: Record<Langue, number> = {
  fr: 0.96,
  en: 0.96,
  dyu: 0.78,
  bci: 0.74,
};

const DUREE_AUDIO_MIN_MS = 1_000;
const DUREE_AUDIO_MAX_MS = 40_000; // Omnilingual ASR : audio < 40 s (CLAUDE.md §3)

/**
 * Huit transcriptions réalistes couvrant la scène de démo (Awa, Kouassi) et
 * le seed (maçon, mécanicien, couturière, employeur anglophone).
 *
 * Les textes en dioula et en baoulé sont des PLACEHOLDERS en orthographe
 * standard, à valider par un locuteur ; ils seront remplacés par les vraies
 * transcriptions du corpus maison quand il existera.
 */
export const TRANSCRIPTIONS_MOCK: readonly TranscriptionMock[] = [
  {
    // Awa, aide-ménagère, Yopougon, disponible le matin — en dioula.
    // « Je m'appelle Awa. Je fais le travail de maison, à Yopougon. Je peux travailler le matin. »
    // Sera remplacée par la vraie transcription du corpus.
    cle: "awa-dyu",
    langue: "dyu",
    texte: "N tɔgɔ ye Awa. N bɛ so baara kɛ, Yopougon. N bɛ se ka baara kɛ sɔgɔma.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.dyu,
  },
  {
    // La même annonce, dite en français.
    cle: "awa-fr",
    langue: "fr",
    texte:
      "Je m'appelle Awa, je suis aide-ménagère à Yopougon. Je fais le ménage, le repassage et la cuisine. Je suis disponible le matin. J'ai 3 ans d'expérience.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.fr,
  },
  {
    // Kouassi, employeur à Cocody Angré : la demande qui matche avec Awa.
    cle: "kouassi-fr",
    langue: "fr",
    texte:
      "Bonjour, je suis Kouassi, j'habite à Cocody Angré. Je cherche une aide-ménagère pour le matin, du lundi au vendredi, pour le ménage et la cuisine. Je propose 45 000 francs par mois.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.fr,
  },
  {
    // Koffi, maçon à Abobo — en baoulé (placeholder, à valider par un locuteur).
    // « Je m'appelle Koffi. Je suis maçon. J'habite Abobo. Je peux travailler le matin. »
    // Sera remplacée par la vraie transcription du corpus.
    cle: "macon-bci",
    langue: "bci",
    texte: "Min dunman ti Koffi. N ti sua kplanfuɛ. N tran Abobo. N kwla di junman nglɛmun.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.bci,
  },
  {
    cle: "macon-fr",
    langue: "fr",
    texte:
      "Moi c'est Koffi, je suis maçon à Abobo. Je fais les murs, le crépissage et la dalle. Je peux travailler toute la journée. J'ai 8 ans d'expérience.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.fr,
  },
  {
    cle: "mecanicien-fr",
    langue: "fr",
    texte:
      "Je m'appelle Ibrahim, je suis mécanicien à Abobo. J'ai 5 ans d'expérience : moteur, freins, vidange. Je suis disponible toute la journée.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.fr,
  },
  {
    cle: "couturiere-fr",
    langue: "fr",
    texte:
      "Bonjour, moi c'est Mariam, couturière à Treichville. Je couds les pagnes, les robes et les uniformes. Je suis disponible l'après-midi.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.fr,
  },
  {
    // Une demande en anglais (niveau 1, Groq).
    cle: "employeur-en",
    langue: "en",
    texte:
      "Hello, my name is Grace, I live in Cocody. I am looking for a nanny for my two children, in the evenings. I can pay 60,000 francs per month.",
    confiance: CONFIANCE_MOCK_PAR_LANGUE.en,
  },
];

// ---------------------------------------------------------------------------
// Mock déterministe
// ---------------------------------------------------------------------------

const journal = creerLogger("services:asr");

/**
 * Choix de l'entrée du catalogue, dans cet ordre :
 *  1. `options.nomFichier` contient une clé du catalogue → cette entrée ;
 *  2. `options.langueAttendue` → première entrée de cette langue ;
 *  3. sinon hacherFnv1a(audio) modulo la taille du catalogue.
 */
function choisirTranscription(audio: Uint8Array, options: OptionsTranscription | undefined): TranscriptionMock {
  const nomFichier = options?.nomFichier?.toLowerCase();
  if (nomFichier) {
    const parNom = TRANSCRIPTIONS_MOCK.find((entree) => nomFichier.includes(entree.cle));
    if (parNom) return parNom;
  }
  if (options?.langueAttendue) {
    const parLangue = TRANSCRIPTIONS_MOCK.find((entree) => entree.langue === options.langueAttendue);
    if (parLangue) return parLangue;
  }
  const indice = hacherFnv1a(audio) % TRANSCRIPTIONS_MOCK.length;
  return TRANSCRIPTIONS_MOCK[indice];
}

/** Durée plausible dérivée de la taille de l'audio, bornée entre 1 s et 40 s. */
function estimerDureeMs(audio: Uint8Array): number {
  const estimation = Math.round(audio.length / 4);
  return Math.min(DUREE_AUDIO_MAX_MS, Math.max(DUREE_AUDIO_MIN_MS, estimation));
}

class ServiceASRMock implements ServiceASR {
  async transcrire(audio: Uint8Array, options?: OptionsTranscription): Promise<ResultatTranscription> {
    const entree = choisirTranscription(audio, options);
    const resultat: ResultatTranscription = {
      texte: entree.texte,
      langue: entree.langue,
      confiance: entree.confiance,
      dureeAudioMs: estimerDureeMs(audio),
      moteur: "mock",
    };
    journal.debug("transcription mock", {
      cle: entree.cle,
      langue: entree.langue,
      octets: audio.length,
      nomFichier: options?.nomFichier,
    });
    return resultat;
  }
}

// ---------------------------------------------------------------------------
// Classe réelle — câblage Groq / Omnilingual ASR aux jalons suivants
// ---------------------------------------------------------------------------

const JALON_ASR_REEL = "jalon 2, pipeline vocal — Groq whisper-large-v3-turbo (FR/EN) + Omnilingual ASR (dioula/baoulé)";

class ServiceASRReel implements ServiceASR {
  async transcrire(): Promise<ResultatTranscription> {
    throw new ServiceNonImplemente("ASR", JALON_ASR_REEL);
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

export const getServiceASR: () => ServiceASR = creerFabrique<ServiceASR>(
  () => new ServiceASRMock(),
  () => new ServiceASRReel(),
);
