#!/usr/bin/env python3
"""
Banc d'essai O'Bara — étage STRUCTURATION (transcript -> JSON).

Usage :
  python bench/score_structuration.py --modele baseline-motscles
  python bench/score_structuration.py --modele gemini:gemini-2.5-flash        # GEMINI_API_KEY
  python bench/score_structuration.py --modele groq:llama-3.3-70b-versatile   # GROQ_API_KEY
  python bench/score_structuration.py --modele anthropic:claude-haiku-4-5     # ANTHROPIC_API_KEY
  python bench/score_structuration.py --modele "openai-compat:https://hote/v1|nom-modele"  # OPENAI_COMPAT_API_KEY

Options : --inclure-non-valides  (compte les cas dioula non relus dans le score principal)
          --limite N             (N premiers cas, pour un essai rapide)

Aucune dépendance hors bibliothèque standard. Les résultats s'écrivent dans
bench/resultats/ et ne sont JAMAIS écrasés.
"""
import argparse, datetime, json, os, re, statistics, sys, time, unicodedata, urllib.request, urllib.error
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
DOM = RACINE / "domaine"
METIERS = json.loads((DOM / "metiers.json").read_text(encoding="utf-8"))["metiers"]
ZONES = json.loads((DOM / "zones.json").read_text(encoding="utf-8"))
CHAMPS = json.loads((DOM / "champs.json").read_text(encoding="utf-8"))
CODES = [m["code"] for m in METIERS]
COMMUNES = ZONES["communes"]

def sans_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").lower().strip()

_INDEX_ZONES = {sans_accents(c): c for c in COMMUNES}
_INDEX_ZONES.update({sans_accents(q): c for q, c in ZONES["quartiers"].items()})

def normaliser_zones(valeurs):
    """Même normalisation que doit appliquer la production après le LLM."""
    out, inconnues = [], []
    for v in valeurs or []:
        k = sans_accents(v)
        c = _INDEX_ZONES.get(k) or next((c for kk, c in _INDEX_ZONES.items() if kk and kk in k), None)
        (out.append(c) if c else inconnues.append(v))
    return sorted(set(out)), inconnues

# ------------------------------------------------------------------ prompt partagé
def construire_prompt(transcript):
    tpl = (DOM / "prompt_structuration.md").read_text(encoding="utf-8")
    indices = "; ".join(f'{m["code"]} ({", ".join(m["synonymes"][:4])})' for m in METIERS if m["synonymes"])
    quartiers = ", ".join(f"{q} → {c}" for q, c in list(ZONES["quartiers"].items())[:24])
    return (tpl.replace("{{CODES_METIERS}}", ", ".join(CODES))
               .replace("{{INDICES_METIERS}}", indices)
               .replace("{{COMMUNES}}", ", ".join(COMMUNES))
               .replace("{{QUARTIERS}}", quartiers)
               .replace("{{DISPOS}}", ", ".join(CHAMPS["disponibilite"]))
               .replace("{{UNITES}}", ", ".join(CHAMPS["tarif_unite"]))
               .replace("{{TRANSCRIPT}}", transcript))

# ------------------------------------------------------------------ moteurs
def _post(url, corps, entetes):
    req = urllib.request.Request(url, data=json.dumps(corps).encode(), headers={"Content-Type": "application/json", **entetes})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

def _cle(nom):
    v = os.environ.get(nom)
    if not v: sys.exit(f"Variable d'environnement {nom} manquante.")
    return v

def moteur_gemini(modele):
    cle = _cle("GEMINI_API_KEY")
    def f(t):
        r = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{modele}:generateContent?key={cle}",
                  {"contents": [{"parts": [{"text": construire_prompt(t)}]}],
                   "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}, {})
        return r["candidates"][0]["content"]["parts"][0]["text"]
    return f

def _moteur_openai(base, modele, cle):
    def f(t):
        r = _post(f"{base.rstrip('/')}/chat/completions",
                  {"model": modele, "temperature": 0, "response_format": {"type": "json_object"},
                   "messages": [{"role": "user", "content": construire_prompt(t)}]},
                  {"Authorization": f"Bearer {cle}"})
        return r["choices"][0]["message"]["content"]
    return f

def moteur_anthropic(modele):
    cle = _cle("ANTHROPIC_API_KEY")
    def f(t):
        r = _post("https://api.anthropic.com/v1/messages",
                  {"model": modele, "max_tokens": 400, "temperature": 0,
                   "messages": [{"role": "user", "content": construire_prompt(t)}]},
                  {"x-api-key": cle, "anthropic-version": "2023-06-01"})
        return r["content"][0]["text"]
    return f

def moteur_baseline(_=None):
    """Plancher à mots-clés. Tout LLM doit le battre nettement, sinon quelque chose cloche."""
    syn = sorted(((sans_accents(s), m["code"]) for m in METIERS for s in [m["libelle"].split(" /")[0], *m["synonymes"]]),
                 key=lambda x: -len(x[0]))
    def f(t):
        s = sans_accents(t)
        if re.search(r"(comment ca marche|n'est pas venue?|pas venu|je voulais savoir)", s):
            kind = "hors_annonce"
        elif re.search(r"(je cherche (un|une|des|quelqu)|on cherche|nous cherchons|besoin d'un|il me faut|qui peut|cherche un apprenti|n be \w+ nini)", s) \
                and not re.search(r"(cherche (du )?travail|cherche (un )?emploi|baara nini)", s):
            kind = "demande"
        else:
            kind = "offre"
        metier = next((c for k, c in syn if k and re.search(r"\b" + re.escape(k) + r"\b", s)), "autre")
        zones = sorted({c for k, c in _INDEX_ZONES.items() if k and re.search(r"\b" + re.escape(k) + r"\b", s)})
        dispo = next((d for d, pats in [("nuit", ["nuit", "su fe"]), ("week-end", ["week-end", "weekend"]),
                                          ("temps-plein", ["temps plein"]), ("journee", ["toute la journee"]),
                                          ("matin", ["matin", "sogoma"]), ("apres-midi", ["apres-midi"]), ("soir", ["soir"])]
                      if any(p in s for p in pats)), None)
        nombres = {"mille": 1000, "deux mille": 2000, "trois mille": 3000, "cinq mille": 5000, "dix mille": 10000,
                   "quarante mille": 40000, "cinquante mille": 50000, "soixante mille": 60000}
        tarif = next((v for k, v in sorted(nombres.items(), key=lambda x: -len(x[0])) if k in s), None)
        m = re.search(r"(\d[\d\s.]*)\s*(f|fcfa|francs|mille)", s)
        if m and tarif is None:
            tarif = int(re.sub(r"\D", "", m.group(1))) * (1000 if m.group(2) == "mille" else 1)
        unite = next((u for u, p in [("jour", "par jour"), ("mois", "par mois"), ("heure", "par heure"), ("semaine", "par semaine")] if p in s), None) if tarif else None
        return json.dumps({"kind": kind, "metier": metier, "zones": zones, "disponibilite": dispo,
                           "tarif_indicatif_fcfa": tarif, "tarif_unite": unite})
    return f

def obtenir_moteur(spec):
    if spec == "baseline-motscles": return moteur_baseline()
    fam, _, reste = spec.partition(":")
    if fam == "gemini": return moteur_gemini(reste)
    if fam == "groq": return _moteur_openai("https://api.groq.com/openai/v1", reste, _cle("GROQ_API_KEY"))
    if fam == "anthropic": return moteur_anthropic(reste)
    if fam == "openai-compat":
        base, _, mod = reste.partition("|"); return _moteur_openai(base, mod, _cle("OPENAI_COMPAT_API_KEY"))
    sys.exit(f"Modèle inconnu : {spec}")

# ------------------------------------------------------------------ validation (équivalent Zod)
def valider(brut):
    """Renvoie (objet, erreurs). Même contrat que le schéma Zod de l'application."""
    try:
        txt = re.sub(r"^```(json)?|```$", "", brut.strip(), flags=re.M).strip()
        o = json.loads(txt)
    except Exception as ex:
        return None, [f"JSON illisible : {ex}"]
    err = []
    if o.get("kind") not in CHAMPS["kind"]: err.append(f"kind hors liste : {o.get('kind')!r}")
    if o.get("metier") not in CODES: err.append(f"metier hors énumération : {o.get('metier')!r}")
    if not isinstance(o.get("zones", []), list): err.append("zones n'est pas une liste")
    d = o.get("disponibilite")
    if d is not None and d not in CHAMPS["disponibilite"]: err.append(f"disponibilite hors liste : {d!r}")
    u = o.get("tarif_unite")
    if u is not None and u not in CHAMPS["tarif_unite"]: err.append(f"tarif_unite hors liste : {u!r}")
    t = o.get("tarif_indicatif_fcfa")
    if t is not None and not isinstance(t, (int, float)): err.append("tarif non numérique")
    return o, err

# ------------------------------------------------------------------ notation
def f1(pred, att):
    p, a = set(pred), set(att)
    if not p and not a: return 1.0
    if not p or not a: return 0.0
    vp = len(p & a); prec, rap = vp / len(p), vp / len(a)
    return 0.0 if vp == 0 else 2 * prec * rap / (prec + rap)

def noter(cas, sortie, erreurs):
    a = cas["attendu"]
    ok_metier = cas.get("metier_acceptes", [a["metier"]])
    ok_kind = cas.get("kind_acceptes", [a["kind"]])
    if sortie is None:
        return {"json_valide": 0, "kind": 0, "metier": 0, "metier_invente": 0, "autre_abusif": 0,
                "zones_f1": 0.0, "dispo": 0, "tarif": 0, "zones_inconnues": []}
    zones, inconnues = normaliser_zones(sortie.get("zones"))
    m = sortie.get("metier")
    ta, tp = a["tarif_indicatif_fcfa"], sortie.get("tarif_indicatif_fcfa")
    tarif_ok = (ta is None and tp is None) or (ta is not None and isinstance(tp, (int, float)) and abs(tp - ta) <= 0.1 * ta
                                                and sortie.get("tarif_unite") == a["tarif_unite"])
    return {"json_valide": int(not erreurs), "kind": int(sortie.get("kind") in ok_kind),
            "metier": int(m in ok_metier), "metier_invente": int(m not in CODES),
            "autre_abusif": int(m == "autre" and "autre" not in ok_metier),
            "zones_f1": f1(zones, a["zones"]), "dispo": int(sortie.get("disponibilite") in cas.get("dispo_acceptes", [a["disponibilite"]])),
            "tarif": int(tarif_ok), "zones_inconnues": inconnues}

def agreger(lignes):
    if not lignes: return {}
    moy = lambda k: sum(l["notes"][k] for l in lignes) / len(lignes)
    return {"n": len(lignes), "json_valide": moy("json_valide"), "kind_exact": moy("kind"),
            "metier_exact": moy("metier"), "metier_invente": moy("metier_invente"),
            "metier_autre_abusif": moy("autre_abusif"), "zones_f1": moy("zones_f1"),
            "dispo_exact": moy("dispo"), "tarif_exact": moy("tarif"),
            "latence_ms_mediane": int(statistics.median(l["latence_ms"] for l in lignes))}

SEUILS = {"metier_exact": 0.90, "zones_f1": 0.85, "metier_invente": 0.0, "json_valide": 0.95, "kind_exact": 0.90}

def verdict(s):
    if not s: return "—"
    rates = [k for k, v in SEUILS.items() if (s[k] > v if k == "metier_invente" else s[k] < v)]
    return "RETENU" if not rates else "sous le seuil : " + ", ".join(rates)

# ------------------------------------------------------------------ programme
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modele", required=True)
    ap.add_argument("--golden", default=str(RACINE / "bench" / "golden_structuration.jsonl"))
    ap.add_argument("--inclure-non-valides", action="store_true")
    ap.add_argument("--limite", type=int)
    args = ap.parse_args()

    cas = [json.loads(l) for l in Path(args.golden).read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.limite: cas = cas[: args.limite]
    moteur = obtenir_moteur(args.modele)

    lignes = []
    for c in cas:
        t0 = time.time()
        try:
            brut = moteur(c["transcript"])
        except urllib.error.HTTPError as ex:
            brut = f"ERREUR HTTP {ex.code} : {ex.read().decode()[:200]}"
        except Exception as ex:
            brut = f"ERREUR : {ex}"
        ms = int((time.time() - t0) * 1000)
        sortie, erreurs = valider(brut)
        n = noter(c, sortie, erreurs)
        lignes.append({"id": c["id"], "langue": c["langue"], "difficulte": c["difficulte"], "valide": c["valide"],
                       "attendu": c["attendu"], "sortie": sortie, "brut": brut if erreurs else None,
                       "erreurs": erreurs, "notes": n, "latence_ms": ms})
        marque = "✓" if (n["metier"] and n["kind"] and n["zones_f1"] == 1.0) else "✗"
        print(f"  {marque} {c['id']} [{c['langue']:5s}] metier={sortie.get('metier') if sortie else '—':22s} "
              f"zones={sortie.get('zones') if sortie else '—'}", file=sys.stderr)

    for l, c in zip(lignes, cas): l["jeu"] = c.get("jeu", "dev")
    garder = lambda l: l["valide"] or args.inclure_non_valides
    principal = [l for l in lignes if garder(l) and l["jeu"] == "test"] or [l for l in lignes if garder(l)]
    s_dev = agreger([l for l in lignes if garder(l) and l["jeu"] == "dev"])
    par_langue = {lg: agreger([l for l in lignes if l["langue"] == lg]) for lg in sorted({l["langue"] for l in lignes})}
    par_diff = {d: agreger([l for l in principal if l["difficulte"] == d]) for d in ("facile", "moyen", "difficile")}
    s = agreger(principal)

    rapport = {"etage": "structuration", "modele": args.modele,
               "date": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
               "golden": Path(args.golden).name, "n_cas": len(cas),
               "score_principal": s, "jeu_principal": "test" if any(l["jeu"] == "test" for l in lignes) else "dev",
               "score_dev": s_dev, "verdict": verdict(s),
               "par_langue": par_langue, "par_difficulte": par_diff,
               "echecs": [{k: l[k] for k in ("id", "langue", "attendu", "sortie", "erreurs")}
                          for l in lignes if not (l["notes"]["metier"] and l["notes"]["kind"] and l["notes"]["zones_f1"] == 1.0)],
               "cas": lignes}

    dossier = RACINE / "bench" / "resultats"; dossier.mkdir(parents=True, exist_ok=True)
    base = f"{datetime.date.today().isoformat()}_structuration_{re.sub(r'[^A-Za-z0-9.-]+', '-', args.modele)}"
    chemin, i = dossier / f"{base}.json", 2
    while chemin.exists(): chemin, i = dossier / f"{base}_{i}.json", i + 1
    chemin.write_text(json.dumps(rapport, ensure_ascii=False, indent=1), encoding="utf-8")

    pct = lambda v: f"{v:6.1%}"
    print(f"\n  Modèle        {args.modele}")
    print(f"  Jeu principal TEST — {s['n']} cas conçus pour casser les mots-clés (dioula non relu {'inclus' if args.inclure_non_valides else 'exclu'})")
    print(f"  Pour mémoire, jeu DEV : metier {s_dev['metier_exact']:.0%} · zones F1 {s_dev['zones_f1']:.2f} — ne jamais régler le prompt sur le jeu TEST\n")
    for k, lib in [("json_valide", "JSON valide du 1er coup"), ("kind_exact", "Type d'annonce"), ("metier_exact", "Métier exact"),
                   ("metier_invente", "Métier inventé (doit = 0)"), ("metier_autre_abusif", "« autre » abusif"),
                   ("zones_f1", "Zones (F1)"), ("dispo_exact", "Disponibilité"), ("tarif_exact", "Tarif + unité")]:
        seuil = SEUILS.get(k)
        print(f"  {lib:28s} {pct(s[k])}" + (f"   (seuil {'≤' if k == 'metier_invente' else '≥'} {seuil:.0%})" if seuil is not None else ""))
    print(f"  {'Latence médiane':28s} {s['latence_ms_mediane']:>5d} ms")
    print("\n  Par difficulté : " + " · ".join(f"{d} metier {v['metier_exact']:.0%}" for d, v in par_diff.items() if v))
    if "dyu" in par_langue:
        print(f"  Dioula (non relu, indicatif) : metier {par_langue['dyu']['metier_exact']:.0%}, zones F1 {par_langue['dyu']['zones_f1']:.2f}")
    print(f"\n  VERDICT : {rapport['verdict']}")
    print(f"  {len(rapport['echecs'])} cas en échec détaillés dans {chemin.relative_to(RACINE)}")

if __name__ == "__main__":
    main()
