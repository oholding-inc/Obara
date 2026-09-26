# Colab ou Kaggle pour O'Bara

**Verdict : Kaggle pour mesurer, Colab pour explorer, ni l'un ni l'autre pour servir.**

La question n'est pas « quelle plateforme est la meilleure » mais « quelle plateforme pour
quel travail ». O'Bara a cinq besoins de calcul distincts, et ils ne tombent pas du même côté.

## Ce qui départage vraiment

| | Kaggle (gratuit) | Colab (gratuit) |
|---|---|---|
| Quota GPU | **~30 h/semaine, publié, remis à zéro chaque semaine** | Non publié, variable selon la demande |
| Disponibilité du GPU | Garantie dans le quota | **Non garantie** |
| Durée max d'une session | 12 h | 12 h en théorie, souvent moins |
| Coupure pour inactivité | ~20 min en mode interactif | ~90 min |
| **Exécution navigateur fermé** | **Oui, gratuit** (« Save & Run All ») | **Non** — réservé à Colab Pro+ |
| Sorties versionnées | Oui : chaque version garde ses fichiers de sortie | Non : la machine est effacée |
| GPU proposés | T4, T4 ×2, P100 | T4 quand disponible |
| RAM | ordre de 29-30 Go* | ordre de 12-13 Go* |
| Visibilité par défaut | **Publique** — à passer en privé | Privée |
| Persistance des données | Datasets Kaggle (versionnés, privés possibles) | Google Drive |
| Montée en gamme payante | Aucune | A100, L4, TPU via unités de calcul |

\* *Ordres de grandeur couramment rapportés, non confirmés par une source primaire pendant
cette analyse. La cellule « Matériel » du notebook affiche les valeurs réelles de ta session :
fie-toi à elle.*

## Le fait mesuré qui tranche

Tailles des checkpoints Omnilingual, **mesurées sur les cartes officielles** du paquet :

| Modèle | Checkpoint | RAM pour charger | VRAM en float16 | Colab gratuit | Kaggle |
|---|---|---|---|---|---|
| CTC 300M v2 | 1,30 Go | ~1,5 Go | ~0,7 Go | ✓ | ✓ |
| LLM 300M v2 | 6,53 Go | ~7,5 Go | ~3,3 Go | ✓ | ✓ |
| LLM 1B v2 | 9,12 Go | ~10,5 Go | ~4,6 Go | limite | ✓ |
| **LLM 3B v2** | **17,52 Go** | **~20 Go** | ~8,8 Go | **✗ RAM** | ✓ |
| LLM 7B v2 | 31,22 Go | ~36 Go | ~15,6 Go | ✗ | ✗ |

Et ce n'est pas théorique : sur une machine de test à **7 Go de RAM**, le LLM 300M v2 a été
**tué par le système au chargement**. Le 3B, qui est le plus gros modèle qu'on a une chance
d'utiliser en production, **ne se charge pas dans la RAM d'un Colab gratuit**. Sur Kaggle, oui.

Le 7B ne tient nulle part gratuitement : ni en RAM, ni sur une seule T4 (15 Go utiles pour
15,6 Go nécessaires). Il faudrait une L4 ou une A100 — c'est-à-dire payer.

## Les cinq besoins d'O'Bara

### 1. Le banc d'essai ASR → **Kaggle**

Un passage complet (plusieurs modèles × plusieurs corpus × 60 énoncés) prend de 30 minutes
à 2 heures. Sur Colab gratuit, il faut rester devant l'écran et prier que le GPU ne soit pas
repris. Sur Kaggle, on lance « Save & Run All », on ferme l'ordinateur, et le fichier de
résultats attend dans les sorties de la version. C'est la différence entre une mesure
reproductible et un après-midi perdu.

Et c'est là seulement que tient le LLM 3B.

### 2. L'exploration et le débogage → **Colab**

Écouter un énoncé qui échoue, comparer deux transcriptions à l'oreille, tester une idée en
dix minutes : Colab est plus agréable. Privé par défaut, Drive sous la main, assistant intégré.
Largement suffisant pour les modèles CTC et le LLM 300M.

### 3. L'affinage d'un modèle → **Kaggle**, avec des points de sauvegarde

Affiner Omnilingual ou Whisper sur Koumankan puis sur le corpus terrain demandera plusieurs
sessions de 12 h au plus. Le quota hebdomadaire prévisible permet de planifier. Règle
absolue : sauvegarder un point de reprise toutes les 30 minutes dans les sorties, car tout ce
qui reste sur le disque local disparaît à la fin de la session.

### 4. Les données sensibles → **nulle part en public**

Le corpus terrain contient des voix de personnes réelles. Sur Kaggle, **notebooks et
datasets sont publics par défaut** : créer le dataset en *Private* dès le départ, et le
vérifier. Sur Colab, Drive privé. Ne jamais passer par un lien de partage ouvert.

### 5. Servir le modèle à l'application → **ni l'un ni l'autre**

Les deux plateformes coupent les sessions, n'offrent aucune adresse stable et ne sont pas
faites pour héberger un service. Brancher l'application O'Bara sur un tunnel vers un notebook,
c'est garantir une panne devant le premier vrai utilisateur.

Les options réelles, à chiffrer par `obara-finance` et `obara-cto` :

- **GPU serverless facturé à la seconde, avec mise en veille** (Modal, Replicate, RunPod
  Serverless…) — adapté à un trafic faible et irrégulier : on ne paie que les transcriptions.
- **Point de terminaison Hugging Face** — simple, mais facturé à l'heure tant qu'il tourne.
- **VPS GPU** — rentable seulement avec un trafic soutenu.

Pour un MVP à faible trafic, le serverless avec mise en veille est presque toujours le moins
cher. C'est la **prochaine décision d'infrastructure** du projet.

## Pièges à connaître

- **Deux T4 comptent double.** Une heure sur « T4 ×2 » consomme deux heures de quota Kaggle.
  Ne l'activer que pour ce qui en a besoin.
- **La T4 ne gère pas nativement le bfloat16** (architecture Turing). Le pipeline Omnilingual
  charge en bfloat16 par défaut ; le notebook passe automatiquement en float16 sur T4.
- **Omnilingual remplace PyTorch** à l'installation. Ne jamais charger un modèle
  `transformers` dans la même session : le notebook fait deux passes séparées.
- **`omnilingual-asr` installe un torchaudio incompatible** (compilé pour CUDA 13, alors qu'il
  épingle torch 2.8). Symptôme : `libcudart.so.13 introuvable`. Correctif appliqué dans le
  notebook : épingler `torchaudio==2.8.0`.
- **Sur Windows, rien de tout cela ne s'installe** (`fairseq2n` n'a pas de roue Windows).
  C'est une raison de plus pour ne jamais faire tourner les modèles vocaux en local.

## Sources

- [FAQ Google Colab](https://research.google.com/colaboratory/faq.html) — sessions, inactivité, exécution en arrière-plan réservée aux offres payantes
- [Kaggle — Efficient GPU Usage](https://www.kaggle.com/docs/efficient-gpu-usage)
- [Colab vs Kaggle 2026 — Clusy](https://www.clusy.io/compare/colab-vs-kaggle) — quota ~30 h/semaine, sessions de 12 h
- [Limites Kaggle T4 — Lumino AI](https://www.luminoai.in/blog/kaggle-gave-you-12-hours-your-training-job-needed-more) — 2×T4 compte double, coupure à 20 min
- [Kaggle vs Colab 2026 — L. K. Swain](https://lalatenduswain.medium.com/kaggle-vs-google-colab-which-cloud-notebook-platform-should-you-choose-in-2026-da053a02fcb7)
- Tailles de checkpoints : cartes `rc_models_v2.yaml` du paquet `omnilingual-asr` 0.2.0, en-têtes HTTP mesurés le 26/09/2026
