# Corpus vocal dioula / baoulé

## Rôle

Ce dossier reçoit **30 à 50 vocaux réels** en dioula (`dyu`) et en baoulé (`bci`),
chacun de **moins de 40 secondes**, au format **Opus dans un conteneur OGG** — c'est
exactement ce que WhatsApp produit quand on envoie un message vocal.

Il sert à **mesurer le CER** (taux d'erreur caractère) de l'Omnilingual ASR
(`facebook/omniASR-LLM-300M`) sur nos langues cibles, via `pnpm asr:eval`. Le CER mesuré
est **affiché tel quel dans l'interface d'admin** (CLAUDE.md §5) : si le score est
mauvais, on ne cache rien — on montre le corpus, le score réel et le plan
d'amélioration.

Les vocaux du corpus servent aussi de **témoignages audio réels** pour le seed de
démonstration (CLAUDE.md §9).

## Convention de nommage

```
<langue>_<locuteur>_<numero>.ogg
```

- `langue` : `dyu` (dioula) ou `bci` (baoulé), codes ISO 639-3 utilisés dans tout le projet
- `locuteur` : prénom ou pseudonyme en minuscules, sans accent ni espace
- `numero` : trois chiffres, en commençant à `001` par locuteur

Exemples : `dyu_awa_001.ogg`, `dyu_awa_002.ogg`, `bci_kouassi_003.ogg`.

## Manifeste — `manifest.csv`

Une ligne par vocal, séparateur virgule, encodage UTF-8. Colonnes :

| Colonne                   | Contenu                                                              |
|---------------------------|----------------------------------------------------------------------|
| `fichier`                 | Nom du fichier, ex. `dyu_awa_001.ogg`                                |
| `langue`                  | `dyu` ou `bci`                                                       |
| `locuteur`                | Identifiant du locuteur, identique à celui du nom de fichier         |
| `metier_attendu`          | Code métier de `lib/domain/metiers.ts` (ex. `aide-menagere`, `macon`) |
| `zone_attendue`           | Code de zone de `lib/domain/zones.ts` (ex. `yopougon`)               |
| `transcription_reference` | Transcription humaine dans la langue d'origine (référence pour le CER) |
| `traduction_fr`           | Traduction française de la transcription                             |
| `consentement`            | `oui` obligatoire (consentement oral vérifié en début de vocal) ; `pnpm asr:eval` et le seed ignorent toute ligne dont la valeur n'est pas exactement `oui` |

Toute valeur contenant une virgule ou un retour à la ligne doit être entourée de
guillemets doubles (règle CSV standard).

## Consentement

Chaque vocal commence par un **consentement oral enregistré**, dans la langue du
locuteur, équivalent à :

> « J'accepte que ce vocal serve à la démo O'Bara. »

Sans cette phrase en début d'enregistrement, le fichier n'entre pas dans le corpus : il
n'a pas de ligne dans `manifest.csv` et n'est pas conservé dans ce dossier.

## Ce qui est versionné

- **Versionnés** : `README.md` (ce fichier) et `manifest.csv`.
- **Jamais versionnés** : les fichiers audio (`.gitignore` exclut tout le reste du
  dossier). Ils sont trop lourds et contiennent des voix réelles.

## Déposer des fichiers

1. Enregistrer le vocal sur WhatsApp (ou l'exporter depuis une conversation).
2. Le renommer selon la convention ci-dessus et le copier dans ce dossier `corpus/`.
3. Vérifier qu'il dure moins de 40 s et qu'il commence par le consentement.
4. Ajouter sa ligne dans `manifest.csv` (transcription et traduction faites par un
   locuteur natif).
5. Partager les fichiers audio avec l'équipe hors Git (dossier partagé), jamais par
   commit.
