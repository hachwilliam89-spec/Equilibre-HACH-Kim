import type { FoodCategory } from "./api";

export type FoodIconKind =
  // Féculents
  | "riceWhite" | "riceBrown" | "pasta" | "bread" | "breadSlice" | "baguette"
  | "potato" | "sweetPotato" | "oats" | "corn" | "quinoa" | "couscous"
  // Légumineuses
  | "lentils" | "chickpeas" | "redBeans" | "whiteBeans" | "tofu"
  // Viandes
  | "chicken" | "beefPatty" | "turkeyCutlet" | "ham" | "porkFillet"
  // Poissons
  | "salmon" | "tuna" | "sardine" | "shrimp" | "cabillaud"
  // Œufs
  | "egg" | "eggWhite" | "eggYolk" | "eggFried" | "eggScrambled" | "omelette"
  // Légumes
  | "carrot" | "broccoli" | "mushroom" | "cauliflower" | "cucumber" | "zucchini"
  | "greenBeans" | "lettuce" | "onion" | "bellPepper" | "spinach" | "tomato"
  | "eggplant" | "peas" | "beet"
  // Fruits
  | "apple" | "banana" | "avocado" | "pear" | "kiwi" | "peach" | "grape"
  | "orange" | "strawberry" | "clementine" | "pineapple" | "blueberries"
  // Produits laitiers
  | "milk" | "yogurt" | "fromageBlanc" | "skyr" | "cheeseWedge" | "cheeseBlock"
  | "mozzarella" | "camembert"
  // Autres
  | "almond" | "butter" | "chocolate" | "honey" | "oil" | "peanutButter" | "walnut"
  // Génériques (chips de famille, aliments futurs non reconnus)
  | "bowl" | "leaf" | "fruit" | "meat" | "fish";

const normalize = (name: string) => name.normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("fr-FR")
  .replace(/œ/g, "oe")
  .replace(/\s+/g, " ")
  .trim();

/**
 * Chaque aliment du référentiel pointe vers son propre pictogramme. Les règles
 * sont ordonnées du plus spécifique au plus générique (ex. « beurre de
 * cacahuète » avant « beurre », « pomme de terre » avant « pomme »).
 * Présentation uniquement : les noms et les calculs restent ceux de l'API.
 */
const RULES: readonly (readonly [RegExp, FoodIconKind])[] = [
  // Autres (pièges de préfixe en premier)
  [/beurre de cacahuete/, "peanutButter"],
  [/beurre/, "butter"],
  [/amande/, "almond"],
  [/\bnoix\b|noisette|cerneau/, "walnut"],
  [/chocolat/, "chocolate"],
  [/miel/, "honey"],
  // Féculents
  [/pomme de terre/, "potato"],
  [/patate douce/, "sweetPotato"],
  [/pain de mie/, "breadSlice"],
  [/baguette/, "baguette"],
  [/\bpain\b/, "bread"],
  [/pates/, "pasta"],
  [/riz complet/, "riceBrown"],
  [/\briz\b/, "riceWhite"],
  [/semoule|couscous/, "couscous"],
  [/quinoa/, "quinoa"],
  [/flocons|avoine/, "oats"],
  [/\bmais\b/, "corn"],
  // Légumineuses
  [/lentille/, "lentils"],
  [/pois chiche/, "chickpeas"],
  [/haricots? rouges?/, "redBeans"],
  [/haricots? blancs?/, "whiteBeans"],
  [/haricots? verts?/, "greenBeans"],
  [/petits? pois/, "peas"],
  [/tofu/, "tofu"],
  // Viandes
  [/poulet/, "chicken"],
  [/steak|hache/, "beefPatty"],
  [/dinde/, "turkeyCutlet"],
  [/jambon/, "ham"],
  [/\bporc\b/, "porkFillet"],
  // Poissons
  [/saumon/, "salmon"],
  [/thon/, "tuna"],
  [/sardine/, "sardine"],
  [/crevette/, "shrimp"],
  [/cabillaud|colin|lieu|poisson/, "cabillaud"],
  // Œufs (formes avant l'œuf générique)
  [/jaune d.{0,2}oeuf/, "eggYolk"],
  [/blanc d.{0,2}oeuf/, "eggWhite"],
  [/oeuf au plat/, "eggFried"],
  [/oeufs? brouill/, "eggScrambled"],
  [/omelette/, "omelette"],
  [/oeuf/, "egg"],
  // Légumes
  [/carotte/, "carrot"],
  [/brocoli/, "broccoli"],
  [/champignon/, "mushroom"],
  [/chou[- ]?fleur|chou/, "cauliflower"],
  [/concombre/, "cucumber"],
  [/courgette/, "zucchini"],
  [/laitue|salade/, "lettuce"],
  [/oignon/, "onion"],
  [/poivron/, "bellPepper"],
  [/epinard/, "spinach"],
  [/tomate/, "tomato"],
  [/aubergine/, "eggplant"],
  [/betterave/, "beet"],
  // Fruits
  [/avocat/, "avocado"],
  [/banane/, "banana"],
  [/kiwi/, "kiwi"],
  [/poire/, "pear"],
  [/peche/, "peach"],
  [/raisin/, "grape"],
  [/orange/, "orange"],
  [/fraise/, "strawberry"],
  [/clementine|mandarine/, "clementine"],
  [/ananas/, "pineapple"],
  [/myrtille|fruits rouges/, "blueberries"],
  [/\bpomme\b/, "apple"],
  // Produits laitiers (fromages et pots avant « lait »)
  [/mozzarella/, "mozzarella"],
  [/emmental|gruyere|rape/, "cheeseWedge"],
  [/comte|cantal|beaufort/, "cheeseBlock"],
  [/camembert|brie|coulommiers/, "camembert"],
  [/skyr/, "skyr"],
  [/fromage blanc/, "fromageBlanc"],
  [/yaourt/, "yogurt"],
  [/^lait\b/, "milk"],
  // Autres (corps gras en dernier pour ne pas rafler « filets ... à l'huile »)
  [/huile/, "oil"],
];

const categoryFallback: Record<FoodCategory, FoodIconKind> = {
  feculents: "bowl",
  legumineuses: "bowl",
  viandes: "meat",
  poissons: "fish",
  oeufs: "egg",
  legumes: "leaf",
  fruits: "fruit",
  "produits-laitiers": "milk",
  autres: "bowl",
};

export function foodIconKind(name: string, category?: FoodCategory): FoodIconKind {
  const value = normalize(name);
  for (const [pattern, kind] of RULES) {
    if (pattern.test(value)) return kind;
  }
  return category ? categoryFallback[category] : "bowl";
}

/** Emblème générique affiché sur les puces de famille (pas un aliment précis). */
export const categoryIconKind: Record<FoodCategory, FoodIconKind> = {
  feculents: "bread",
  legumineuses: "chickpeas",
  viandes: "meat",
  poissons: "fish",
  oeufs: "egg",
  legumes: "carrot",
  fruits: "apple",
  "produits-laitiers": "milk",
  autres: "honey",
};
