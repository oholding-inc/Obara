> **Rédigé au jalon 1 (CLAUDE.md v1, 13-14 septembre 2026).** Conservé à l'import pour ne pas
> perdre les commandes et les notes Windows/OneDrive. Certaines mentions sont périmées par
> CLAUDE.md v2 (Neon au lieu de Supabase, « jalon », variables d'environnement) : à réviser
> après l'audit (docs/AUDIT-2026-09.md).

# O'Bara

Plateforme d'emploi **vocale et multilingue** (français, dioula, baoulé) pour le secteur
informel ivoirien : un travailleur décrit son offre en parlant, le système la structure,
l'indexe et la met en relation avec un employeur.

**`CLAUDE.md` est la constitution du projet.** Il fait autorité sur ce README : scène de
démo (« Nord magnétique »), stack imposée, périmètre (« HORS scope »), direction
artistique et conventions. Le lire avant toute contribution.

## Prérequis

- Node.js 22.12+ ou 24 (exigé par Vitest 5 ; 22.15+ recommandé pour le mocking de modules ; testé avec Node 24)
- pnpm 10 : `npm install -g pnpm@10`
- Git

## Installation

```bash
pnpm install
```

## Configuration

Copier le fichier d'exemple puis l'adapter :

```powershell
# PowerShell
Copy-Item .env.example .env.local
```

```bash
# bash
cp .env.example .env.local
```

- `USE_MOCKS=true` (valeur par défaut du fichier d'exemple) : **tout tourne hors ligne,
  sans aucune clé**. C'est le mode de développement normal et le plan B de la démo.
- `DATABASE_URL` : nécessaire uniquement pour `db:push`, `db:studio`, `db:seed`.
  Créer un projet sur [neon.tech](https://neon.tech), copier la chaîne de connexion
  **« pooled »** dans `.env.local`, puis lancer `pnpm db:push` : la commande active
  l'extension `pgvector` automatiquement, puis pousse le schéma Drizzle.

Chaque variable est documentée dans `.env.example`.

## Commandes

| Commande            | Effet                                                                 |
|---------------------|-----------------------------------------------------------------------|
| `pnpm dev`          | Serveur de développement (Turbopack) sur http://localhost:3000        |
| `pnpm build`        | Build de production                                                   |
| `pnpm start`        | Sert le build de production                                           |
| `pnpm lint`         | ESLint (règles Next + `no-console` + `no-explicit-any`)               |
| `pnpm typecheck`    | `tsc --noEmit` — vérification TypeScript stricte                      |
| `pnpm test`         | Tests Vitest : scoring et référentiel des métiers (dont la recherche par synonyme qu'utilise le parser) — le parser de structuration lui-même n'a pas encore de test |
| `pnpm db:push`      | Active `pgvector` puis applique le schéma Drizzle sur `DATABASE_URL`  |
| `pnpm db:generate`  | Génère les fichiers de migration SQL depuis le schéma                 |
| `pnpm db:studio`    | Ouvre Drizzle Studio pour inspecter la base                           |
| `pnpm db:seed`      | Jeu de données de démo — **stub jusqu'au jour 9** (CLAUDE.md §9)      |

## Mode mocks

Avec `USE_MOCKS=true`, les cinq services externes sont remplacés par des implémentations
locales : **ASR**, **LLM** (structuration), **embeddings**, **WhatsApp** et **stockage**.

- Les mocks sont **déterministes** : même entrée → même sortie, à chaque exécution.
- Les fichiers audio « envoyés » sont écrits dans `public/mock-storage/` (gitignoré) et
  servis **uniquement sous `pnpm dev`** : pas sous `next start` (tout fichier écrit après
  le démarrage renvoie 404) ni sur Vercel (disque en lecture seule).
- Aucune connexion réseau n'est ouverte.

Pour basculer sur les services réels : renseigner les clés dans `.env.local` et passer
`USE_MOCKS=false`. **Au jalon 1, les implémentations réelles ne sont pas câblées** :
seule la sélection mock/réel (`utiliserMocks()` dans `lib/env.ts`) existe.

## Structure des dossiers

| Chemin              | Rôle                                                                        |
|---------------------|-----------------------------------------------------------------------------|
| `app/`              | App Router Next.js : layout, pages, futurs route handlers (`app/api/`)      |
| `components/`       | Composants React maison (pas de librairie de composants)                    |
| `lib/db/`           | Schéma Drizzle, client Postgres, activation de `pgvector`, seed             |
| `lib/services/`     | Fabriques ASR / LLM / embeddings / WhatsApp / stockage, avec leurs mocks    |
| `lib/domain/`       | Domaine pur : métiers, zones, schémas Zod, scoring, normalisation de texte  |
| `lib/env.ts`        | Variables d'environnement validées par Zod (`getEnv()`, `utiliserMocks()`)  |
| `lib/log.ts`        | Logger unique du projet (`log`, `creerLogger(scope)`)                       |
| `corpus/`           | Vocaux réels dioula/baoulé pour mesurer le CER de l'ASR (voir son README)   |

## Conventions

Détail dans `CLAUDE.md` §7. En résumé :

- **Français partout** : identifiants métier, commentaires, commits, messages.
- Pas de `any`.
- Pas de `console.*` : utiliser `lib/log.ts`.
- Toute sortie de LLM est validée par un **schéma Zod**, jamais de `JSON.parse` direct.
- Server Components par défaut ; `"use client"` uniquement pour l'audio et le temps réel.

## État du jalon 1

Le jalon 1 est **le socle uniquement** : configuration, environnement, logger, domaine
(métiers, zones, schémas, scoring), schéma de base, fabriques de services avec mocks,
et une page d'accueil provisoire qui affiche les compteurs du domaine.

Volontairement absent à ce jalon :

- upload et réception d'audio ;
- appels réels à l'ASR, au LLM ou aux embeddings ;
- interface produit (le bouton d'enregistrement, le tableau de bord) ;
- seed de démonstration (`db:seed` est un stub) ;
- intégration WhatsApp.

Ces éléments arrivent dans l'ordre de la scène de démo (« Nord magnétique »,
CLAUDE.md §2). Ce qui n'y figure pas est « HORS scope » (CLAUDE.md §3) et ne sera pas
commencé.

## Note Windows / OneDrive

- Un `node_modules` sous un dossier synchronisé par OneDrive est **lent et fragile**
  (verrous de fichiers, synchronisation de dizaines de milliers de fichiers). Exclure le
  dossier du projet de la synchronisation, ou cloner le dépôt hors de OneDrive.
- Le chemin du projet contient une apostrophe (`O'BARA`). Dans un terminal, **toujours
  le citer entre guillemets doubles** :

  ```powershell
  Set-Location "C:\Users\HP\OneDrive\Documents\O'BARA\obara"
  ```
