# Banc d'essai O'Bara

Trois étages, trois bancs. Un ASR parfait suivi d'un LLM qui invente des métiers produit un
matching faux : chaque étage se mesure séparément.

| Étage | Outil | Où ça tourne | Seuil de production |
|---|---|---|---|
| **ASR** — audio → texte | `bench/obara_bench_asr.ipynb` | Kaggle, GPU T4 | CER < 25 % sur **chaque** corpus |
| **Structuration** — texte → JSON | `bench/score_structuration.py` | partout, sans GPU | métier ≥ 90 %, zones F1 ≥ 0,85, métier inventé = 0 % |
| **Synthèse vocale** — texte → voix | écoute par un locuteur natif | — | ≥ 4/5 sur 10 phrases |

Protocole détaillé et règles de lecture : compétence `obara-banc-essai` du plugin O'Bara.

## Les trois règles qui évitent de se mentir

1. **Un score publié n'est pas une mesure.** On remesure tout, sur nos corpus, avec notre
   normalisation.
2. **Deux corpus d'origines différentes, minimum.** Un écart de plus de 30 points de CER entre
   les deux signale que le modèle a vu l'un d'eux à l'entraînement.
3. **Le seul corpus garanti inédit est celui qu'on enregistre nous-mêmes** —
   `bench/corpus_terrain/`. Tant qu'il n'existe pas, aucun chiffre ne dit ce que vivra un vrai
   utilisateur.

## État au 26 septembre 2026

### Structuration

| Modèle | Jeu DEV | Jeu TEST | Verdict |
|---|---|---|---|
| `baseline-motscles` (plancher) | métier 93 %, zones 1,00 | **métier 33 %**, zones 0,87 | sous le seuil |
| Gemini, Llama (Groq), Claude | à mesurer | à mesurer | — |

L'écart entre les deux jeux est le résultat le plus instructif : le jeu DEV a été écrit en même
temps que la liste de synonymes, donc le plancher à mots-clés a « vu les réponses ». Le jeu
TEST, conçu pour casser les mots-clés (négations, auto-corrections, erreurs de reconnaissance,
aucun mot-métier), le fait tomber à 33 %. **On ne règle jamais le prompt en regardant le jeu
TEST.** Et le vrai jeu de test viendra du corpus terrain.

### ASR — préliminaire (CPU, 24 énoncés par corpus)

| Modèle | Baoulé Common Voice | Baoulé Zenodo | Constat |
|---|---|---|---|
| `omniASR_CTC_300M_v2` | **23,7 %** | 36,2 % | Prometteur. Dérive vers d'autres écritures sans étiquette de langue (cyrillique, orthographe yoruba) |
| `Klayt/wav2vec2-large-xlsr-baoule-demo` | 100 % | 100 % | **Écarté.** Sort 1 à 3 caractères ; son vocabulaire ne contient ni ɛ, ni ɔ, ni ɲ |
| `abdouaziiz/baoule` | — | — | Accès restreint : accepter ses conditions sur Hugging Face |
| `Lingua-Africa/whisper-baoule-small` | — | — | **N'existe pas** : dépôt vide, aucun poids |
| `omniASR_LLM_*_v2` | — | — | Trop gros pour la machine de test : à mesurer sur Kaggle |

**Témoin positif** : un modèle anglais connu, passé par exactement le même code, obtient
2,2 % de CER. Le banc est sain ; un échec à 100 % est celui du modèle.

### Ce que les corpus baoulé ne disent pas

- **Zenodo** : les 4 locuteurs sont dans l'entraînement **et** dans le test ; 70 % des
  énoncés viennent d'une seule voix ; 39 % commencent par un numéro de verset biblique. Un
  modèle entraîné sur son split d'entraînement aura un score gonflé sur son split de test.
- **Common Voice** : 9 locuteurs dans le test, aucun partagé avec l'entraînement — c'est la
  référence baoulé. Mais Omnilingual a été entraîné en partie sur Common Voice : pour lui,
  ce corpus n'est peut-être pas tout à fait inédit.

Deux modèles, deux soupçons opposés. C'est exactement pour ça que le tableau croisé existe —
et que le corpus terrain est indispensable.

## Lancer

```bash
# Structuration — n'importe où
python bench/score_structuration.py --modele baseline-motscles
GEMINI_API_KEY=… python bench/score_structuration.py --modele gemini:gemini-2.5-flash
GROQ_API_KEY=…   python bench/score_structuration.py --modele groq:llama-3.3-70b-versatile

# ASR — sur Kaggle : importer bench/obara_bench_asr.ipynb, GPU T4, Internet activé,
# secret HF_TOKEN, puis Save & Run All, deux fois (FAMILLE = "transformers" puis "omnilingual").
# Déposer les JSON produits dans bench/resultats/, puis :
python bench/rapport_asr.py
```

## Prochaines mesures, par ordre de valeur

1. **Passe Kaggle complète** — LLM 300M, 1B et 3B v2 avec l'étiquette `bci_Latn` et
   `dyu_Latn`. Question clé : le conditionnement par la langue corrige-t-il la dérive
   d'écriture observée sur le CTC ?
2. **Structuration sur 3 LLM** — Gemini, Llama via Groq, Claude. Le moins cher qui passe le
   seuil sur le jeu TEST gagne.
3. **Structuration sur des sorties d'ASR réelles**, pas sur des transcriptions propres : les
   erreurs de l'ASR (mots collés, voyelles confondues) sont l'entrée réelle du LLM.
4. **Corpus terrain, palier 1** — 100 énoncés. Le premier chiffre qui compte vraiment.
