import { describe, expect, it } from "vitest";
import {
  POIDS_COSINUS,
  POIDS_DISPONIBILITE,
  POIDS_FILTRES,
  POIDS_METIER,
  POIDS_ZONE,
  calculerScore,
  scoreFiltres,
  similariteCosinus,
  type Filtres,
} from "./scoring";

const TOUT_VRAI: Filtres = { metier: true, zone: true, disponibilite: true };
const TOUT_FAUX: Filtres = { metier: false, zone: false, disponibilite: false };
const METIER_SEUL: Filtres = { metier: true, zone: false, disponibilite: false };

function sommePoids(reasons: readonly { poids: number }[]): number {
  return reasons.reduce((somme, r) => somme + r.poids, 0);
}

describe("pondérations", () => {
  it("les deux groupes de poids somment à 1", () => {
    expect(POIDS_FILTRES + POIDS_COSINUS).toBeCloseTo(1, 10);
    expect(POIDS_METIER + POIDS_ZONE + POIDS_DISPONIBILITE).toBeCloseTo(1, 10);
  });
});

describe("scoreFiltres", () => {
  it("vaut 1 si tout est satisfait, 0 si rien ne l'est", () => {
    expect(scoreFiltres(TOUT_VRAI)).toBe(1);
    expect(scoreFiltres(TOUT_FAUX)).toBe(0);
  });

  it("additionne les poids des filtres satisfaits", () => {
    expect(scoreFiltres(METIER_SEUL)).toBeCloseTo(POIDS_METIER, 4);
    expect(scoreFiltres({ metier: false, zone: true, disponibilite: true })).toBeCloseTo(POIDS_ZONE + POIDS_DISPONIBILITE, 4);
  });
});

describe("calculerScore", () => {
  it("tout vrai + cosinus 1 → score 1", () => {
    const resultat = calculerScore(TOUT_VRAI, 1);
    expect(resultat.score).toBe(1);
    expect(resultat.scoreFiltres).toBe(1);
    expect(resultat.cosinus).toBe(1);
    expect(resultat.reasons.map((r) => r.code)).toEqual(["metier", "zone", "disponibilite", "semantique"]);
  });

  it("tout faux + cosinus 0 → score 0, aucune reason", () => {
    const resultat = calculerScore(TOUT_FAUX, 0);
    expect(resultat.score).toBe(0);
    expect(resultat.reasons).toEqual([]);
  });

  it("métier seul + cosinus 0.5 → 0.6×0.5 + 0.4×0.5 = 0.5", () => {
    const resultat = calculerScore(METIER_SEUL, 0.5);
    expect(resultat.score).toBeCloseTo(0.5, 4);
    expect(resultat.reasons).toEqual([
      { code: "metier", libelle: "Même métier", poids: 0.3 },
      { code: "semantique", libelle: "Proximité sémantique des annonces", poids: 0.2 },
    ]);
  });

  it("borne un cosinus négatif à 0 et n'émet pas de reason sémantique", () => {
    const resultat = calculerScore(TOUT_VRAI, -0.8);
    expect(resultat.cosinus).toBe(0);
    expect(resultat.score).toBeCloseTo(POIDS_FILTRES, 4);
    expect(resultat.reasons.some((r) => r.code === "semantique")).toBe(false);
  });

  it("traite NaN comme 0 et borne un cosinus > 1 à 1", () => {
    expect(calculerScore(TOUT_FAUX, Number.NaN).cosinus).toBe(0);
    expect(calculerScore(TOUT_FAUX, Number.NaN).reasons).toEqual([]);
    expect(calculerScore(TOUT_FAUX, 1.5).cosinus).toBe(1);
    expect(calculerScore(TOUT_FAUX, 1.5).score).toBeCloseTo(POIDS_COSINUS, 4);
  });

  it("n'émet pas de reason sémantique si le cosinus est exactement 0", () => {
    expect(calculerScore(METIER_SEUL, 0).reasons.map((r) => r.code)).toEqual(["metier"]);
  });

  it("la somme des poids des reasons vaut le score (à l'arrondi près)", () => {
    const cas: [Filtres, number][] = [
      [TOUT_VRAI, 1],
      [TOUT_VRAI, 0.3333],
      [METIER_SEUL, 0.5],
      [{ metier: false, zone: true, disponibilite: false }, 0.71],
      [{ metier: true, zone: false, disponibilite: true }, 0.123456],
      [TOUT_FAUX, 0.9],
    ];
    for (const [filtres, cosinus] of cas) {
      const resultat = calculerScore(filtres, cosinus);
      expect(sommePoids(resultat.reasons)).toBeCloseTo(resultat.score, 3);
    }
  });

  it("chaque poids de reason est la contribution effective au score final", () => {
    const resultat = calculerScore(TOUT_VRAI, 0);
    const parCode = Object.fromEntries(resultat.reasons.map((r) => [r.code, r.poids]));
    expect(parCode.metier).toBeCloseTo(POIDS_FILTRES * POIDS_METIER, 4);
    expect(parCode.zone).toBeCloseTo(POIDS_FILTRES * POIDS_ZONE, 4);
    expect(parCode.disponibilite).toBeCloseTo(POIDS_FILTRES * POIDS_DISPONIBILITE, 4);
  });

  it("arrondit score, cosinus et poids à 4 décimales", () => {
    const resultat = calculerScore(TOUT_FAUX, 0.123456789);
    expect(resultat.cosinus).toBe(0.1235);
    expect(resultat.score).toBe(0.0494);
    expect(resultat.reasons[0].poids).toBe(0.0494);
  });
});

describe("similariteCosinus", () => {
  it("vaut ≈ 1 pour un vecteur avec lui-même", () => {
    const v = [0.3, -1.2, 4.5, 0.01];
    expect(similariteCosinus(v, v)).toBeCloseTo(1, 10);
  });

  it("vaut 0 pour deux vecteurs orthogonaux", () => {
    expect(similariteCosinus([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it("vaut -1 pour deux vecteurs opposés", () => {
    expect(similariteCosinus([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
  });

  it("vaut 0 si l'un des vecteurs est nul", () => {
    expect(similariteCosinus([0, 0], [1, 2])).toBe(0);
    expect(similariteCosinus([1, 2], [0, 0])).toBe(0);
  });

  it("lève une erreur si les dimensions diffèrent", () => {
    expect(() => similariteCosinus([1, 2, 3], [1, 2])).toThrow(/dimensions/);
  });
});
