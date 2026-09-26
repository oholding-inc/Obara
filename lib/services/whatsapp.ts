import { creerLogger } from "@/lib/log";
import { creerFabrique, generateurPseudoAleatoire, hacherFnv1a, identifiantDeterministe, ServiceNonImplemente } from "./commun";

/**
 * Service WhatsApp — envoi de messages (texte, audio) et récupération des
 * médias reçus par le webhook.
 *
 * Rôle : plans 1 et 6 de la scène de démo (CLAUDE.md §2) — Awa envoie un vocal
 * en dioula, puis reçoit une notification vocale dans sa langue.
 *
 * Moteur réel prévu (CLAUDE.md §3) : WhatsApp Cloud API avec le numéro de TEST
 * Meta (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).
 *
 * Jalon : 1 = interface + mock déterministe avec boîte d'envoi en mémoire ;
 * câblage réel aux jalons suivants.
 */

export interface MessageSortant {
  messageId: string;
}

export interface MediaTelecharge {
  bytes: Uint8Array;
  mimeType: string;
}

/** Un envoi enregistré par le mock, relisible par le tableau de bord ou les tests. */
export interface EnvoiMock {
  type: "texte" | "audio";
  destinataire: string;
  /** Le texte du message, ou l'URL de l'audio. */
  contenu: string;
  messageId: string;
  /** Compteur incrémental (1, 2, 3…), remis à zéro par viderBoiteEnvoiMock(). */
  ordre: number;
}

export interface ServiceWhatsApp {
  envoyerTexte(destinataire: string, texte: string): Promise<MessageSortant>;
  envoyerAudio(destinataire: string, audioUrl: string): Promise<MessageSortant>;
  telechargerMedia(mediaId: string): Promise<MediaTelecharge>;
}

// ---------------------------------------------------------------------------
// Boîte d'envoi du mock (état de module, en mémoire)
// ---------------------------------------------------------------------------

const boiteEnvoi: EnvoiMock[] = [];
let compteurOrdre = 0;

/** Copie en lecture seule des envois effectués par le mock depuis le dernier vidage. */
export function lireBoiteEnvoiMock(): readonly EnvoiMock[] {
  return boiteEnvoi.map((envoi) => ({ ...envoi }));
}

/** Vide la boîte d'envoi et remet le compteur d'ordre à zéro. */
export function viderBoiteEnvoiMock(): void {
  boiteEnvoi.length = 0;
  compteurOrdre = 0;
}

// ---------------------------------------------------------------------------
// Mock déterministe
// ---------------------------------------------------------------------------

const TAILLE_MEDIA_MOCK = 8_000;
const MIME_MEDIA_MOCK = "audio/ogg"; // WhatsApp livre les vocaux en Opus dans un conteneur OGG

const journal = creerLogger("services:whatsapp");

function enregistrerEnvoi(type: EnvoiMock["type"], destinataire: string, contenu: string): MessageSortant {
  const messageId = identifiantDeterministe("wamid.mock", `${destinataire}|${contenu}`);
  compteurOrdre += 1;
  boiteEnvoi.push({ type, destinataire, contenu, messageId, ordre: compteurOrdre });
  journal.info(`envoi mock (${type})`, { destinataire, messageId, ordre: compteurOrdre, contenu });
  return { messageId };
}

class ServiceWhatsAppMock implements ServiceWhatsApp {
  async envoyerTexte(destinataire: string, texte: string): Promise<MessageSortant> {
    return enregistrerEnvoi("texte", destinataire, texte);
  }

  async envoyerAudio(destinataire: string, audioUrl: string): Promise<MessageSortant> {
    return enregistrerEnvoi("audio", destinataire, audioUrl);
  }

  /** 8 000 octets pseudo-aléatoires, reproductibles à partir du mediaId. */
  async telechargerMedia(mediaId: string): Promise<MediaTelecharge> {
    const suivant = generateurPseudoAleatoire(hacherFnv1a(mediaId));
    const bytes = new Uint8Array(TAILLE_MEDIA_MOCK);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(suivant() * 256);
    }
    journal.debug("téléchargement média mock", { mediaId, octets: bytes.length, mimeType: MIME_MEDIA_MOCK });
    return { bytes, mimeType: MIME_MEDIA_MOCK };
  }
}

// ---------------------------------------------------------------------------
// Classe réelle — câblage WhatsApp Cloud API aux jalons suivants
// ---------------------------------------------------------------------------

const JALON_WHATSAPP_REEL = "jalon 3, boucle WhatsApp — Cloud API, numéro de test Meta";

class ServiceWhatsAppReel implements ServiceWhatsApp {
  async envoyerTexte(): Promise<MessageSortant> {
    throw new ServiceNonImplemente("WhatsApp", JALON_WHATSAPP_REEL);
  }

  async envoyerAudio(): Promise<MessageSortant> {
    throw new ServiceNonImplemente("WhatsApp", JALON_WHATSAPP_REEL);
  }

  async telechargerMedia(): Promise<MediaTelecharge> {
    throw new ServiceNonImplemente("WhatsApp", JALON_WHATSAPP_REEL);
  }
}

// ---------------------------------------------------------------------------
// Fabrique
// ---------------------------------------------------------------------------

export const getServiceWhatsApp: () => ServiceWhatsApp = creerFabrique<ServiceWhatsApp>(
  () => new ServiceWhatsAppMock(),
  () => new ServiceWhatsAppReel(),
);
