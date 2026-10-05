import * as SecureStore from "expo-secure-store";
import type { ReferenceFood } from "./api";

const KEY = "equilibre.recentFoods.v1";
const MAX = 8;

/**
 * Derniers aliments ajoutés au journal, persistés localement pour un ré-ajout
 * rapide. On ne stocke que les champs nécessaires à l'affichage et au ré-ajout
 * (aucune donnée sensible). Le stockage est best-effort : s'il est indisponible,
 * la liste reste en mémoire pour la session.
 */
type RecentFood = Pick<
  ReferenceFood,
  | "id"
  | "nom"
  | "categorie"
  | "caloriesKcalPour100g"
  | "proteinesGPour100g"
  | "glucidesGPour100g"
  | "lipidesGPour100g"
>;

export async function getRecentFoods(): Promise<ReferenceFood[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFood[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function pushRecentFood(food: ReferenceFood): Promise<ReferenceFood[]> {
  const entry: RecentFood = {
    id: food.id,
    nom: food.nom,
    categorie: food.categorie,
    caloriesKcalPour100g: food.caloriesKcalPour100g,
    proteinesGPour100g: food.proteinesGPour100g,
    glucidesGPour100g: food.glucidesGPour100g,
    lipidesGPour100g: food.lipidesGPour100g,
  };
  const current = await getRecentFoods();
  const next = [entry, ...current.filter((item) => item.id !== food.id)].slice(0, MAX);
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : on retourne la liste à jour pour la session.
  }
  return next;
}
