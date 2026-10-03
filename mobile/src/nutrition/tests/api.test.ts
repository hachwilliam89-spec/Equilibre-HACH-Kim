import { requestApi } from "../../plans/api";
import {
  addFoodEntry,
  removeFoodEntry,
  searchReferenceFoods,
} from "../api";

jest.mock("../../plans/api", () => ({ requestApi: jest.fn() }));

const food = {
  id: "food-1",
  nom: "Riz blanc cuit",
  caloriesKcalPour100g: 130,
  proteinesGPour100g: 2.7,
  glucidesGPour100g: 28,
  lipidesGPour100g: 0.3,
};

const journal = {
  planId: "plan-1",
  jourUtc: "2026-10-03",
  budgetCalorique: 1800,
  entrees: [{
    id: "entry-1", foodId: food.id, nom: food.nom,
    quantiteGrammes: 200, caloriesKcal: 260,
    proteinesG: 5.4, glucidesG: 56, lipidesG: 0.6,
    receivedAt: "2026-10-03T07:00:00.000Z",
  }],
  totalCaloriesKcal: 260,
  totalProteinesG: 5.4,
  totalGlucidesG: 56,
  totalLipidesG: 0.6,
};

beforeEach(() => jest.clearAllMocks());

it("encode la recherche et valide la bibliothèque en lecture seule", async () => {
  (requestApi as jest.Mock).mockResolvedValue([food]);
  await expect(searchReferenceFoods(" riz cuit ")).resolves.toEqual([food]);
  expect(requestApi).toHaveBeenCalledWith("/foods?q=riz%20cuit&size=20");
});

it("envoie l'aliment et la quantité puis lit le journal recalculé", async () => {
  (requestApi as jest.Mock).mockResolvedValue(journal);
  await expect(addFoodEntry(food.id, 200)).resolves.toEqual(journal);
  expect(requestApi).toHaveBeenCalledWith("/food-journals/me/entries", "POST", {
    foodId: food.id,
    quantiteGrammes: 200,
  });
});

it("retire une entrée par son identifiant et lit le total recalculé", async () => {
  const empty = { ...journal, entrees: [], totalCaloriesKcal: 0 };
  (requestApi as jest.Mock).mockResolvedValue(empty);
  await expect(removeFoodEntry("entry-1")).resolves.toEqual(empty);
  expect(requestApi).toHaveBeenCalledWith("/food-journals/me/entries/entry-1", "DELETE");
});

it("refuse une réponse de bibliothèque incomplète", async () => {
  (requestApi as jest.Mock).mockResolvedValue([{ id: food.id, nom: food.nom }]);
  await expect(searchReferenceFoods("riz")).rejects.toThrow();
});
