/**
 * Point d'entrée des services externes (CLAUDE.md §7) : chaque appel externe
 * (ASR, LLM, embeddings, WhatsApp, stockage) passe par une fabrique
 * `getServiceX()` qui renvoie le mock déterministe si USE_MOCKS=true, sinon
 * l'implémentation réelle (jalons suivants). Serveur uniquement.
 *
 * Jalon : 1 (socle).
 */

export {
  ServiceNonImplemente,
  hacherFnv1a,
  generateurPseudoAleatoire,
  identifiantDeterministe,
} from "./commun";

export { getServiceASR, TRANSCRIPTIONS_MOCK } from "./asr";
export type { ServiceASR, ResultatTranscription, OptionsTranscription, MoteurASR, TranscriptionMock } from "./asr";

export { getServiceLLM, LEXIQUE_MOCK_LOCAL } from "./llm";
export type { ServiceLLM, EntreeStructuration, ResultatStructuration, EntreeLexiqueMock } from "./llm";

export { getServiceEmbeddings, DIMENSION_EMBEDDING } from "./embeddings";
export type { ServiceEmbeddings } from "./embeddings";

export { getServiceWhatsApp, lireBoiteEnvoiMock, viderBoiteEnvoiMock } from "./whatsapp";
export type { ServiceWhatsApp, MessageSortant, MediaTelecharge, EnvoiMock } from "./whatsapp";

export { getServiceStorage } from "./storage";
export type { ServiceStorage, FichierStocke } from "./storage";
