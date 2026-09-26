# O'Bara — Constitution du projet

> Lu par Claude Code à chaque session. Fait autorité sur toute instruction implicite.
> Version 2 — 26 septembre 2026. Le hackathon n'a pas eu lieu : **plus de date butoir**.
> On construit un produit, pas une démo. La qualité prime sur la vitesse.

---

## 1. Ce qu'on construit, et pourquoi

**O'Bara** (*baara* = « le travail » en dioula) met en relation **par la voix**, en français,
dioula et baoulé, les travailleurs du secteur informel ivoirien et ceux qui cherchent leurs
services.

**Thèse :** le problème n'est pas de trouver du travail, c'est de **prouver** qu'on a
travaillé. O'Bara construit un **historique de missions** et une **réputation vocale**
portable pour des gens qui ne peuvent ni lire ni écrire leur CV. Le matching est une
commodité ; la preuve est le produit.

**L'utilisatrice de référence** s'appelle Awa : aide-ménagère à Yopougon, 40 000 FCFA par
mois, Android d'entrée de gamme, ne lit pas, parle dioula, envoie des vocaux WhatsApp tous
les jours et rien d'autre. **Toute fonctionnalité qu'Awa ne peut pas utiliser seule est
mal conçue.**

---

## 2. Le parcours de référence

C'est le test d'acceptation de bout en bout du produit. Il doit **toujours** fonctionner sur
`main`. Toute modification qui le casse est refusée, quelle que soit sa valeur par ailleurs.

1. Awa envoie un vocal **en dioula** sur WhatsApp : elle cherche du ménage, le matin, à Yopougon.
2. Le pipeline transcrit, détecte la langue, structure l'annonce en JSON, la vectorise.
3. Le moteur trouve Kouassi, qui a publié une demande compatible, et **explique pourquoi**.
4. Kouassi ouvre le profil d'Awa et **écoute** le témoignage vocal d'un ancien employeur.
5. Il accepte. Awa reçoit une **notification vocale dans sa langue**.
6. À la fin de la mission, Kouassi laisse un témoignage vocal. L'historique d'Awa s'enrichit.

Un test automatisé rejoue ce parcours avec les services simulés (`USE_MOCKS=true`).

---

## 3. Pile technique

| Couche | Choix | Raison |
|---|---|---|
| Application | **Next.js 15** (App Router) + TypeScript | Une base de code : web, API, webhook |
| Interface | Tailwind + composants maison | Pas de bibliothèque de composants |
| Données | **Supabase** : PostgreSQL + **pgvector** + stockage objet | Une base, un stockage audio, un seul service |
| ORM | Drizzle | pgvector propre, migrations lisibles |
| Canal principal | **WhatsApp Cloud API** | L'utilisatrice y est déjà |
| Client | **PWA** | Jamais d'application native |
| ASR français / anglais | Groq `whisper-large-v3-turbo` | Rapide, peu coûteux |
| ASR dioula / baoulé | **Service HTTP séparé, sur Linux** — modèle choisi par le banc | Voir §6 |
| Structuration | LLM choisi par le banc (`bench/score_structuration.py`) | Voir §6 |
| Embeddings | Gemini embeddings (multilingue) | |
| Déploiement | Vercel | |

**Toujours hors périmètre**, par décision de produit et non par manque de temps :
application native (on fait WhatsApp + PWA), microservices, Kubernetes, bibliothèque de
composants UI, internationalisation de l'interface (le *contenu* est multilingue, pas les
libellés).

**Désormais dans le périmètre**, parce qu'il n'y a plus d'urgence : tests réels, intégration
continue, authentification par OTP SMS réel, Mobile Money réel (Orange Money, MTN MoMo, Wave),
observabilité, suppression des données à la demande.

---

## 4. Le domaine est une source de vérité unique

Les listes métier vivent dans **`domaine/`**, en JSON, et sont consommées **à la fois** par
l'application TypeScript et par le banc d'essai Python. Ne jamais les recopier ailleurs.

| Fichier | Contenu |
|---|---|
| `domaine/metiers.json` | énumération **fermée** de 25 métiers : code neutre, libellé, synonymes, métiers proches |
| `domaine/zones.json` | 13 communes d'Abidjan, quartiers → commune (« Yop » → Yopougon), communes limitrophes |
| `domaine/champs.json` | valeurs fermées de `kind`, `disponibilite`, `tarif_unite` |
| `domaine/prompt_structuration.md` | **le** prompt de structuration, partagé avec le banc |

```ts
import metiers from "@/domaine/metiers.json";   // jamais une copie dans lib/
```

Modifier le prompt ou une liste du domaine **impose** de relancer
`pnpm bench:structuration` et de joindre le résultat à la pull request.

---

## 5. Données

```
users          id, phone, role(worker|employer|agency), display_name,
               lang_pref(fr|dyu|bci), id_verified, created_at, deleted_at
profiles       user_id, metiers[], zones[], dispo, tarif_min, tarif_max, bio_audio_url
listings       id, user_id, kind(offre|demande), audio_url, transcript_raw,
               lang_detected, asr_engine, asr_confidence, structured jsonb,
               embedding vector(768), status, created_at
matches        id, offre_id, demande_id, score, reasons jsonb, status, created_at
missions       id, match_id, started_at, ended_at, amount_fcfa, status
testimonials   id, mission_id, author_id, subject_id, audio_url, transcript,
               consent_audio_url, created_at
events         id, kind, payload jsonb, created_at
consents       id, user_id, kind, audio_url, given_at, withdrawn_at
```

`structured` suit **exactement** le schéma de `domaine/champs.json`, validé par Zod :

```json
{ "kind": "offre", "metier": "aide-menagere", "zones": ["Yopougon"],
  "disponibilite": "matin", "tarif_indicatif_fcfa": null, "tarif_unite": null }
```

Trois points issus du banc d'essai, non négociables :

- **`kind` peut valoir `hors_annonce`.** Une plainte, une question ou une salutation ne crée
  **jamais** d'annonce. Elle part vers le support.
- **`tarif_unite` accompagne toujours le tarif.** « 5 000 par jour » et « 60 000 par mois » ne
  sont pas comparables sans elle.
- **Les zones sont toujours des communes**, normalisées après le LLM avec `domaine/zones.json`.

---

## 6. Le pipeline vocal

```
audio (Opus, WhatsApp)
  → ASR (moteur choisi par langue)            → transcript brut
  → garde-fou d'écriture (§6.2)
  → LLM : structuration + normalisation EN FRANÇAIS → JSON validé par Zod
  → normalisation des zones (domaine/zones.json)
  → embedding SUR LE TEXTE FRANÇAIS NORMALISÉ  → pgvector
```

### 6.1 On n'embedde jamais le dioula ou le baoulé brut

Les modèles d'embedding y sont faibles : le vecteur serait du bruit. Le LLM normalise vers un
JSON français canonique, et c'est ce texte qui est vectorisé. Le matching fonctionne alors
identiquement quelle que soit la langue d'entrée.

### 6.2 Garde-fou d'écriture

Mesuré sur le banc : un modèle ASR multilingue sans étiquette de langue **dérive** — il a
produit du cyrillique (« монече ») et de l'orthographe yoruba sur du baoulé. Avant la
structuration, vérifier que le transcript est en alphabet latin (avec ɛ, ɔ, ŋ, ɲ et
diacritiques). Sinon : relancer avec l'étiquette de langue explicite, puis un autre moteur,
puis marquer l'annonce « à réécouter » plutôt que de structurer du bruit.

### 6.3 Les modèles vocaux ne tournent jamais en local

`fairseq2n` n'a pas de roue Windows : Omnilingual ne s'installe pas sur la machine de dev.
Les moteurs dioula et baoulé sont des **services HTTP sur Linux**, appelés derrière
`ASR_REMOTE_URL`. En développement, `USE_MOCKS=true` suffit.

### 6.4 Le choix d'un modèle se fait au banc, jamais sur une fiche

Le modèle de production pour chaque étage est celui qui passe les seuils du banc
(`docs/BANC-ESSAI.md`) sur **tous** les corpus. État des lieux vérifié :

- `Lingua-Africa/whisper-baoule-small` : dépôt **vide**. N'existe pas.
- `Klayt/wav2vec2-large-xlsr-baoule-demo` : **écarté**, ne transcrit pas (100 % de CER).
- `abdouaziiz/baoule` : WER annoncé invérifiable, corpus d'entraînement non public. À mesurer.
- `omniASR_CTC_300M_v2` : 23,7 % de CER sur Common Voice baoulé, 36,2 % sur Zenodo. Prometteur.
- `facebook/mms-tts-dyu` : licence **non commerciale**. Interdit en production.

---

## 7. Matching

Hybride : **filtres SQL durs** (métier ou métier proche, commune ou commune limitrophe,
disponibilité) puis **similarité cosinus** pour le classement.
Score = `0,6 × filtres + 0,4 × cosinus`. Les `reasons` sont stockées et affichables :
on doit toujours pouvoir expliquer pourquoi deux annonces ont matché.

---

## 8. Sécurité et données personnelles

**Le dépôt GitHub est public.** En conséquence :

- Aucun secret dans le code. `.env.local` est ignoré par Git ; `.env.example` documente les
  variables sans valeurs. Un secret poussé par erreur est **révoqué immédiatement**, pas
  seulement supprimé de l'historique.
- **Aucune voix réelle dans Git.** `bench/corpus_terrain/audio/` est ignoré. Le corpus vit
  dans un dataset Kaggle **privé**.
- Le consentement est **dit et enregistré**, jamais coché (table `consents`). Le retrait du
  consentement supprime l'audio et anonymise l'historique.
- L'audio brut des annonces est supprimé après transcription, sauf les témoignages consentis.

---

## 9. Direction artistique

L'interface ne doit **pas** ressembler à un produit généré par IA.

**Interdits :** palette violet/indigo par défaut, dégradés, `rounded-2xl`, `shadow-lg`,
`backdrop-blur`, hero centré avec bouton pilule, Inter partout, emoji en guise d'icônes.

**Direction : l'enseigne peinte d'Abidjan.** Les enseignes peintes à la main de Treichville
et d'Adjamé, la signalétique des maquis. Aplats francs, grotesque condensée et grasse pour
les titres, angles vifs (rayon 0-4 px), séparations par **bordures épaisses** jamais par
ombres portées. Latérite, jaune taxi, vert bâche, noir d'encre, fond papier.

**Contraintes terrain :** contraste AAA (plein soleil) · cibles tactiles ≥ 56 px (une main)
· **chaque action a une icône explicite ET un retour sonore** (utilisatrice qui ne lit pas)
· tout libellé critique a un bouton « écouter » · audio en Opus, images en AVIF.

---

## 10. Conventions

- **Français** pour le domaine : `metier`, `zone`, `dispo`, commits, commentaires.
- Server Components par défaut ; `"use client"` pour l'audio et le temps réel seulement.
- Toute sortie de LLM passe par **Zod**. Jamais de `JSON.parse` direct.
- Tout service externe a une **implémentation simulée** activable par `USE_MOCKS=true`.
- Pas de `any`. Pas de `console.log` (utiliser `lib/log.ts`).
- Une décision structurante s'inscrit dans `docs/DECISIONS.md` : date, décision, pourquoi,
  alternative écartée, signal qui ferait la rouvrir.

## 11. Commandes

```bash
pnpm dev                      # développement
pnpm test                     # tests unitaires + parcours de référence (mocks)
pnpm db:push / db:seed        # schéma, données de démonstration
pnpm bench:structuration      # python bench/score_structuration.py --modele baseline-motscles
python bench/rapport_asr.py   # tableau croisé des résultats ASR
```

## 12. Travailler avec les agents

Le plugin **O'Bara** fournit cinq agents. Avant de fusionner une modification significative,
demander une revue à **`obara-cto`**. Avant d'ajouter une fonctionnalité, la soumettre à
**`obara-produit`** avec le test d'Awa. Pour une décision qui engage plusieurs fonctions,
**`/obara-comite`**.
