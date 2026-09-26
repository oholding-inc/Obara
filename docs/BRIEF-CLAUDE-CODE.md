# Brief Claude Code — O'Bara, phase 2

Il n'y a plus de date butoir. Le plan n'est donc plus découpé en jours mais en **chantiers**,
chacun avec un critère d'arrêt vérifiable. On ne passe au suivant que quand le précédent est
vérifié à la main — pas seulement annoncé comme fait.

**Avant tout** : copier dans le dossier local du projet les fichiers de ce paquet
(`CLAUDE.md`, `domaine/`, `bench/`, `docs/`, `.gitignore`, `.env.example`). `CLAUDE.md` à la
racine fait le travail de cadrage à chaque session.

---

## Prompt 0 — Rapatrier le code sur GitHub, sans fuite

> Le dépôt `github.com/oholding-inc/Obara` est **public** et ne contient aujourd'hui qu'un
> README. Tout ton code est resté en local. Ce prompt le pousse proprement.

```
Le dossier courant contient le code d'O'Bara écrit jusqu'ici, et le dépôt distant
https://github.com/oholding-inc/Obara.git est PUBLIC. Avant tout push, la sécurité.

1. Si ce n'est pas déjà un dépôt Git : git init, branche main.
2. Vérifie que .gitignore (fourni) est en place AVANT tout git add. Il doit exclure
   node_modules, .next, .env*, sauf .env.example, et bench/corpus_terrain/audio/.
3. Recherche de secrets dans tout ce qui serait commité :
   - fichiers .env, .env.local, *.pem, *.key, credentials*.json
   - motifs de clés : "sk-", "gsk_", "AIza", "eyJhbGci", "EAAG" (jeton Meta),
     "SUPABASE_SERVICE_ROLE", "service_role", tout JWT en clair
   Affiche chaque occurrence trouvée avec fichier et ligne. S'il y en a une seule :
   ARRÊTE-TOI et dis-moi quelle clé révoquer. Ne pousse rien.
4. git remote add origin https://github.com/oholding-inc/Obara.git
   git pull origin main --allow-unrelated-histories   (récupère le README distant)
5. Prépare un commit « Import du code existant », mais NE POUSSE PAS.
   Affiche-moi : la liste des fichiers commités, leur nombre, la taille totale,
   et confirme qu'aucun fichier audio ni secret n'en fait partie.
6. Attends mon « go » explicite avant git push.
```

**Critère d'arrêt** : le code est sur GitHub, `git log` montre l'import, et une recherche de
`AIza`, `gsk_` et `service_role` sur la page GitHub du dépôt ne renvoie rien.

---

## Prompt 1 — Audit de l'existant

> Je n'ai pas pu voir ton code. Ce prompt fait faire l'audit par Claude Code, dans un format
> fixe. **Recolle-moi le rapport** : je le relis et je te dis quoi corriger en priorité.

```
Lis CLAUDE.md (version 2) en entier, puis audite TOUT le code existant contre lui.
N'écris AUCUN code pendant ce prompt. Tu produis un rapport, rien d'autre.

Format imposé, en français, dans docs/AUDIT-2026-09.md :

## 1. Inventaire
Arborescence (hors node_modules), nombre de fichiers et de lignes par type, dépendances
principales avec versions, scripts package.json, variables d'environnement utilisées.

## 2. Ce qui fonctionne
Pour chaque étape du parcours de référence (CLAUDE.md §2, étapes 1 à 6) :
FAIT / PARTIEL / ABSENT, avec les fichiers concernés. Lance ce qui peut être lancé
(pnpm dev, pnpm test, db:push) et rapporte le résultat réel, pas l'intention.

## 3. Écarts avec la constitution
Un tableau : règle de CLAUDE.md · statut (respectée / violée / non applicable) ·
preuve (fichier:ligne). Vérifie au minimum :
- §4 le domaine est-il lu depuis domaine/*.json, ou recopié ailleurs ?
- §5 kind accepte-t-il "hors_annonce" ? tarif_unite existe-t-il ? table consents ?
- §6.1 embedde-t-on le texte français normalisé, ou le transcript brut ?
- §6.2 existe-t-il un garde-fou d'écriture sur la sortie ASR ?
- §6.3 un modèle vocal est-il appelé en local plutôt que par HTTP ?
- §8 y a-t-il un secret, une clé ou un fichier audio réel dans le dépôt ?
- §9 trouve-t-on violet/indigo, dégradés, rounded-2xl, shadow-lg, Inter, emoji-icônes ?
- §10 JSON.parse direct sur une sortie de LLM ? des any ? des console.log ?
- USE_MOCKS=true fait-il tourner tout le parcours sans réseau ?

## 4. Dette et risques
Classés Bloquant / Important / Mineur, chacun avec fichier:ligne et la correction proposée
en une phrase.

## 5. Ce que tu recommandes de faire en premier
Trois actions, pas plus, par ordre de valeur, chacune rattachée à une ligne du §3 ou §4.
```

**Critère d'arrêt** : `docs/AUDIT-2026-09.md` existe, chaque ligne du §3 a une preuve.

---

## Prompt 2 — Brancher le domaine partagé et le schéma v2

```
Mets le code en conformité avec CLAUDE.md §4 et §5, en suivant le rapport d'audit.

1. L'application lit domaine/metiers.json, zones.json et champs.json directement
   (import JSON). Supprime toute copie de ces listes ailleurs. Génère les types
   TypeScript à partir du JSON (as const), pas l'inverse.
2. Le schéma Zod de structuration dérive de domaine/champs.json : kind inclut
   "hors_annonce", tarif_unite est présent, metier est l'énumération fermée.
3. Le prompt de structuration est lu depuis domaine/prompt_structuration.md, avec
   les mêmes remplacements que bench/score_structuration.py (fonction
   construire_prompt). Un seul prompt pour l'app et pour le banc.
4. Une annonce "hors_annonce" ne crée jamais de ligne dans listings : elle crée un
   événement support.
5. Normalisation des zones après le LLM, avec domaine/zones.json (quartiers et surnoms
   ramenés à la commune), portage exact de normaliser_zones() du banc.
6. Migration Drizzle : tarif_unite, asr_engine, asr_confidence, table consents,
   users.deleted_at.
7. Ajoute le script pnpm bench:structuration.

Tests : un test par cas du jeu DEV de bench/golden_structuration.jsonl qui vérifie que
le parseur Zod accepte l'attendu. N'utilise JAMAIS le jeu TEST pour régler quoi que ce soit.
```

**Critère d'arrêt** : `pnpm bench:structuration` tourne ; un JSON avec `metier: "informaticien"`
est rejeté par le parseur ; une plainte ne crée pas d'annonce.

---

## Prompt 3 — Le parcours de référence en test automatisé

```
Écris un test de bout en bout qui rejoue le parcours de référence (CLAUDE.md §2, étapes
1 à 6) avec USE_MOCKS=true, sans aucun appel réseau :
vocal dioula d'Awa → annonce structurée → match avec la demande de Kouassi, avec reasons
→ témoignage vocal lisible sur le profil → acceptation → notification vocale →
fin de mission → historique enrichi.

Ce test doit tourner en moins de 30 secondes et être la première chose lancée par
pnpm test. S'il échoue, rien d'autre n'a d'importance.
```

**Critère d'arrêt** : `pnpm test` passe, et casser volontairement l'étape de matching fait
échouer ce test précis avec un message lisible.

---

## Prompt 4 — Garde-fou d'écriture et service ASR distant

```
1. Garde-fou d'écriture (CLAUDE.md §6.2) : fonction pure estEcritureLatine(texte) qui
   accepte l'alphabet latin, ɛ ɔ ŋ ɲ ƐƆŊƝ, les diacritiques et apostrophes, et rejette
   le cyrillique, l'arabe, le CJK. Tests : « монече » rejeté, « klɔ'n i akpɔ'm » accepté,
   « é á fiẹn » accepté mais marqué suspect si la langue attendue est bci.
   Stratégie de repli : étiquette de langue explicite → autre moteur → « à réécouter ».
2. Service ASR distant dans services/asr-remote/ : FastAPI, POST /transcrire
   (audio multipart + langue), réponse {texte, langue, moteur, duree_ms}.
   Dockerfile avec torch 2.8.0 ET torchaudio==2.8.0 épinglés (sinon libcudart.so.13
   introuvable), choix de précision selon le GPU (bfloat16 seulement si supporté).
   Le modèle servi est un paramètre, pas une constante : le banc décidera.
3. lib/services/asr.ts appelle ce service derrière ASR_REMOTE_URL, avec délai
   d'expiration, une relance, et repli sur le mock en développement.
Ne déploie rien : on choisira l'hébergement après le banc (docs/COLAB-VS-KAGGLE.md §5).
```

**Critère d'arrêt** : `docker build` réussit ; les tests du garde-fou passent.

---

## Prompt 5 — Intégration continue

```
GitHub Actions, un seul workflow sur pull request :
1. pnpm install, typecheck, lint, pnpm test (dont le parcours de référence).
2. python bench/score_structuration.py --modele baseline-motscles : doit s'exécuter
   sans erreur (vérifie que le banc n'est pas cassé).
3. Si la PR modifie domaine/ ou prompt_structuration.md, et si le secret GEMINI_API_KEY
   est défini : lance aussi le banc sur le modèle de production et publie le tableau
   de scores en commentaire de la PR.
4. Échec si un fichier de bench/corpus_terrain/audio/ ou un .env est présent dans la PR.
```

**Critère d'arrêt** : une PR de test affiche les contrôles verts et, si elle touche le
prompt, un commentaire avec les scores.

---

## Prompt 6 — WhatsApp réel et réputation vocale

```
1. Webhook WhatsApp Cloud API : vérification, réception des messages audio,
   téléchargement du média, passage dans le pipeline existant. Aucune logique dupliquée.
2. Réponses sortantes : accusé de réception, puis notification de match. Pour un
   utilisateur dont lang_pref est dyu ou bci, la notification part en AUDIO.
3. Réputation vocale : témoignage de 20 s par l'employeur en fin de mission, avec
   consentement enregistré (table consents). Sur le profil : lecteur audio au premier
   plan, transcription en second, « 3 témoignages · 2 employeurs vérifiés » plutôt
   qu'une note sur 5.
```

**Critère d'arrêt** : un vocal envoyé depuis un vrai téléphone sur le numéro de test crée
une annonce, et un profil affiche un témoignage écoutable.

---

## Prompt 7 — Consentement et droit à l'oubli

```
1. Avant le premier enregistrement d'un nouvel utilisateur : message vocal d'explication
   dans sa langue, réponse vocale « oui » enregistrée dans consents. Sans consentement,
   aucun audio n'est conservé.
2. Commande vocale de retrait (« efface ma voix ») : suppression des audios, anonymisation
   des transcriptions, users.deleted_at renseigné, confirmation vocale.
3. Suppression automatique de l'audio brut des annonces après transcription réussie.
```

**Critère d'arrêt** : le retrait supprime réellement les fichiers du stockage — vérifié en
listant le bucket, pas en lisant le code.

---

## Plus tard, dans cet ordre

Mobile Money réel (Wave d'abord : frais les plus bas) · OTP SMS réel · observabilité (erreurs,
latence par étape du pipeline) · interface agences et PME.

---

## Ouverture de chaque session

```
Relis CLAUDE.md. État : [git log --oneline -10]. Chantier du jour : [prompt N].
Avant de coder : lance pnpm test et dis-moi ce qui est cassé. On répare avant d'ajouter.
```

## Trois règles

1. **Un chantier à la fois**, et son critère d'arrêt vérifié à la main.
2. **Relire `CLAUDE.md` à chaque session** — la dérive d'architecture se construit une
   session à la fois.
3. **Toute proposition d'ajout se rattache au parcours de référence** ou à une ligne de
   l'audit. Sinon, c'est non — ou c'est une question pour `obara-produit`.
