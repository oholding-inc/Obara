# O'Bara

*Baara* — « le travail », en dioula.

O'Bara met en relation **par la voix**, en français, dioula et baoulé, les travailleurs du
secteur informel ivoirien — aides-ménagères, maçons, couturières, mécaniciens, nounous — et
ceux qui cherchent leurs services. Au-delà de la mise en relation, O'Bara construit ce qui
manque à ces travailleurs : **la preuve de leur travail**, sous forme d'historique de
missions et de témoignages vocaux.

## Pour les contributeurs

| Document | Contenu |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Constitution du projet : pile, règles, invariants |
| [`docs/BRIEF-CLAUDE-CODE.md`](docs/BRIEF-CLAUDE-CODE.md) | Chantiers en cours, prompts pour Claude Code |
| [`docs/BANC-ESSAI.md`](docs/BANC-ESSAI.md) | Évaluation des modèles vocaux et de langage, résultats |
| [`docs/COLAB-VS-KAGGLE.md`](docs/COLAB-VS-KAGGLE.md) | Où faire tourner quoi |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Journal des décisions |

```bash
cp .env.example .env.local     # USE_MOCKS=true suffit pour démarrer
pnpm install && pnpm dev
python bench/score_structuration.py --modele baseline-motscles
```

## Données et voix

Aucune voix réelle n'est versionnée dans ce dépôt public. Le corpus terrain vit dans un
espace privé, et chaque enregistrement est précédé d'un consentement dit et enregistré.

Corpus publics utilisés pour l'évaluation : Koumankan4Dyula (UVCI, data354), Baule Speech
Dataset (data354), Common Voice baoulé. Merci à leurs auteurs.
