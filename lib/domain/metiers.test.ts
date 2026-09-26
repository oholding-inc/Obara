import { describe, expect, it } from "vitest";
import {
  METIERS,
  METIERS_PAR_CODE,
  METIER_CODES,
  NOMBRE_METIERS,
  chercherMetierParSynonyme,
  trouverMetier,
} from "./metiers";
import { mots, normaliser } from "./texte";

/**
 * Tests de cohérence de l'énumération fermée des métiers (CLAUDE.md §4).
 * Une entrée incohérente ici casse silencieusement le parser de structuration
 * et le filtre SQL du matching — d'où ces garde-fous.
 */

const METIERS_HORS_AUTRE = METIERS.filter((m) => m.code !== "autre");

describe("METIERS — structure", () => {
  it("contient exactement 25 entrées", () => {
    expect(METIERS).toHaveLength(25);
    expect(NOMBRE_METIERS).toBe(25);
    expect(METIER_CODES).toHaveLength(25);
  });

  it("a des codes uniques, dans l'ordre exact de METIER_CODES", () => {
    const codes = METIERS.map((m) => m.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...METIER_CODES]);
  });

  it("expose chaque métier dans METIERS_PAR_CODE", () => {
    for (const code of METIER_CODES) {
      expect(METIERS_PAR_CODE[code]?.code).toBe(code);
    }
  });

  it("n'a aucun libellé (fr, dioula, baoulé) ni icône vide", () => {
    for (const m of METIERS) {
      expect(m.libelle.trim(), `${m.code}: libelle`).not.toBe("");
      expect(m.libelleDioula.trim(), `${m.code}: libelleDioula`).not.toBe("");
      expect(m.libelleBaoule.trim(), `${m.code}: libelleBaoule`).not.toBe("");
      expect(m.icone.trim(), `${m.code}: icone`).not.toBe("");
    }
  });

  it("n'utilise que des noms d'icônes Lucide en kebab-case (jamais d'emoji)", () => {
    for (const m of METIERS) {
      expect(m.icone, `${m.code}: icone "${m.icone}"`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("METIERS — synonymes", () => {
  it("a au moins 5 synonymes pour chaque métier sauf « autre »", () => {
    for (const m of METIERS_HORS_AUTRE) {
      expect(m.synonymes.length, `${m.code}: ${m.synonymes.length} synonymes`).toBeGreaterThanOrEqual(5);
    }
    expect(METIERS_PAR_CODE.autre.synonymes).toEqual([]);
  });

  it("n'a que des synonymes en minuscules, non vides", () => {
    for (const m of METIERS) {
      for (const s of m.synonymes) {
        expect(s.trim(), `${m.code}: synonyme vide`).not.toBe("");
        expect(s, `${m.code}: "${s}" n'est pas en minuscules`).toBe(s.toLowerCase());
      }
    }
  });

  it("n'a aucun doublon de synonyme au sein d'un métier (après normalisation)", () => {
    for (const m of METIERS) {
      const vus = new Set<string>();
      for (const s of m.synonymes) {
        const cle = mots(s).join(" ");
        expect(vus.has(cle), `${m.code}: doublon "${s}"`).toBe(false);
        vus.add(cle);
      }
    }
  });

  it("n'a aucun synonyme égal au libellé normalisé du métier lui-même ou d'un autre métier", () => {
    const libelles = new Map(METIERS.map((m) => [normaliser(m.libelle), m.code]));
    for (const m of METIERS) {
      for (const s of m.synonymes) {
        const proprietaire = libelles.get(normaliser(s));
        expect(proprietaire, `${m.code}: "${s}" est le libellé de ${proprietaire ?? "?"}`).toBeUndefined();
      }
    }
  });

  it("n'a aucun synonyme partagé entre deux métiers (le mock LLM doit rester déterministe)", () => {
    const vus = new Map<string, string>();
    for (const m of METIERS) {
      for (const s of m.synonymes) {
        const cle = mots(s).join(" ");
        const autre = vus.get(cle);
        expect(autre, `"${s}" est partagé entre ${autre ?? "?"} et ${m.code}`).toBeUndefined();
        vus.set(cle, m.code);
      }
    }
  });

  it("résout chaque synonyme vers son propre métier", () => {
    for (const m of METIERS_HORS_AUTRE) {
      for (const s of m.synonymes) {
        expect(chercherMetierParSynonyme(s)?.code, `"${s}" devrait donner ${m.code}`).toBe(m.code);
      }
    }
  });
});

describe("chercherMetierParSynonyme — phrases réalistes", () => {
  const cas: ReadonlyArray<readonly [string, string]> = [
    ["je cherche quelqu'un pour faire le ménage à yopougon", "aide-menagere"],
    ["mon frère est wachman à cocody", "gardien"],
    ["je répare les portables et les iphones", "reparateur-telephone"],
    ["n bɛ so baara kɛ", "aide-menagere"],
    ["bonjour je suis maçon, je monte les murs et je coule les dalles à abobo", "macon"],
    ["je conduis un gbaka sur la ligne adjamé yopougon", "chauffeur"],
    ["je peux garder les enfants le matin", "nounou"],
    ["ne bɛ tobili kɛ", "cuisiniere"],
    ["je fais le ménage, le repassage et la cuisine chez les gens à yopougon", "aide-menagere"],
    ["je suis cuisinière, je fais la cuisine et je fais le ménage aussi", "cuisiniere"],
    ["j'ai une bonne expérience dans le taxi compteur", "chauffeur"],
    ["au courant de la semaine je fais taxi à abobo", "chauffeur"],
    ["je garde les enfants à cocody", "nounou"],
    ["je peux surveiller les enfants le soir", "nounou"],
    ["je repasse le linge et les habits des clients", "repasseuse"],
    ["je fais le ménage et je repasse le linge", "aide-menagere"],
    ["je vends des fleurs au bord de la route", "vendeur"],
    ["n bɛ so kɔnɔ baara kɛ", "aide-menagere"],
  ];

  it.each(cas)("« %s » → %s", (phrase, code) => {
    expect(chercherMetierParSynonyme(phrase)?.code).toBe(code);
  });

  it("ne renvoie rien sur un texte sans métier connu", () => {
    expect(chercherMetierParSynonyme("bonjour, je suis disponible à treichville")).toBeUndefined();
    expect(chercherMetierParSynonyme("")).toBeUndefined();
  });
});

describe("trouverMetier", () => {
  it("retrouve un métier par son libellé accentué ou par son code", () => {
    expect(trouverMetier("Maçon")?.code).toBe("macon");
    expect(trouverMetier("macon")?.code).toBe("macon");
    expect(trouverMetier("Aide-ménagère")?.code).toBe("aide-menagere");
    expect(trouverMetier("reparateur-telephone")?.code).toBe("reparateur-telephone");
  });

  it("renvoie undefined pour un libellé inconnu", () => {
    expect(trouverMetier("astronaute")).toBeUndefined();
  });
});
