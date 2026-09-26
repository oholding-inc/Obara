import { contientExpression, normaliser } from "./texte";

/**
 * Énumération FERMÉE des métiers du secteur informel ivoirien (CLAUDE.md §4).
 *
 * Le LLM choisit un code dans METIER_CODES ou renvoie `autre` — jamais autre chose.
 * C'est ce qui rend le filtre SQL du matching fiable.
 *
 * `icone` est un nom d'icône Lucide (kebab-case), jamais un emoji (CLAUDE.md §6).
 * `synonymes` contient le vocabulaire courant ET le vocabulaire de rue (nouchi,
 * emprunts, dioula, baoulé) tel qu'il sort d'un vocal réel.
 */

export const METIER_CODES = [
  "aide-menagere",
  "macon",
  "couturiere",
  "mecanicien",
  "plombier",
  "electricien",
  "peintre",
  "menuisier",
  "coiffeuse",
  "jardinier",
  "gardien",
  "chauffeur",
  "livreur",
  "soudeur",
  "carreleur",
  "vitrier",
  "blanchisseur",
  "cuisiniere",
  "nounou",
  "repasseuse",
  "vendeur",
  "reparateur-telephone",
  "frigoriste",
  "tapissier",
  "autre",
] as const;

export type MetierCode = (typeof METIER_CODES)[number];

export interface Metier {
  code: MetierCode;
  /** Libellé français affiché dans l'interface (l'interface est en français, CLAUDE.md §3). */
  libelle: string;
  /** Libellé en dioula (orthographe standard ; `// à valider` si incertain). */
  libelleDioula: string;
  /** Libellé en baoulé (idem). */
  libelleBaoule: string;
  /** Nom d'icône Lucide, ex. `hammer`, `wrench`. */
  icone: string;
  /** Synonymes et vocabulaire de rue, en minuscules, sans le libellé lui-même. */
  synonymes: readonly string[];
}

/**
 * Les 25 métiers, dans l'ordre exact de METIER_CODES.
 *
 * Les synonymes sont comparés mot à mot après normalisation (lib/domain/texte.ts :
 * accents retirés, ɛ→e, ɔ→o, ɲ→ny, ŋ→ng). Ils incluent donc les formes telles
 * qu'elles sortent d'un ASR : féminin/masculin, pluriels, expressions d'usage
 * (« faire le ménage »), nouchi et emprunts (« wachman », « gbaka »), et le
 * vocabulaire dioula / baoulé courant (« so baara », « tobili »).
 *
 * Règle d'or des synonymes : jamais un mot trop générique qui apparaîtrait dans
 * le vocal d'un AUTRE métier (« chantier », « portable », « bois », « marché »…),
 * car chercherMetierParSynonyme fait gagner l'expression la plus longue (à palier
 * égal : un libellé cité l'emporte toujours sur un synonyme).
 *
 * Les libellés locaux marqués « à valider avec un locuteur » sont des
 * constructions plausibles mais non vérifiées auprès d'un natif.
 */
export const METIERS: readonly Metier[] = [
  {
    code: "aide-menagere",
    libelle: "Aide-ménagère",
    libelleDioula: "So baarakɛla",
    libelleBaoule: "Sua junman difuɛ", // à valider avec un locuteur
    icone: "sparkles",
    synonymes: [
      "ménage",
      "faire le ménage",
      "fais le ménage",
      "fait le ménage",
      "fais du ménage",
      "fait du ménage",
      "femme de ménage",
      "fille de ménage",
      "ménagère",
      "ménagères",
      "aides ménagères",
      // Jamais « bonne » seul : adjectif omniprésent (« bonne expérience », « bonne journée »).
      "bonne à tout faire",
      "travaille comme bonne",
      "je suis bonne",
      "cherche une bonne",
      "boyesse",
      "boy",
      "domestique",
      "servante",
      "nettoyage",
      "nettoyer la maison",
      "laver la maison",
      "balayer",
      "entretien de maison",
      "femme de chambre",
      "so baara",
      "so baarakɛmuso",
      "sokɔnɔ baara",
      "so kɔnɔ baara", // à valider avec un locuteur (graphie séparée ou soudée)
      "sokɔnɔbaara", // à valider avec un locuteur
      "sua junman",
      "sua nun junman",
    ],
  },
  {
    code: "macon",
    libelle: "Maçon",
    libelleDioula: "Masɔn",
    libelleBaoule: "Sua kplanfuɛ", // à valider avec un locuteur
    icone: "brick-wall",
    synonymes: [
      "maçons",
      "maçonnerie",
      "brique",
      "briques",
      "parpaing",
      "parpaings",
      "construire",
      "construction",
      "crépir",
      "crépissage",
      "monter un mur",
      "faire un mur",
      "dalle",
      "couler une dalle",
      "béton",
      "ciment",
      "ouvrier du bâtiment",
      "manœuvre",
      "manoeuvre",
      "masɔn",
      "so jɔ",
      "sojɔla",
      "so jɔla",
      "sua kplan",
    ],
  },
  {
    code: "couturiere",
    libelle: "Couturière",
    libelleDioula: "Kalalikɛla", // à valider avec un locuteur
    libelleBaoule: "Tralɛ kpɛfuɛ", // à valider avec un locuteur
    icone: "scissors-line-dashed",
    synonymes: [
      "couturier",
      "couturiers",
      "couturières",
      "couture",
      "tailleur",
      "tailleurs",
      "tailleuse",
      "coudre",
      "coudre des habits",
      "coudre des pagnes",
      "faire la couture",
      "machine à coudre",
      "atelier de couture",
      "styliste",
      "broderie",
      "brodeur",
      "kalali",
      "fini kala",
      "finikalala",
      "tayɛri",
      "tralɛ kpɛ",
    ],
  },
  {
    code: "mecanicien",
    libelle: "Mécanicien",
    libelleDioula: "Mekanisyɛn",
    libelleBaoule: "Loto siesiefuɛ", // à valider avec un locuteur
    icone: "wrench",
    synonymes: [
      "mécaniciens",
      "mécanicienne",
      "mécanique",
      "mécano",
      "garagiste",
      "garagistes",
      "garage",
      "réparer les voitures",
      "répare les voitures",
      "réparation de voitures",
      "réparer les motos",
      "répare les motos",
      "réparer les véhicules",
      "tôlier",
      "tôlerie",
      "carrossier",
      "carrosserie",
      "apprenti mécanicien",
      "apprenti garagiste",
      "vidange",
      "mekanisiyɛn",
      "mobili dilan",
      "mobili dilanna",
      "mobili dilanbaga",
      "loto siesie",
    ],
  },
  {
    code: "plombier",
    libelle: "Plombier",
    libelleDioula: "Plɔnbiye",
    libelleBaoule: "Nzue junman difuɛ", // à valider avec un locuteur
    icone: "droplets",
    synonymes: [
      "plombiers",
      "plomberie",
      "tuyau",
      "tuyaux",
      "tuyauterie",
      "fuite",
      "fuite d'eau",
      "robinet",
      "robinets",
      "canalisation",
      "canalisations",
      "wc bouché",
      "déboucher",
      "réparer les tuyaux",
      "réparer le robinet",
      "pilonbiye",
      "ji tuyo",
      "ji baara",
      "nzue junman",
    ],
  },
  {
    code: "electricien",
    libelle: "Électricien",
    libelleDioula: "Kuran baarakɛla",
    libelleBaoule: "Kuran junman difuɛ", // à valider avec un locuteur
    icone: "zap",
    synonymes: [
      "électriciens",
      "électricité",
      "installation électrique",
      "câblage",
      "câbles",
      "prise",
      "prises",
      "disjoncteur",
      "réparer le courant",
      "problème de courant",
      // Jamais « courant » seul : « au courant », « courant de la semaine ».
      "installer le courant",
      "le courant ne passe pas",
      "le courant est coupé",
      "panne de courant",
      "brancher",
      "kuran",
      "kuran baara",
      "elɛkitirisiyɛn",
      "kuran junman",
    ],
  },
  {
    code: "peintre",
    libelle: "Peintre",
    libelleDioula: "Pɛntiri", // à valider avec un locuteur
    libelleBaoule: "Sua pɛntifuɛ", // à valider avec un locuteur
    icone: "paint-roller",
    synonymes: [
      "peintres",
      "peinture",
      "peindre",
      "peintre en bâtiment",
      "peindre les murs",
      "peinture des murs",
      "repeindre",
      "faire la peinture",
      "pinceau",
      "rouleau",
      "badigeon",
      "badigeonner",
      "enduit",
      "pɛnturu",
      "pɛnturukɛla",
      "so pɛnturu",
      "sua pɛnti",
    ],
  },
  {
    code: "menuisier",
    libelle: "Menuisier",
    libelleDioula: "Minisiye",
    libelleBaoule: "Waka junman difuɛ", // à valider avec un locuteur
    icone: "hammer",
    synonymes: [
      "menuisiers",
      "menuiserie",
      "ébéniste",
      "ébénisterie",
      "travail du bois",
      "fabriquer des meubles",
      "meubles en bois",
      "portes en bois",
      "fabriquer des portes",
      "lit en bois",
      "armoire",
      "charpentier",
      "charpente",
      "raboter",
      "jiri lɛsɛla",
      "jirilɛsɛla",
      "yiri lɛsɛla",
      "waka junman",
    ],
  },
  {
    code: "coiffeuse",
    libelle: "Coiffeuse",
    libelleDioula: "Kundala", // à valider avec un locuteur
    libelleBaoule: "Ti yofuɛ", // à valider avec un locuteur
    icone: "scissors",
    synonymes: [
      "coiffeur",
      "coiffeurs",
      "coiffeuses",
      "coiffure",
      "coiffer",
      "salon de coiffure",
      "tresses",
      "tresser",
      "tresseuse",
      "faire les tresses",
      "faire les cheveux",
      "cheveux",
      "tissage",
      "mèches",
      "barbier",
      "barber",
      "couper les cheveux",
      "nattes",
      "natter",
      "kunsigi",
      "kunsigi tigɛla",
      "kunsigi dala",
      "kundalan",
      "kwafɛri",
      "ti yo",
    ],
  },
  {
    code: "jardinier",
    libelle: "Jardinier",
    libelleDioula: "Nakɔ baarakɛla", // à valider avec un locuteur
    libelleBaoule: "Fie difuɛ", // à valider avec un locuteur
    icone: "leaf",
    synonymes: [
      "jardiniers",
      "jardinage",
      "jardin",
      "entretien du jardin",
      "entretenir le jardin",
      "tondre",
      "tondre la pelouse",
      "pelouse",
      "gazon",
      "arroser",
      "arroser les plantes",
      "plantes",
      "fleurs",
      "tailler les arbres",
      "élaguer",
      "espaces verts",
      "potager",
      "nakɔ",
      "nakɔ baara",
      "nakɔtigi",
      "fie",
      "fie di",
    ],
  },
  {
    code: "gardien",
    libelle: "Gardien",
    libelleDioula: "Kɔlɔsilikɛla",
    libelleBaoule: "Sua nianfuɛ", // à valider avec un locuteur
    icone: "shield",
    synonymes: [
      "gardiens",
      "gardiennage",
      "vigile",
      "vigiles",
      "wachman",
      "watchman",
      "wachmen",
      "sécurité",
      "agent de sécurité",
      "surveillance",
      "surveiller",
      "surveiller la maison",
      "garder la maison",
      "garder la cour",
      "veilleur",
      "veilleur de nuit",
      "portier",
      "kɔlɔsili",
      "kɔlɔsibaga",
      "so kɔlɔsi",
      "gadiyɛn",
      "sua nian",
    ],
  },
  {
    code: "chauffeur",
    libelle: "Chauffeur",
    libelleDioula: "Sofɛri",
    libelleBaoule: "Sofɛlɛ", // à valider avec un locuteur
    icone: "car",
    synonymes: [
      "chauffeurs",
      "chauffeuse",
      "conducteur",
      "conductrice",
      "conduire",
      "conduite",
      "permis",
      "permis de conduire",
      "taxi",
      "taxis",
      "taximan",
      "gbaka",
      "wôrô-wôrô",
      "moto-taxi",
      "camionneur",
      "routier",
      "conduire la voiture",
      "mobili boli",
      "mobili bolila",
      "mobilibolila",
      "loto kan",
    ],
  },
  {
    code: "livreur",
    libelle: "Livreur",
    libelleDioula: "Ciden", // à valider avec un locuteur
    libelleBaoule: "Like fa kɔfuɛ", // à valider avec un locuteur
    icone: "bike",
    synonymes: [
      "livreurs",
      "livreuse",
      "livraison",
      "livraisons",
      "livrer",
      "faire des livraisons",
      "coursier",
      "coursiers",
      "moto-livreur",
      "livreur à moto",
      "moto livraison",
      "commissions",
      "faire les commissions",
      "commissionnaire",
      "porteur",
      "colis",
      "livrer des colis",
      "cidenya",
      "fɛn lasebaga",
      "livrɛri",
      "like fa kɔ",
    ],
  },
  {
    code: "soudeur",
    libelle: "Soudeur",
    libelleDioula: "Sudɛri", // à valider avec un locuteur
    libelleBaoule: "Blalɛ junman difuɛ", // à valider avec un locuteur
    icone: "flame",
    synonymes: [
      "soudeurs",
      "soudure",
      "souder",
      "soudure à l'arc",
      "ferronnier",
      "ferronnerie",
      "métallier",
      "métallerie",
      "fer forgé",
      "portail",
      "portails",
      "fabriquer des portails",
      "grille",
      "grilles",
      "chalumeau",
      "forgeron",
      "travail du fer",
      "sudɛli",
      "nɛgɛ baara",
      "nɛgɛ nɔrɔla",
      "numu",
      "blalɛ junman",
    ],
  },
  {
    code: "carreleur",
    libelle: "Carreleur",
    libelleDioula: "Karo dala", // à valider avec un locuteur
    libelleBaoule: "Kalo siefuɛ", // à valider avec un locuteur
    icone: "layout-grid",
    synonymes: [
      "carreleurs",
      "carrelage",
      "carreler",
      "carreau",
      "carreaux",
      "poser du carrelage",
      "poser les carreaux",
      "pose de carrelage",
      "faïence",
      "dallage",
      "sol carrelé",
      "chape",
      // Jamais « karo » seul : en dioula, kalo/karo = « mois » (« karo naani » = 4 mois).
      "karo da",
      "karolɛri",
      "kalo sie",
    ],
  },
  {
    code: "vitrier",
    libelle: "Vitrier",
    libelleDioula: "Witiriye", // à valider avec un locuteur
    libelleBaoule: "Vitiri junman difuɛ", // à valider avec un locuteur
    icone: "app-window",
    synonymes: [
      "vitriers",
      "vitrerie",
      "vitre",
      "vitres",
      "verre",
      "vitrage",
      "poser des vitres",
      "réparer les vitres",
      "vitre cassée",
      "fenêtre",
      "fenêtres",
      "miroir",
      "miroirs",
      "baie vitrée",
      "vitres en aluminium",
      "aluminium",
      "alu",
      "menuiserie aluminium",
      "menuiserie alu",
      "witiri",
      "vitiri",
      "gilasi",
      "witiri dala",
      "vitiri junman",
    ],
  },
  {
    code: "blanchisseur",
    libelle: "Blanchisseur",
    libelleDioula: "Finikola",
    libelleBaoule: "Tralɛ wunnzinfuɛ", // à valider avec un locuteur
    icone: "washing-machine",
    synonymes: [
      "blanchisseurs",
      "blanchisseuse",
      "blanchisserie",
      "lessive",
      "faire la lessive",
      "laver le linge",
      "laver les habits",
      "laver les vêtements",
      "linge",
      "pressing",
      "laverie",
      "nettoyage à sec",
      "fanico",
      "fanicos",
      "fini ko",
      "finiko",
      "fini kola",
      "fini kobaga",
      "tralɛ wunnzin",
    ],
  },
  {
    code: "cuisiniere",
    libelle: "Cuisinière",
    libelleDioula: "Tobilikɛla",
    libelleBaoule: "Aliɛ tɔnfuɛ", // à valider avec un locuteur
    icone: "chef-hat",
    synonymes: [
      "cuisinier",
      "cuisiniers",
      "cuisinières",
      "cuisine",
      "faire la cuisine",
      "cuisiner",
      "préparer à manger",
      "préparer les repas",
      "préparer la nourriture",
      "faire à manger",
      "chef cuisinier",
      "cuistot",
      "restauratrice",
      "restaurateur",
      "garba",
      "attiéké",
      "tobili",
      "tobi",
      "dumuni tobi",
      "dumuni tobila",
      "tobilikɛmuso",
      "aliɛ tɔn",
    ],
  },
  {
    code: "nounou",
    libelle: "Nounou",
    libelleDioula: "Denmarala", // à valider avec un locuteur
    libelleBaoule: "Ba nianfuɛ", // à valider avec un locuteur
    icone: "baby",
    synonymes: [
      "nounous",
      "nanny",
      "baby-sitter",
      "babysitter",
      "garde d'enfants",
      "garder les enfants",
      "garder les bébés",
      "garder le bébé",
      "garder mon enfant",
      "garder mes enfants",
      "garde les enfants",
      "garde des enfants",
      "surveiller les enfants",
      "occupe des enfants",
      "gardienne d'enfants",
      "s'occuper des enfants",
      "s'occuper du bébé",
      "s'occuper des bébés",
      "bébé",
      "bébés",
      "puéricultrice",
      "den mara",
      "den kɔlɔsi",
      "den kɔlɔsila",
      "den kɔlɔsibaga",
      "nunu",
      "ba nian",
    ],
  },
  {
    code: "repasseuse",
    libelle: "Repasseuse",
    libelleDioula: "Fini pasela", // à valider avec un locuteur
    libelleBaoule: "Tralɛ pasefuɛ", // à valider avec un locuteur
    icone: "shirt",
    synonymes: [
      "repasseur",
      "repasseuses",
      "repassage",
      "repasser",
      "repasse",
      "repasser les habits",
      "repasser le linge",
      "repasser les vêtements",
      "faire le repassage",
      "fer à repasser",
      "coup de fer",
      "fini pase",
      "finipase",
      "fini pasebaga",
      "pasekɛla",
      "tralɛ pase",
    ],
  },
  {
    code: "vendeur",
    libelle: "Vendeur",
    libelleDioula: "Feerekɛla",
    libelleBaoule: "Atɛ yofuɛ", // à valider avec un locuteur
    icone: "store",
    synonymes: [
      "vendeurs",
      "vendeuse",
      "vendeuses",
      "vente",
      "vendre",
      "vends",
      "je vends",
      "commerce",
      "commerçant",
      "commerçante",
      "commerçants",
      "commerçant ambulant",
      "boutiquier",
      "boutiquière",
      "boutique",
      "boutiques",
      "gérant de boutique",
      "gérante de boutique",
      "tablier",
      "tabliers",
      "kiosque",
      "gérant de kiosque",
      "caissier",
      "caissière",
      "vendre au marché",
      "étalagiste",
      "revendeur",
      "revendeuse",
      "feere",
      "feerekɛ",
      "feerekɛmuso",
      "sugu feere",
      "butiki",
      "butikitigi",
      "atɛ yo",
    ],
  },
  {
    code: "reparateur-telephone",
    libelle: "Réparateur de téléphones",
    libelleDioula: "Telefɔni dilanna", // à valider avec un locuteur
    libelleBaoule: "Telefɔnu siesiefuɛ", // à valider avec un locuteur
    icone: "smartphone",
    synonymes: [
      "réparateur téléphone",
      "réparateur de téléphone",
      "réparateur de portables",
      "réparateur de téléphones portables",
      "réparation téléphone",
      "réparation de téléphone",
      "réparation de téléphones",
      "réparer les téléphones",
      "répare les téléphones",
      "réparer les portables",
      "répare les portables",
      "réparer le téléphone",
      "dépanneur téléphone",
      "technicien téléphone",
      "technicien gsm",
      "iphone",
      "iphones",
      "smartphone",
      "smartphones",
      "android",
      "gsm",
      "écran cassé",
      "changer l'écran",
      "flasher",
      "déblocage",
      "débloquer les téléphones",
      "telefɔni dilan",
      "telefɔni dilanbaga",
      "telefɔni dilannikɛla",
      "telefɔnu siesie",
    ],
  },
  {
    code: "frigoriste",
    libelle: "Frigoriste",
    libelleDioula: "Firigo dilanna", // à valider avec un locuteur
    libelleBaoule: "Frigo siesiefuɛ", // à valider avec un locuteur
    icone: "snowflake",
    synonymes: [
      "frigoristes",
      "froid",
      "climatisation",
      "climatiseur",
      "climatiseurs",
      "clim",
      "clims",
      "split",
      "réparer la clim",
      "réparer le climatiseur",
      "installer la clim",
      "installation de clim",
      "frigo",
      "frigos",
      "réfrigérateur",
      "réfrigérateurs",
      "réparer le frigo",
      "réparer les frigos",
      "réparateur de frigo",
      "congélateur",
      "congélateurs",
      "chambre froide",
      "technicien froid",
      "technicien en froid",
      "froid et climatisation",
      "recharge de gaz",
      "firigo",
      "firigo dilan",
      "kilimatizɛri",
      "frigo siesie",
    ],
  },
  {
    code: "tapissier",
    libelle: "Tapissier",
    libelleDioula: "Tapisiye", // à valider avec un locuteur
    libelleBaoule: "Bia siesiefuɛ", // à valider avec un locuteur
    icone: "sofa",
    synonymes: [
      "tapissiers",
      "tapisserie",
      "tapisser",
      "tapisserie de meubles",
      "fauteuil",
      "fauteuils",
      "canapé",
      "canapés",
      // Jamais « salon » seul : en Côte d'Ivoire, c'est d'abord le salon de coiffure.
      "refaire les fauteuils",
      "refaire le salon",
      "recouvrir les fauteuils",
      "rembourrage",
      "rembourrer",
      "housse",
      "housses",
      "coussin",
      "coussins",
      "rideau",
      "rideaux",
      "matelas",
      "garnisseur",
      "sellier",
      "sigilan dilan",
      "sigilan dilanna",
      "fotɛyi",
      "salɔn dilan",
      "bia siesie",
    ],
  },
  {
    code: "autre",
    libelle: "Autre",
    libelleDioula: "Baara wɛrɛ",
    libelleBaoule: "Junman uflɛ",
    icone: "circle-help",
    synonymes: [],
  },
];

export const METIERS_PAR_CODE: Readonly<Record<MetierCode, Metier>> = Object.fromEntries(
  METIERS.map((metier) => [metier.code, metier]),
) as Record<MetierCode, Metier>;

export const NOMBRE_METIERS = METIERS.length;

export function estMetierCode(valeur: string): valeur is MetierCode {
  return (METIER_CODES as readonly string[]).includes(valeur);
}

/** Retrouve un métier par son code (`macon`) ou par son libellé (`Maçon`). */
export function trouverMetier(codeOuLibelle: string): Metier | undefined {
  const cle = normaliser(codeOuLibelle);
  return METIERS.find((m) => m.code === cle || normaliser(m.libelle) === cle);
}

/**
 * Cherche un métier mentionné dans un texte libre (transcription), via le
 * libellé, les libellés locaux et les synonymes, en deux paliers :
 *  1. un libellé cité (français, dioula ou baoulé) l'emporte toujours sur un
 *     synonyme (« je suis cuisinière, je fais aussi le ménage » → cuisinière) ;
 *  2. à palier égal, l'expression la plus longue gagne (« réparateur téléphone »
 *     avant « vendeur ») ; à longueur égale, le premier métier de METIERS.
 *
 * Limite connue (mock sans sémantique) : une demande sans libellé ni verbe qui
 * énumère des tâches (« quelqu'un pour le ménage et la cuisine ») est tranchée à
 * la longueur du mot (« cuisine » > « ménage »). Le LLM réel rattrape ce cas.
 */
export function chercherMetierParSynonyme(texte: string): Metier | undefined {
  let meilleur: { metier: Metier; palier: number; longueur: number } | undefined;
  for (const metier of METIERS) {
    if (metier.code === "autre") continue;
    const expressions: ReadonlyArray<readonly [string, number]> = [
      [metier.libelle, 1],
      [metier.libelleDioula, 1],
      [metier.libelleBaoule, 1],
      ...metier.synonymes.map((synonyme) => [synonyme, 0] as const),
    ];
    for (const [expression, palier] of expressions) {
      if (expression.length === 0) continue;
      if (contientExpression(texte, expression)) {
        const longueur = normaliser(expression).length;
        const meilleurPalier = !meilleur || palier > meilleur.palier;
        const plusLongue = meilleur !== undefined && palier === meilleur.palier && longueur > meilleur.longueur;
        if (meilleurPalier || plusLongue) meilleur = { metier, palier, longueur };
      }
    }
  }
  return meilleur?.metier;
}
