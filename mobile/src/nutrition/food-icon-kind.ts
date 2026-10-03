import type { FoodCategory } from "./api";

export type FoodIconKind =
  | "bowl" | "bread" | "pasta" | "potato" | "meat" | "fish" | "egg"
  | "milk" | "yogurt" | "cheese" | "apple" | "banana" | "fruit"
  | "carrot" | "leaf" | "mushroom" | "nut" | "oil" | "chocolate" | "honey";

const normalize = (name: string) => name.normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr-FR")
  .replace(/œ/g, "oe");

/** Présentation uniquement : les noms et les calculs métier restent ceux de l'API. */
export function foodIconKind(name: string, category?: FoodCategory): FoodIconKind {
  const value = normalize(name);
  if (/yaourt|fromage blanc/.test(value)) return "yogurt";
  if (/emmental|mozzarella|fromage rape/.test(value)) return "cheese";
  if (/^lait\b/.test(value)) return "milk";
  if (/pates/.test(value)) return "pasta";
  if (/pain/.test(value)) return "bread";
  if (/pomme de terre/.test(value)) return "potato";
  if (/\bbanane/.test(value)) return "banana";
  if (/\bpomme\b/.test(value)) return "apple";
  if (/carotte/.test(value)) return "carrot";
  if (/champignon/.test(value)) return "mushroom";
  if (/sardine|saumon|thon|poisson|cabillaud/.test(value)) return "fish";
  if (/oeuf/.test(value)) return "egg";
  if (/poulet|dinde|steak|boeuf|jambon|porc/.test(value)) return "meat";
  if (/amande|noix|noisette/.test(value)) return "nut";
  if (/huile/.test(value)) return "oil";
  if (/chocolat/.test(value)) return "chocolate";
  if (/miel/.test(value)) return "honey";
  if (/poire|peche|raisin|kiwi|avocat|fraise|orange|mangue/.test(value)) return "fruit";
  if (/courgette|concombre|brocoli|oignon|poivron|epinard|laitue|chou|haricot vert/.test(value)) return "leaf";

  switch (category) {
    case "feculents": case "legumineuses": return "bowl";
    case "viandes": return "meat";
    case "poissons": return "fish";
    case "oeufs": return "egg";
    case "legumes": return "leaf";
    case "fruits": return "fruit";
    case "produits-laitiers": return "milk";
    default: return "bowl";
  }
}

export const categoryIconKind: Record<FoodCategory, FoodIconKind> = {
  feculents: "bread",
  legumineuses: "bowl",
  viandes: "meat",
  poissons: "fish",
  oeufs: "egg",
  legumes: "carrot",
  fruits: "apple",
  "produits-laitiers": "yogurt",
  autres: "nut",
};
