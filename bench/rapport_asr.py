#!/usr/bin/env python3
"""
Fusionne tous les résultats ASR de bench/resultats/*_asr_*.json et imprime le tableau
croisé : CER par corpus, écart, verdict. Bibliothèque standard uniquement.

  python bench/rapport_asr.py            # tous les fichiers
  python bench/rapport_asr.py --dernier  # seulement la mesure la plus récente par (modèle, corpus)
"""
import json, sys
from pathlib import Path

SEUIL_CER, SEUIL_FUITE = 0.25, 0.30
dossier = Path(__file__).resolve().parent / "resultats"
fichiers = sorted(dossier.glob("*_asr_*.json"))
if not fichiers: sys.exit("Aucun résultat ASR dans bench/resultats/.")

mesures = {}
for f in fichiers:
    d = json.loads(f.read_text(encoding="utf-8"))
    for r in d["resultats"]:
        cle = (r["modele"], r["corpus"])
        r["_source"], r["_gpu"], r["_prelim"] = f.name, d.get("gpu", "?"), d.get("preliminaire", False)
        if "--dernier" in sys.argv or cle not in mesures or mesures[cle]["_prelim"]:
            mesures[cle] = r
    for m, raison in d.get("non_evalues", {}).items():
        mesures.setdefault((m, "—"), {"modele": m, "corpus": "—", "raison": raison})

modeles = sorted({m for m, _ in mesures})
corpus = [c for c in ["BCI-CV", "BCI-Z", "DYU-K", "BAM-J", "TERRAIN"] if any(k[1] == c for k in mesures)]
pct = lambda x: f"{x:6.1%}" if x is not None else "     —"
print(f"\n{'modèle':40s}" + "".join(f"{c:>9s}" for c in corpus) + f"{'écart bci':>11s}   verdict")
print("─" * (40 + 9 * len(corpus) + 25))
for m in modeles:
    g = lambda c: mesures.get((m, c), {}).get("cer_median")
    if (m, "—") in mesures and all(g(c) is None for c in corpus):
        print(f"{m:40s}  NON ÉVALUÉ — {mesures[(m, '—')]['raison']}"); continue
    a, b = g("BCI-CV"), g("BCI-Z")
    ecart = abs(a - b) if a is not None and b is not None else None
    valeurs = [g(c) for c in corpus if g(c) is not None]
    prelim = any(mesures.get((m, c), {}).get("_prelim") for c in corpus)
    if ecart is not None and ecart > SEUIL_FUITE: v = "FUITE PRÉSUMÉE — retenir le pire score"
    elif valeurs and min(valeurs) >= 0.95: v = "ÉCARTÉ — ne transcrit pas"
    elif valeurs and max(valeurs) < SEUIL_CER: v = "RETENU"
    elif valeurs and min(valeurs) < SEUIL_CER: v = "PROMETTEUR — sous le seuil sur un seul corpus"
    else: v = "sous le seuil"
    print(f"{m:40s}" + "".join(f"{pct(g(c)):>9s}" for c in corpus) + f"{pct(ecart):>11s}   {v}" + ("  [préliminaire]" if prelim else ""))
print(f"\nSeuil de production : CER < {SEUIL_CER:.0%} sur CHAQUE corpus. Fuite présumée si écart > {SEUIL_FUITE:.0%}.")
print("Le seul corpus garanti inédit pour tous les modèles est TERRAIN, enregistré par l'équipe.")
print("Sources :", ", ".join(sorted({f.name for f in fichiers})))
