import { mots } from "./texte";

/**
 * Référentiel des zones d'Abidjan : les 10 communes de la ville, les 3
 * sous-préfectures du District autonome, et les grands quartiers rattachés
 * à leur commune.
 *
 * Le LLM renvoie des libellés de zones en texte libre (« Yopougon », « Niangon »,
 * « 2 plateaux »). Ce module les rattache à une zone connue (`trouverZone`), en
 * extrait d'un texte libre (`chercherZonesDansTexte`) et décide si deux zones
 * sont compatibles pour le filtre SQL du matching (`zonesCompatibles`).
 *
 * Règles de nommage :
 * - code de commune = slug sans accent ni espace (`port-bouet`) ;
 * - code de quartier = `<commune>/<slug>` (`yopougon/niangon`) ;
 * - libellé avec accents, tel qu'affiché dans l'interface ;
 * - alias en minuscules : abréviations, graphies courantes, formes composées.
 *
 * Chaque quartier est défini sous UNE seule commune (structure du tableau
 * QUARTIERS_PAR_COMMUNE) : un quartier ne peut donc pas être rattaché à deux
 * communes. Les libellés sont uniques sur l'ensemble du référentiel.
 */

// ---------------------------------------------------------------------------
// Communes
// ---------------------------------------------------------------------------

/** 10 communes de la ville d'Abidjan + 3 sous-préfectures du District autonome. */
export const COMMUNES = [
  "abobo",
  "adjame",
  "attecoube",
  "cocody",
  "koumassi",
  "marcory",
  "plateau",
  "port-bouet",
  "treichville",
  "yopougon",
  "anyama",
  "bingerville",
  "songon",
] as const;

export type CommuneCode = (typeof COMMUNES)[number];

export interface Zone {
  /** `yopougon` (commune) ou `yopougon/niangon` (quartier). Unique. */
  code: string;
  /** Libellé affiché, avec accents. Unique sur tout le référentiel. */
  libelle: string;
  /** Commune de rattachement (elle-même pour une commune). */
  commune: CommuneCode;
  type: "commune" | "quartier";
  /** Abréviations et graphies courantes, en minuscules. */
  alias: readonly string[];
}

interface DefinitionCommune {
  libelle: string;
  alias: readonly string[];
}

const DEFINITIONS_COMMUNES: Readonly<Record<CommuneCode, DefinitionCommune>> = {
  abobo: { libelle: "Abobo", alias: [] },
  adjame: { libelle: "Adjamé", alias: [] },
  attecoube: { libelle: "Attécoubé", alias: ["attekoube"] },
  cocody: { libelle: "Cocody", alias: [] },
  koumassi: { libelle: "Koumassi", alias: ["koumasi"] },
  marcory: { libelle: "Marcory", alias: ["marcori"] },
  plateau: { libelle: "Plateau", alias: ["le plateau"] },
  "port-bouet": { libelle: "Port-Bouët", alias: ["port bouet", "port-bouët", "portbouet"] },
  treichville: { libelle: "Treichville", alias: ["treich"] },
  yopougon: { libelle: "Yopougon", alias: ["yop", "yopou"] },
  anyama: { libelle: "Anyama", alias: [] },
  bingerville: { libelle: "Bingerville", alias: [] },
  songon: { libelle: "Songon", alias: [] },
};

// ---------------------------------------------------------------------------
// Quartiers
// ---------------------------------------------------------------------------

interface DefinitionQuartier {
  /** Slug sans accent ; le code final sera `<commune>/<slug>`. */
  slug: string;
  libelle: string;
  alias?: readonly string[];
  /**
   * `true` si le libellé seul est un mot courant (« Santé », « Liberté »,
   * « Plaque »…) ou un nom propre fréquent (« Samaké »). Dans un texte libre,
   * il n'est alors reconnu que précédé du libellé de sa commune
   * (« Attécoubé Santé ») ou via un alias composé (« quartier santé »).
   * `trouverZone` (correspondance exacte sur tout le texte) n'est pas concerné.
   */
  libelleAmbigu?: boolean;
}

const QUARTIERS_PAR_COMMUNE: Readonly<Record<CommuneCode, readonly DefinitionQuartier[]>> = {
  yopougon: [
    { slug: "niangon", libelle: "Niangon", alias: ["niangon nord", "niangon sud", "niangon lokoa", "niangon adjame"] },
    // « Sicogi » existe aussi à Koumassi : libellé seul reconnu seulement après « Yopougon ».
    { slug: "sicogi", libelle: "Sicogi", alias: ["sicogi yopougon"], libelleAmbigu: true },
    { slug: "toits-rouges", libelle: "Toits-Rouges", alias: ["toits rouges", "toit rouge", "toit rouges", "toits rouge"] },
    { slug: "selmer", libelle: "Selmer" },
    { slug: "maroc", libelle: "Maroc", alias: ["quartier maroc"], libelleAmbigu: true },
    { slug: "andokoi", libelle: "Andokoi", alias: ["andokoua"] },
    { slug: "gesco", libelle: "Gesco" },
    { slug: "koute", libelle: "Kouté" },
    { slug: "sideci", libelle: "Sideci" },
    { slug: "millionnaire", libelle: "Millionnaire", alias: ["quartier millionnaire"] },
    { slug: "port-bouet-2", libelle: "Port-Bouët 2", alias: ["port bouet 2", "port bouet deux", "port-bouet ii"] },
    { slug: "wassakara", libelle: "Wassakara" },
    { slug: "ananeraie", libelle: "Ananeraie", alias: ["ananeraies"] },
    { slug: "academie", libelle: "Académie", alias: ["quartier academie"], libelleAmbigu: true },
    { slug: "yao-sehi", libelle: "Yao-Séhi", alias: ["yaosehi", "quartier yao sehi"], libelleAmbigu: true },
  ],
  abobo: [
    { slug: "abobo-gare", libelle: "Abobo-Gare", alias: ["abobo gare", "gare d'abobo", "la gare d'abobo"] },
    { slug: "abobo-baoule", libelle: "Abobo-Baoulé", alias: ["abobo baoule"] },
    { slug: "anonkoua-koute", libelle: "Anonkoua-Kouté", alias: ["anonkoua", "anonkoua koute"] },
    { slug: "avocatier", libelle: "Avocatier", alias: ["avocatiers"] },
    { slug: "sagbe", libelle: "Sagbé" },
    { slug: "n-dotre", libelle: "N'Dotré", alias: ["ndotre"] },
    { slug: "pk18", libelle: "PK18", alias: ["pk 18", "pk-18", "pk dix-huit"] },
    { slug: "samake", libelle: "Samaké", alias: ["quartier samake"], libelleAmbigu: true },
    { slug: "derriere-rails", libelle: "Derrière-Rails", alias: ["derriere rail", "derriere les rails"] },
    { slug: "sogefiha", libelle: "Sogefiha" },
    { slug: "plaque", libelle: "Plaque", alias: ["quartier plaque", "plaque 1", "plaque 2"], libelleAmbigu: true },
    { slug: "abobo-te", libelle: "Abobo-Té", alias: ["abobo te"] },
    { slug: "kennedy", libelle: "Kennedy" },
    // Libellé préfixé : Belleville existe à Abobo et à Treichville.
    { slug: "belleville", libelle: "Abobo Belleville", alias: ["belleville abobo"] },
  ],
  cocody: [
    {
      slug: "angre",
      libelle: "Angré",
      alias: [
        "7e tranche",
        "8e tranche",
        "9e tranche",
        "7eme tranche",
        "8eme tranche",
        "9eme tranche",
        "angre chateau",
        "angre djibi",
        "djibi",
      ],
    },
    // Zone générique : « la Riviera » sans précision. Les Riviera 2/3/Golf/Palmeraie/Bonoumin
    // sont des zones distinctes, reconnues en priorité (expression plus longue).
    { slug: "riviera", libelle: "Riviera", alias: ["la riviera"] },
    { slug: "riviera-2", libelle: "Riviera 2", alias: ["riviera ii", "riviera deux"] },
    { slug: "riviera-3", libelle: "Riviera 3", alias: ["riviera iii", "riviera trois"] },
    { slug: "riviera-golf", libelle: "Riviera Golf", alias: ["riviera golf 4"] },
    { slug: "riviera-palmeraie", libelle: "Riviera Palmeraie", alias: ["palmeraie", "la palmeraie"] },
    { slug: "riviera-bonoumin", libelle: "Riviera Bonoumin", alias: ["bonoumin"] },
    {
      slug: "deux-plateaux",
      libelle: "Deux-Plateaux",
      alias: ["2 plateaux", "deux plateaux", "ii plateaux", "les deux plateaux", "2 plateau", "deux plateau"],
    },
    { slug: "vallon", libelle: "Vallon", alias: ["vallons", "les vallons", "deux plateaux vallon", "2 plateaux vallon"] },
    { slug: "danga", libelle: "Danga" },
    { slug: "blockhauss", libelle: "Blockhauss", alias: ["blokosso", "blockauss", "blokoss", "blockhaus"] },
    { slug: "mermoz", libelle: "Mermoz" },
    { slug: "cite-des-arts", libelle: "Cité des Arts" },
    { slug: "cocody-centre", libelle: "Cocody Centre" },
    { slug: "ambassades", libelle: "Ambassades", alias: ["quartier des ambassades", "les ambassades"] },
    { slug: "attoban", libelle: "Attoban", alias: ["riviera attoban"] },
    { slug: "mpouto", libelle: "M'Pouto", alias: ["mpouto"] },
    { slug: "saint-jean", libelle: "Saint-Jean", alias: ["saint jean", "st jean"] },
  ],
  treichville: [
    { slug: "zone-3", libelle: "Zone 3", alias: ["zone trois"] },
    { slug: "arras", libelle: "Arras", alias: ["arras 1", "arras 2", "arras 3"] },
    { slug: "avenue-16", libelle: "Avenue 16", alias: ["avenue seize"] },
    { slug: "biafra", libelle: "Biafra" },
    { slug: "habitat", libelle: "Habitat", alias: ["cite habitat"], libelleAmbigu: true },
    { slug: "nanan-yamousso", libelle: "Nanan-Yamousso", alias: ["nanan yamousso", "nanan yamoussou"] },
    { slug: "cite-douane", libelle: "Cité Douane", alias: ["cite douanes"] },
    { slug: "france-amerique", libelle: "France-Amérique", alias: ["france amerique"] },
    // Libellé préfixé : Belleville existe à Abobo et à Treichville.
    { slug: "belleville", libelle: "Treichville Belleville", alias: ["belleville treichville"] },
  ],
  marcory: [
    { slug: "zone-4", libelle: "Zone 4", alias: ["zone quatre", "zone 4c", "zone 4 c", "zone iv"] },
    { slug: "bietry", libelle: "Biétry", alias: ["bietri"] },
    { slug: "anoumabo", libelle: "Anoumabo", alias: ["anoumambo"] },
    { slug: "residentiel", libelle: "Marcory Résidentiel" },
    { slug: "sans-fil", libelle: "Sans-Fil", alias: ["quartier sans fil"], libelleAmbigu: true },
    { slug: "champroux", libelle: "Champroux" },
    // Libellé préfixé pour rester unique face au Remblais de Koumassi.
    { slug: "remblais", libelle: "Marcory Remblais" },
    { slug: "aliodan", libelle: "Aliodan" },
    { slug: "konan-raphael", libelle: "Konan-Raphaël", alias: ["konan raphael"] },
    { slug: "hibiscus", libelle: "Hibiscus" },
    { slug: "poto-poto", libelle: "Poto-Poto", alias: ["quartier poto poto"], libelleAmbigu: true },
  ],
  koumassi: [
    // « remblais » est aussi un mot de chantier (un maçon parle de remblais) : composé seulement.
    { slug: "remblais", libelle: "Remblais", alias: ["quartier remblais"], libelleAmbigu: true },
    // Libellé préfixé pour rester unique face au Sicogi de Yopougon.
    { slug: "sicogi", libelle: "Koumassi Sicogi", alias: ["sicogi koumassi"] },
    { slug: "grand-campement", libelle: "Grand Campement" },
    { slug: "prodomo", libelle: "Prodomo" },
    { slug: "zoe-bruno", libelle: "Zoé-Bruno", alias: ["zoe bruno"] },
    { slug: "sopim", libelle: "Sopim" },
    { slug: "nord-est", libelle: "Nord-Est", alias: ["quartier nord-est"], libelleAmbigu: true },
    // « Divo » est aussi une ville de Côte d'Ivoire : composé seulement.
    { slug: "divo", libelle: "Divo", alias: ["quartier divo"], libelleAmbigu: true },
    { slug: "akromiabla", libelle: "Akromiabla" },
    { slug: "sainte-therese", libelle: "Sainte-Thérèse", alias: ["sainte therese", "ste therese"] },
  ],
  "port-bouet": [
    { slug: "vridi", libelle: "Vridi", alias: ["vridi cite"] },
    { slug: "vridi-canal", libelle: "Vridi Canal" },
    { slug: "gonzagueville", libelle: "Gonzagueville", alias: ["gonzague"] },
    { slug: "adjouffou", libelle: "Adjouffou", alias: ["adjoufou"] },
    { slug: "petit-bassam", libelle: "Petit-Bassam", alias: ["petit bassam"] },
    { slug: "jean-folly", libelle: "Jean-Folly", alias: ["jean folly"] },
    { slug: "abattoir", libelle: "Abattoir", alias: ["abattoirs"] },
    { slug: "aeroport", libelle: "Aéroport", alias: ["zone aeroport", "aeroport fhb"] },
    { slug: "phare", libelle: "Phare", alias: ["quartier phare"], libelleAmbigu: true },
    { slug: "derriere-wharf", libelle: "Derrière-Wharf", alias: ["derriere wharf", "derriere le wharf"] },
  ],
  adjame: [
    { slug: "liberte", libelle: "Liberté", alias: ["quartier liberte"], libelleAmbigu: true },
    { slug: "220-logements", libelle: "220 Logements", alias: ["220 logement", "deux cent vingt logements"] },
    { slug: "williamsville", libelle: "Williamsville", alias: ["williams ville"] },
    { slug: "bracodi", libelle: "Bracodi" },
    { slug: "adjame-nord", libelle: "Adjamé Nord" },
    { slug: "habitat-extension", libelle: "Habitat Extension" },
    { slug: "paillet", libelle: "Paillet" },
    { slug: "mairie-1", libelle: "Mairie 1", alias: ["mairie un"] },
    { slug: "forum", libelle: "Forum", alias: ["forum d'adjame", "forum adjame"], libelleAmbigu: true },
    { slug: "adjame-village", libelle: "Adjamé Village" },
    { slug: "indenie", libelle: "Indénié", alias: ["carrefour indenie"] },
  ],
  attecoube: [
    { slug: "locodjro", libelle: "Locodjro", alias: ["locodjoro"] },
    { slug: "sante", libelle: "Santé", alias: ["quartier sante"], libelleAmbigu: true },
    { slug: "mossikro", libelle: "Mossikro" },
    { slug: "sebroko", libelle: "Sébroko" },
    { slug: "agban", libelle: "Agban", alias: ["agban village", "agban attie"] },
    { slug: "jean-paul-ii", libelle: "Jean-Paul II", alias: ["jean paul 2", "jean paul deux"] },
    { slug: "abobo-doume", libelle: "Abobo-Doumé", alias: ["abobo doume"] },
    { slug: "boribana", libelle: "Boribana" },
  ],
  plateau: [
    { slug: "plateau-centre", libelle: "Plateau Centre" },
    { slug: "cite-administrative", libelle: "Cité Administrative" },
    { slug: "plateau-sud", libelle: "Plateau Sud" },
  ],
  anyama: [
    { slug: "anyama-centre", libelle: "Anyama Centre" },
    { slug: "ebimpe", libelle: "Ebimpé" },
    { slug: "zossonkoi", libelle: "Zossonkoi", alias: ["zossankoi"] },
    { slug: "anyama-adjame", libelle: "Anyama-Adjamé" },
  ],
  bingerville: [
    { slug: "bingerville-centre", libelle: "Bingerville Centre" },
    { slug: "feh-kesse", libelle: "Féh-Kessé", alias: ["feh kesse", "fekesse"] },
    { slug: "adjin", libelle: "Adjin" },
    { slug: "gbagba", libelle: "Gbagba" },
    // Administrativement à Bingerville, en lisière de Cocody ; aussi dit « Cocody Abatta ».
    { slug: "abatta", libelle: "Abatta", alias: ["riviera abatta", "cocody abatta"] },
  ],
  songon: [
    { slug: "songon-village", libelle: "Songon-Village" },
    { slug: "songon-agban", libelle: "Songon-Agban" },
    { slug: "kassemble", libelle: "Kassemblé" },
    { slug: "songon-te", libelle: "Songon-Té", alias: ["songon te"] },
    { slug: "songon-dagbe", libelle: "Songon-Dagbé" }, // à vérifier
  ],
};

// ---------------------------------------------------------------------------
// Référentiel assemblé
// ---------------------------------------------------------------------------

/** Codes des quartiers dont le libellé seul est trop ambigu pour la recherche en texte libre. */
const CODES_LIBELLE_AMBIGU = new Set<string>();

function construireZones(): Zone[] {
  const communes: Zone[] = COMMUNES.map((code) => ({
    code,
    libelle: DEFINITIONS_COMMUNES[code].libelle,
    commune: code,
    type: "commune",
    alias: DEFINITIONS_COMMUNES[code].alias,
  }));

  const quartiers: Zone[] = COMMUNES.flatMap((commune) =>
    QUARTIERS_PAR_COMMUNE[commune].map((definition) => {
      const code = `${commune}/${definition.slug}`;
      if (definition.libelleAmbigu) CODES_LIBELLE_AMBIGU.add(code);
      return {
        code,
        libelle: definition.libelle,
        commune,
        type: "quartier" as const,
        alias: definition.alias ?? [],
      };
    }),
  );

  return [...communes, ...quartiers];
}

/** Toutes les zones : d'abord les communes (dans l'ordre de COMMUNES), puis les quartiers. */
export const ZONES: readonly Zone[] = construireZones();

export const ZONES_PAR_CODE: Readonly<Record<string, Zone>> = Object.fromEntries(
  ZONES.map((zone) => [zone.code, zone]),
);

export const NOMBRE_ZONES: number = ZONES.length;
export const NOMBRE_COMMUNES: number = COMMUNES.length;

// ---------------------------------------------------------------------------
// Recherche exacte (trouverZone)
// ---------------------------------------------------------------------------

/**
 * Clé de comparaison : mots normalisés joints par un espace. Tolère la casse,
 * les accents, et les variantes tiret / espace / apostrophe
 * (« Port-Bouët » ≡ « port bouet », « yopougon/niangon » ≡ « Yopougon Niangon »).
 */
function cleExacte(texte: string): string {
  return mots(texte).join(" ");
}

/** `true` si les mots de `libelle` commencent par ceux de `prefixe`. */
function commencePar(libelle: readonly string[], prefixe: readonly string[]): boolean {
  return prefixe.length <= libelle.length && prefixe.every((mot, i) => libelle[i] === mot);
}

function construireIndexExact(): ReadonlyMap<string, Zone> {
  const index = new Map<string, Zone>();
  const ajouter = (texte: string, zone: Zone): void => {
    const cle = cleExacte(texte);
    if (cle.length > 0 && !index.has(cle)) index.set(cle, zone);
  };

  for (const zone of ZONES) {
    ajouter(zone.code, zone);
    ajouter(zone.libelle, zone);
    for (const alias of zone.alias) ajouter(alias, zone);

    if (zone.type === "quartier") {
      const libelleCommune = DEFINITIONS_COMMUNES[zone.commune].libelle;
      if (!commencePar(mots(zone.libelle), mots(libelleCommune))) {
        ajouter(`${libelleCommune} ${zone.libelle}`, zone);
        ajouter(`${zone.libelle} ${libelleCommune}`, zone);
      }
    }
  }
  return index;
}

const INDEX_EXACT = construireIndexExact();

/**
 * Retrouve une zone par correspondance exacte (après normalisation) sur son
 * code, son libellé, un alias, ou « <libellé commune> <libellé quartier> ».
 * Insensible à la casse, aux accents et aux tirets.
 */
export function trouverZone(texte: string): Zone | undefined {
  return INDEX_EXACT.get(cleExacte(texte));
}

// ---------------------------------------------------------------------------
// Recherche dans un texte libre (chercherZonesDansTexte)
// ---------------------------------------------------------------------------

interface ExpressionRecherche {
  zone: Zone;
  /**
   * Mots qui doivent précéder immédiatement l'expression sans en faire partie
   * (le libellé de la commune, pour un quartier au libellé ambigu). Ils ne sont
   * pas consommés : la commune reste reconnue comme citée explicitement.
   */
  prefixe: readonly string[];
  /** Mots de l'expression, consommés lorsqu'elle est reconnue. */
  motsExpression: readonly string[];
}

function construireExpressionsRecherche(): readonly ExpressionRecherche[] {
  const expressions: ExpressionRecherche[] = [];

  for (const zone of ZONES) {
    const motsLibelle = mots(zone.libelle);
    const prefixe = CODES_LIBELLE_AMBIGU.has(zone.code) ? mots(DEFINITIONS_COMMUNES[zone.commune].libelle) : [];
    expressions.push({ zone, prefixe, motsExpression: motsLibelle });
    for (const alias of zone.alias) {
      expressions.push({ zone, prefixe: [], motsExpression: mots(alias) });
    }
  }

  const longueurTotale = (e: ExpressionRecherche): number => e.prefixe.length + e.motsExpression.length;
  const nombreCaracteres = (e: ExpressionRecherche): number => [...e.prefixe, ...e.motsExpression].join(" ").length;

  // L'expression la plus longue d'abord : « abobo gare » avant « abobo », « port bouet 2 » avant « port bouet ».
  return expressions
    .filter((e) => e.motsExpression.length > 0)
    .sort((a, b) => longueurTotale(b) - longueurTotale(a) || nombreCaracteres(b) - nombreCaracteres(a));
}

const EXPRESSIONS_RECHERCHE = construireExpressionsRecherche();

function correspondA(tokens: readonly string[], debut: number, attendu: readonly string[]): boolean {
  if (debut < 0 || debut + attendu.length > tokens.length) return false;
  return attendu.every((mot, i) => tokens[debut + i] === mot);
}

/**
 * Toutes les zones mentionnées dans un texte libre (transcription), sans doublon,
 * dans l'ordre d'apparition.
 *
 * Reconnaissance sur mots entiers après normalisation (même sémantique que
 * `contientExpression`), expression la plus longue d'abord ; les mots reconnus
 * sont consommés, si bien qu'un quartier n'entraîne pas sa commune :
 * « abobo gare » → Abobo-Gare seulement, « à Abobo, vers Abobo-Gare » → les deux.
 * Un libellé ambigu (« Santé », « Liberté »…) n'est reconnu que précédé de sa
 * commune ou via un alias composé (« quartier santé »).
 */
export function chercherZonesDansTexte(texte: string): Zone[] {
  const tokens = mots(texte);
  if (tokens.length === 0) return [];

  const consomme: boolean[] = new Array<boolean>(tokens.length).fill(false);
  const trouvees = new Map<string, { zone: Zone; position: number }>();

  for (const expression of EXPRESSIONS_RECHERCHE) {
    const longueur = expression.motsExpression.length;
    for (let i = 0; i + longueur <= tokens.length; i++) {
      if (!correspondA(tokens, i, expression.motsExpression)) continue;
      if (consomme.slice(i, i + longueur).some(Boolean)) continue;
      if (expression.prefixe.length > 0 && !correspondA(tokens, i - expression.prefixe.length, expression.prefixe)) {
        continue;
      }
      consomme.fill(true, i, i + longueur);
      const existante = trouvees.get(expression.zone.code);
      if (!existante || i < existante.position) trouvees.set(expression.zone.code, { zone: expression.zone, position: i });
      i += longueur - 1;
    }
  }

  return [...trouvees.values()].sort((a, b) => a.position - b.position).map((t) => t.zone);
}

// ---------------------------------------------------------------------------
// Compatibilité (filtre « zone » du matching)
// ---------------------------------------------------------------------------

/**
 * Deux zones sont compatibles si elles sont identiques ou dans la même commune
 * (un quartier est compatible avec sa commune et avec ses quartiers voisins).
 * Accepte un code (`yopougon/niangon`) ou, par tolérance, un libellé/alias
 * (`Yopougon`). `false` si l'une des deux est inconnue.
 */
export function zonesCompatibles(a: string, b: string): boolean {
  const zoneA = resoudreZone(a);
  const zoneB = resoudreZone(b);
  if (!zoneA || !zoneB) return false;
  return zoneA.code === zoneB.code || zoneA.commune === zoneB.commune;
}

function resoudreZone(codeOuLibelle: string): Zone | undefined {
  // Object.hasOwn : ZONES_PAR_CODE hérite d'Object.prototype (« constructor », « toString »…).
  const parCode: Zone | undefined = Object.hasOwn(ZONES_PAR_CODE, codeOuLibelle)
    ? ZONES_PAR_CODE[codeOuLibelle]
    : undefined;
  return parCode ?? trouverZone(codeOuLibelle);
}
