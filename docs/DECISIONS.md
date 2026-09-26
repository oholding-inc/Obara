# Journal des décisions

Une ligne par décision structurante. On n'efface jamais : une décision révisée reçoit une
nouvelle entrée qui renvoie à l'ancienne.

| Date | Décision | Pourquoi | Alternative écartée | Ce qui la rouvrirait |
|---|---|---|---|---|
| 2026-09-01 | **PWA + WhatsApp, jamais d'application native** | L'utilisatrice a déjà WhatsApp et sait envoyer un vocal ; une application à installer est une barrière | React Native (prévu dans le DAT) | Des utilisateurs qui réclament une app, observés sur le terrain |
| 2026-09-01 | **PostgreSQL + pgvector**, une seule base | Une base au lieu de deux à maintenir pour une équipe de deux | PostgreSQL + ChromaDB (prévu dans le DAT) | Plus d'un million de vecteurs, ou des requêtes vectorielles > 200 ms |
| 2026-09-06 | **Le travailleur ne paie jamais** | 3 000 FCFA sur 40 000 = 7,5 % du revenu ; le travailleur est l'actif, pas le client | Abonnement prestataire (modèle Wedu) | Aucun — principe fondateur |
| 2026-09-06 | **On n'embedde jamais le dioula ou le baoulé brut** : le LLM normalise en français, on vectorise le français | Les modèles d'embedding sont faibles sur ces langues | Embedding direct du transcript | Un modèle d'embedding mesuré bon sur dioula et baoulé |
| 2026-09-06 | **Pas de TTS en entrée du pipeline** pour évaluer l'ASR | Mesurer un ASR sur de l'audio synthétique ne mesure rien | Générer le corpus d'évaluation par synthèse vocale | Aucun |
| 2026-09-09 | **Supabase** plutôt que Neon | Postgres + pgvector + stockage objet audio dans un seul service | Neon + stockage S3 séparé | Coût Supabase au-delà du palier gratuit |
| 2026-09-26 | **Fin de la contrainte hackathon** — CLAUDE.md v2 | L'événement n'a pas eu lieu ; on construit un produit | Garder le plan de 12 jours | — |
| 2026-09-26 | **Kaggle pour mesurer, Colab pour explorer, ni l'un ni l'autre pour servir** | Exécution en arrière-plan gratuite ; le checkpoint LLM 3B (17,5 Go) ne tient pas dans la RAM d'un Colab gratuit | Tout sur Colab | Colab gratuit qui offrirait l'exécution en arrière-plan |
| 2026-09-26 | **`domaine/` en JSON, source unique** pour l'app et le banc | Deux copies d'une liste de métiers divergent toujours | Listes en TypeScript dans `lib/domain/` | — |
| 2026-09-26 | **`kind: hors_annonce`** et **`tarif_unite`** ajoutés au schéma | Révélé par le jeu d'or : une plainte devenait une annonce ; « par jour » et « par mois » étaient confondus | Schéma v1 | — |
| 2026-09-26 | **`Klayt/wav2vec2-…-baoule-demo` écarté** ; **`Lingua-Africa/whisper-baoule-small` inexistant** | 100 % de CER (témoin positif du banc à 2,2 %) ; dépôt vide | — | Nouvelle version publiée du modèle |
| 2026-09-26 | **`facebook/mms-tts-dyu` interdit en production** | Licence CC-BY-NC-4.0, non commerciale | L'utiliser en production | Accord de licence de Meta, ou voix dioula maison |
