import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { creerLogger } from "@/lib/log";
import { creerFabrique, ServiceNonImplemente } from "./commun";

/**
 * Service de stockage — blobs audio (vocaux reçus, témoignages, notifications).
 *
 * Rôle : jamais de blob audio en base (CLAUDE.md §3) ; la base ne garde que
 * `audio_url`. Serveur uniquement (node:fs) : ne jamais importer ce module
 * depuis un composant client.
 *
 * Moteur réel prévu (CLAUDE.md §3) : Supabase Storage (S3-compatible),
 * bucket SUPABASE_STORAGE_BUCKET.
 *
 * Jalon : 1 = interface + mock sur disque local (public/mock-storage/, dossier
 * gitignoré) ; câblage réel aux jalons suivants.
 * ATTENTION : l'URL /mock-storage/<cle> n'est servie que sous `pnpm dev` ;
 * `next start` ne sert que les fichiers présents dans public/ au démarrage
 * (404 pour tout fichier écrit ensuite) et sur Vercel le disque est en lecture
 * seule. Démo hors ligne = `pnpm dev`.
 */

export interface FichierStocke {
  cle: string;
  /** URL relative ou absolue utilisable par un lecteur audio. */
  url: string;
  /** Taille en octets. */
  taille: number;
  contentType: string;
}

export interface ServiceStorage {
  televerser(cle: string, bytes: Uint8Array, contentType: string): Promise<FichierStocke>;
  /** `null` si la clé n'existe pas. */
  telecharger(cle: string): Promise<Uint8Array | null>;
  urlPublique(cle: string): string;
}

// ---------------------------------------------------------------------------
// Validation des clés (commune au mock et, plus tard, au réel)
// ---------------------------------------------------------------------------

const MOTIF_CLE_VALIDE = /^[A-Za-z0-9._/-]+$/;

/**
 * Une clé est un chemin relatif POSIX : segments `[A-Za-z0-9._-]` séparés par
 * `/`. Refusés : chaîne vide, chemin absolu, backslash, segment `.` ou `..`,
 * segment finissant par `.`, tout autre caractère.
 */
function validerCle(cle: string): void {
  const explication = "autorisé : lettres, chiffres, « . », « _ », « - », « / » ; ni chemin absolu, ni segment « . » / « .. » ou finissant par « . »";
  if (cle.length === 0) {
    throw new Error(`Clé de stockage vide (${explication})`);
  }
  if (!MOTIF_CLE_VALIDE.test(cle) || cle.startsWith("/") || cle.endsWith("/")) {
    throw new Error(`Clé de stockage invalide : « ${cle} » (${explication})`);
  }
  if (
    cle
      .split("/")
      .some((segment) => segment.length === 0 || segment === "." || segment === ".." || segment.endsWith("."))
  ) {
    throw new Error(`Clé de stockage invalide : « ${cle} » (${explication})`);
  }
}

// ---------------------------------------------------------------------------
// Mock : disque local sous public/mock-storage/
// ---------------------------------------------------------------------------

const PREFIXE_URL_MOCK = "/mock-storage/";

const journal = creerLogger("services:storage");

function racineMock(): string {
  return join(process.cwd(), "public", "mock-storage");
}

function cheminLocal(cle: string): string {
  validerCle(cle);
  const racine = racineMock();
  const chemin = join(racine, cle);
  // Ceinture et bretelles : la clé validée ne peut pas sortir de la racine, on le vérifie quand même.
  if (!chemin.startsWith(racine + sep)) {
    throw new Error(`Clé de stockage invalide : « ${cle} » (sort du dossier de stockage)`);
  }
  return chemin;
}

function estFichierAbsent(erreur: unknown): boolean {
  return (
    typeof erreur === "object" &&
    erreur !== null &&
    "code" in erreur &&
    (erreur as { code?: unknown }).code === "ENOENT"
  );
}

class ServiceStorageMock implements ServiceStorage {
  async televerser(cle: string, bytes: Uint8Array, contentType: string): Promise<FichierStocke> {
    const chemin = cheminLocal(cle);
    await mkdir(dirname(chemin), { recursive: true });
    await writeFile(chemin, bytes);
    journal.debug("téléversement mock", { cle, octets: bytes.length, contentType });
    return { cle, url: this.urlPublique(cle), taille: bytes.length, contentType };
  }

  async telecharger(cle: string): Promise<Uint8Array | null> {
    const chemin = cheminLocal(cle);
    try {
      const contenu = await readFile(chemin);
      journal.debug("téléchargement mock", { cle, octets: contenu.length });
      return new Uint8Array(contenu);
    } catch (erreur) {
      if (estFichierAbsent(erreur)) {
        journal.debug("téléchargement mock : clé absente", { cle });
        return null;
      }
      throw erreur;
    }
  }

  urlPublique(cle: string): string {
    validerCle(cle);
    return `${PREFIXE_URL_MOCK}${cle}`;
  }
}

// ---------------------------------------------------------------------------
// Classe réelle — câblage Supabase Storage aux jalons suivants
// ---------------------------------------------------------------------------

const JALON_STORAGE_REEL = "jalon 2, pipeline vocal — Supabase Storage (bucket audio)";

class ServiceStorageReel implements ServiceStorage {
  async televerser(): Promise<FichierStocke> {
    throw new ServiceNonImplemente("Storage", JALON_STORAGE_REEL);
  }

  async telecharger(): Promise<Uint8Array | null> {
    throw new ServiceNonImplemente("Storage", JALON_STORAGE_REEL);
  }

  urlPublique(): string {
    throw new ServiceNonImplemente("Storage", JALON_STORAGE_REEL);
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

export const getServiceStorage: () => ServiceStorage = creerFabrique<ServiceStorage>(
  () => new ServiceStorageMock(),
  () => new ServiceStorageReel(),
);
