import { mots } from "@/lib/domain/texte";
import { creerLogger } from "@/lib/log";
import { creerFabrique, hacherFnv1a, ServiceNonImplemente } from "./commun";

/**
 * Service d'embeddings — texte français normalisé → vecteur pour pgvector.
 *
 * Rôle : troisième étape du pipeline vocal (CLAUDE.md §5). On n'embedde JAMAIS
 * le dioula ou le baoulé brut : l'entrée est toujours `texteNormaliseFr`
 * produit par le service LLM. La colonne `listings.embedding` est un
 * `vector(768)` (CLAUDE.md §4), d'où DIMENSION_EMBEDDING.
 *
 * Moteur réel prévu (CLAUDE.md §3) : Gemini embeddings (multilingue), même clé
 * GEMINI_API_KEY que le LLM.
 *
 * Jalon : 1 = interface + mock déterministe ; câblage réel aux jalons suivants.
 */

export const DIMENSION_EMBEDDING = 768;

export interface ServiceEmbeddings {
  embed(texte: string): Promise<number[]>;
  embedLot(textes: string[]): Promise<number[][]>;
}

// ---------------------------------------------------------------------------
// Mock : « hashing trick »
// ---------------------------------------------------------------------------

/**
 * Vecteur creux par hachage (« hashing trick ») :
 *  - jetons = chaque mot de mots(texte) + chaque bigramme de mots consécutifs ;
 *  - pour chaque jeton, indice = FNV-1a(jeton) mod 768 et signe = bit de poids
 *    fort de FNV-1a("s:" + jeton) (le bit de poids faible serait lié à la parité
 *    de l'indice) ; on accumule ±1 ;
 *  - normalisation L2 ; un texte sans mot donne 768 zéros.
 *
 * Propriété utile : deux textes qui partagent des mots/bigrammes ont un cosinus
 * élevé (« Aide-ménagère à Yopougon — le matin » vs « aide-ménagère Yopougon
 * matin »), donc le matching hors ligne reste crédible. Ce n'est PAS sémantique :
 * « maçon » et « bâtisseur » restent orthogonaux. Le vrai rattrapage sémantique
 * (« refaire mon mur » → maçon) viendra avec Gemini.
 */
function vecteurParHachage(texte: string): number[] {
  const vecteur = new Array<number>(DIMENSION_EMBEDDING).fill(0);
  const jetons = mots(texte);
  if (jetons.length === 0) return vecteur;

  const tousLesJetons = [...jetons];
  for (let i = 0; i + 1 < jetons.length; i++) {
    tousLesJetons.push(`${jetons[i]} ${jetons[i + 1]}`);
  }

  for (const jeton of tousLesJetons) {
    const indice = hacherFnv1a(jeton) % DIMENSION_EMBEDDING;
    const signe = hacherFnv1a(`s:${jeton}`) >>> 31 === 1 ? 1 : -1;
    vecteur[indice] += signe;
  }

  let sommeCarres = 0;
  for (const composante of vecteur) sommeCarres += composante * composante;
  const norme = Math.sqrt(sommeCarres);
  if (norme === 0) return vecteur; // possible si tous les signes s'annulent
  return vecteur.map((composante) => composante / norme);
}

const journal = creerLogger("services:embeddings");

class ServiceEmbeddingsMock implements ServiceEmbeddings {
  async embed(texte: string): Promise<number[]> {
    const vecteur = vecteurParHachage(texte);
    journal.debug("embedding mock", { longueurTexte: texte.length, dimension: vecteur.length });
    return vecteur;
  }

  async embedLot(textes: string[]): Promise<number[][]> {
    journal.debug("embedding mock (lot)", { nombre: textes.length });
    return textes.map((texte) => vecteurParHachage(texte));
  }
}

// ---------------------------------------------------------------------------
// Classe réelle — câblage Gemini embeddings aux jalons suivants
// ---------------------------------------------------------------------------

const JALON_EMBEDDINGS_REEL = "jalon 2, pipeline vocal — Gemini embeddings (768 dimensions)";

class ServiceEmbeddingsReel implements ServiceEmbeddings {
  async embed(): Promise<number[]> {
    throw new ServiceNonImplemente("Embeddings", JALON_EMBEDDINGS_REEL);
  }

  async embedLot(): Promise<number[][]> {
    throw new ServiceNonImplemente("Embeddings", JALON_EMBEDDINGS_REEL);
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

export const getServiceEmbeddings: () => ServiceEmbeddings = creerFabrique<ServiceEmbeddings>(
  () => new ServiceEmbeddingsMock(),
  () => new ServiceEmbeddingsReel(),
);
