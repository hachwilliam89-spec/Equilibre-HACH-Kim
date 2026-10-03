import { categoryIconKind, foodIconKind } from "../food-icon-kind";

describe("foodIconKind (présentation)", () => {
  it("associe chaque aliment à son propre pictogramme", () => {
    expect(foodIconKind("Yaourt nature")).toBe("yogurt");
    expect(foodIconKind("Pain complet")).toBe("bread");
    expect(foodIconKind("Banane crue")).toBe("banana");
    expect(foodIconKind("Pomme crue avec peau")).toBe("apple");
    expect(foodIconKind("Saumon cuit")).toBe("salmon");
    expect(foodIconKind("Poulet grillé sans peau")).toBe("chicken");
    expect(foodIconKind("Tomate crue")).toBe("tomato");
    expect(foodIconKind("Raisin cru")).toBe("grape");
    expect(foodIconKind("Skyr nature")).toBe("skyr");
    expect(foodIconKind("Mozzarella au lait de vache")).toBe("mozzarella");
  });

  it("distingue les formes d'œuf", () => {
    expect(foodIconKind("Œuf dur")).toBe("egg");
    expect(foodIconKind("Blanc d’œuf cuit")).toBe("eggWhite");
    expect(foodIconKind("Jaune d’œuf cuit")).toBe("eggYolk");
    expect(foodIconKind("Œuf au plat")).toBe("eggFried");
    expect(foodIconKind("Œufs brouillés")).toBe("eggScrambled");
    expect(foodIconKind("Omelette nature cuite")).toBe("omelette");
  });

  it("gère les pièges de préfixe et les corps gras", () => {
    expect(foodIconKind("Pomme de terre cuite")).toBe("potato");
    expect(foodIconKind("Pain de mie blanc")).toBe("breadSlice");
    expect(foodIconKind("Riz complet cuit")).toBe("riceBrown");
    expect(foodIconKind("Beurre de cacahuète")).toBe("peanutButter");
    expect(foodIconKind("Beurre doux")).toBe("butter");
    expect(foodIconKind("Filets de sardines à l’huile d’olive égouttés")).toBe("sardine");
    expect(foodIconKind("Huile d'olive vierge extra")).toBe("oil");
  });

  it("ignore accents, casse et ligatures", () => {
    expect(foodIconKind("CAROTTE râpée")).toBe("carrot");
    expect(foodIconKind("ŒUF")).toBe("egg");
  });

  it("retombe sur la catégorie quand le nom n'est pas reconnu", () => {
    expect(foodIconKind("Aliment inconnu", "viandes")).toBe("meat");
    expect(foodIconKind("Aliment inconnu", "legumes")).toBe("leaf");
    expect(foodIconKind("Aliment inconnu", "feculents")).toBe("bowl");
    expect(foodIconKind("Aliment inconnu")).toBe("bowl");
  });

  it("donne une icône à chaque famille", () => {
    expect(categoryIconKind.fruits).toBe("apple");
    expect(categoryIconKind["produits-laitiers"]).toBe("milk");
    expect(Object.keys(categoryIconKind)).toHaveLength(9);
  });
});
