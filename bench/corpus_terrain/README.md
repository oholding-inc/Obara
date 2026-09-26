# Corpus terrain

Le seul corpus qui mesure la réalité d'O'Bara, et le seul garanti **inédit pour tous les
modèles** — aucun n'a pu l'apprendre, puisque c'est l'équipe qui l'enregistre.

Les corpus publics sont lus, au calme, souvent bibliques. Une aide-ménagère qui envoie un
vocal WhatsApp depuis un marché d'Abobo, c'est autre chose. Tant que ce corpus n'existe pas,
**aucun score du banc ne dit ce que vivra un vrai utilisateur**.

## ⚠ Ce dossier ne contient jamais de voix dans Git

Le dépôt GitHub est **public**. Les enregistrements sont des voix de personnes réelles,
souvent vulnérables. Le `.gitignore` exclut `audio/` et `manifeste.tsv`. Seuls ce README et
le modèle de manifeste sont versionnés.

Stockage : un **dataset Kaggle privé** (`obara-corpus-terrain`, visibilité *Private*) ou un
dossier Drive privé. Jamais de dataset public, jamais de lien partagé ouvert.

## Ce qu'on enregistre

Des annonces d'emploi courtes, **15 à 30 secondes**, telles qu'un utilisateur les dirait :

- des **offres** (« je cherche du travail comme… ») et des **demandes** (« je cherche un… »)
- en **dioula**, **baoulé**, **français ivoirien**, et surtout **mélangés** — c'est la parole réelle
- avec ce qui rend la tâche difficile : hésitations, auto-corrections, quartiers au lieu de
  communes, prix en toutes lettres

**Enregistrées par WhatsApp**, sur de vrais téléphones d'entrée de gamme. WhatsApp compresse
en Opus : c'est exactement ce que recevra le serveur en production. Un enregistrement studio
mesurerait autre chose.

**Dans de vrais lieux** : rue, marché, maison, gbaka. Noter le lieu.

## Qui

Pas l'équipe — ou très peu. Viser la diversité réelle : femmes et hommes, jeunes et moins
jeunes, plusieurs communes, plusieurs métiers. **Au moins 8 locuteurs différents par
langue**, et aucun qui dépasse 20 % des énoncés d'une langue. (Le corpus Zenodo a 70 % d'une
seule voix ; c'est précisément ce qu'on évite.)

## Le consentement est dit, pas coché

Une case à cocher n'a aucun sens pour qui ne lit pas. Avant chaque enregistrement, dire
**dans la langue de la personne** l'équivalent de :

> « Je fais partie de l'équipe O'Bara. On construit une application pour aider les gens à
> trouver du travail en parlant, dans leur langue. Je te demande d'enregistrer un petit
> message comme si tu cherchais du travail, ou comme si tu cherchais quelqu'un. Ta voix
> servira seulement à vérifier que notre système comprend bien. On n'écrira pas ton nom.
> Tu peux refuser, et tu peux nous demander plus tard d'effacer ta voix. Tu es d'accord ? »

Enregistrer la réponse « oui » comme **fichier séparé** (`consentement/`). Sans ce fichier,
l'énoncé n'entre pas dans le corpus. Un crédit de communication pour le temps donné est une
pratique correcte et recommandée.

**Ne jamais demander** de nom complet, de numéro de téléphone ou d'adresse précise dans
l'annonce. Si la personne en donne spontanément, les retirer de la transcription et couper
l'audio.

## Transcription

Par un **locuteur natif**, mot pour mot, y compris les hésitations utiles et les mots
français. Noter l'orthographe utilisée (le baoulé s'écrit de plusieurs façons ; le corpus
Common Voice et le corpus Zenodo n'utilisent pas exactement la même). Puis :

1. la **traduction française** ;
2. le **JSON attendu** de la structuration (même schéma que `bench/golden_structuration.jsonl`).

Ce corpus sert donc **deux bancs à la fois** : l'ASR (audio → texte) et la structuration
(texte → JSON). C'est lui qui deviendra le **vrai jeu de test** de la structuration — celui
qu'on ne regarde jamais pour régler le prompt.

## Manifeste

`manifeste.tsv`, une ligne par énoncé, séparateur tabulation — voir `manifeste.modele.tsv`.

| Colonne | Contenu |
|---|---|
| `fichier` | `dyu_L03_007.opus` — langue, locuteur pseudonyme, numéro |
| `langue` | `dyu`, `bci`, `fr` ou `mixte` |
| `locuteur` | identifiant pseudonyme stable (`L03`), **jamais un nom** |
| `genre`, `tranche_age` | `F`/`M`, `18-25`/`26-40`/`41-60`/`60+` |
| `commune`, `lieu` | commune d'Abidjan, `rue`/`marche`/`maison`/`transport` |
| `texte` | transcription native, verbatim |
| `traduction_fr` | traduction française |
| `attendu` | JSON de structuration attendu, sur une ligne |
| `consentement` | nom du fichier audio de consentement |

## Taille visée

- **Palier 1 — 100 énoncés** : environ 50 dioula, 30 baoulé, 20 français ivoirien. Suffisant
  pour un CER à ± 3-4 points par langue. C'est le seuil à partir duquel le banc dit quelque
  chose de vrai.
- **Palier 2 — 300 énoncés** : assez pour commencer à affiner un modèle, en gardant un tiers
  intouché pour l'évaluation.
