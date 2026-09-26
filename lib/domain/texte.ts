/**
 * Normalisation de texte partagée par le domaine (métiers, zones) et les mocks.
 *
 * Objectif : comparer de façon tolérante ce que produit l'ASR/le LLM avec nos
 * listes fermées. On abaisse la casse, on retire les accents, on rapproche les
 * lettres spécifiques du dioula et du baoulé de leur équivalent latin de base
 * (ɛ→e, ɔ→o, ŋ→ng, ɲ→ny, ɩ→i, ʋ→u) et on réduit la ponctuation à des espaces.
 */

const LETTRES_LOCALES: Record<string, string> = {
  ɛ: "e",
  ɔ: "o",
  ŋ: "ng",
  ɲ: "ny",
  ɩ: "i",
  ʋ: "u",
  ɓ: "b",
  ɗ: "d",
};

export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marques diacritiques (accents, tons)
    .toLowerCase()
    .replace(/[ɛɔŋɲɩʋɓɗ]/g, (lettre) => LETTRES_LOCALES[lettre] ?? lettre)
    .replace(/[’`´]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ") // ponctuation → espace (les lettres de tout alphabet sont conservées)
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe un texte normalisé en mots (apostrophes et tirets séparés). */
export function mots(texte: string): string[] {
  return normaliser(texte)
    .split(/[\s'-]+/)
    .filter((mot) => mot.length > 0);
}

/**
 * `true` si `expression` apparaît dans `texte` comme mot(s) entier(s),
 * après normalisation des deux côtés. « macon » est trouvé dans « je cherche un maçon ».
 */
export function contientExpression(texte: string, expression: string): boolean {
  const t = ` ${mots(texte).join(" ")} `;
  const e = mots(expression).join(" ");
  if (e.length === 0) return false;
  return t.includes(` ${e} `);
}
