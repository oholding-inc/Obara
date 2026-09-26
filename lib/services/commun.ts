import { utiliserMocks } from "@/lib/env";

/**
 * Utilitaires communs aux services (lib/services/*).
 *
 * Rôle : l'erreur « non implémenté » partagée par toutes les classes réelles,
 * la fabrique mock/réel commune, et les primitives DÉTERMINISTES (hachage
 * FNV-1a, générateur pseudo-aléatoire mulberry32, identifiants stables) qui
 * garantissent la propriété clé des mocks : même entrée → strictement même
 * sortie, sans réseau, sans Date.now(), sans Math.random().
 *
 * Moteur réel prévu : aucun (utilitaires purs).
 * Jalon : 1 (socle).
 */

// ---------------------------------------------------------------------------
// Erreur commune des implémentations réelles
// ---------------------------------------------------------------------------

/**
 * Levée par chaque méthode d'une classe « réelle » tant que le câblage externe
 * (Groq, Omnilingual ASR, Gemini, WhatsApp Cloud API, Supabase Storage) n'est
 * pas arrivé. Le message rappelle le plan B : USE_MOCKS=true (CLAUDE.md §7).
 */
export class ServiceNonImplemente extends Error {
  readonly service: string;
  readonly jalon: string;

  constructor(service: string, jalon: string) {
    super(
      `Service ${service} non implémenté (prévu : ${jalon}) — mettre USE_MOCKS=true pour la démo hors ligne`,
    );
    this.name = "ServiceNonImplemente";
    this.service = service;
    this.jalon = jalon;
  }
}

// ---------------------------------------------------------------------------
// Fabrique commune : mock si USE_MOCKS, sinon classe réelle (instances en cache)
// ---------------------------------------------------------------------------

/**
 * Construit une fabrique `getServiceX()` : la première fois qu'un mode (mock ou
 * réel) est demandé, l'instance correspondante est créée puis mise en cache
 * pour toute la vie du module. Les deux modes sont cachés séparément, ce qui
 * permet aux tests de basculer USE_MOCKS sans fuite d'instance.
 */
export function creerFabrique<T>(construireMock: () => T, construireReel: () => T): () => T {
  let instanceMock: T | undefined;
  let instanceReelle: T | undefined;
  return () => {
    if (utiliserMocks()) {
      instanceMock ??= construireMock();
      return instanceMock;
    }
    instanceReelle ??= construireReel();
    return instanceReelle;
  };
}

// ---------------------------------------------------------------------------
// Primitives déterministes
// ---------------------------------------------------------------------------

const FNV_DECALAGE_32 = 0x811c9dc5;
const FNV_PREMIER_32 = 0x01000193;

function enOctets(entree: string | Uint8Array): Uint8Array {
  return typeof entree === "string" ? new TextEncoder().encode(entree) : entree;
}

/**
 * FNV-1a 32 bits, non signé (0 ≤ résultat < 2^32). Les chaînes sont hachées
 * sur leurs octets UTF-8, donc « maçon » et « macon » donnent des hachés différents.
 */
export function hacherFnv1a(entree: string | Uint8Array): number {
  const octets = enOctets(entree);
  let hache = FNV_DECALAGE_32;
  for (const octet of octets) {
    hache ^= octet;
    hache = Math.imul(hache, FNV_PREMIER_32);
  }
  return hache >>> 0;
}

/**
 * Générateur pseudo-aléatoire mulberry32 : rapide, 32 bits d'état, reproductible.
 * Retourne des nombres dans [0, 1). Deux générateurs de même graine produisent
 * exactement la même suite.
 */
export function generateurPseudoAleatoire(graine: number): () => number {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Identifiant stable dérivé du contenu : `<prefixe>.<hash FNV-1a sur 8 hex>`.
 * Ex. identifiantDeterministe("wamid.mock", "225…|Bonjour") → "wamid.mock.1a2b3c4d".
 */
export function identifiantDeterministe(prefixe: string, entree: string | Uint8Array): string {
  return `${prefixe}.${hacherFnv1a(entree).toString(16).padStart(8, "0")}`;
}
