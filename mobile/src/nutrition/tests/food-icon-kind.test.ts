import { categoryIconKind, foodIconKind } from "../food-icon-kind";

describe("foodIconKind (présentation)", () => {
  it("associe un aliment à une icône par son nom", () => {
    expect(foodIconKind("Yaourt nature")).toBe("yogurt");
    expect(foodIconKind("Pain complet")).toBe("bread");
    expect(foodIconKind("Banane")).toBe("banana");
    expect(foodIconKind("Pomme")).toBe("apple");
    expect(foodIconKind("Filet de saumon")).toBe("fish");
    expect(foodIconKind("Oeuf dur")).toBe("egg");
    expect(foodIconKind("Blanc de poulet")).toBe("meat");
  });

  it("ignore accents, casse et ligatures", () => {
    expect(foodIconKind("Pâtes complètes")).toBe("pasta");
    expect(foodIconKind("ŒUF")).toBe("egg");
    expect(foodIconKind("CAROTTE râpée")).toBe("carrot");
  });

  it("retombe sur la catégorie quand le nom n'est pas reconnu", () => {
    expect(foodIconKind("Aliment inconnu", "viandes")).toBe("meat");
    expect(foodIconKind("Aliment inconnu", "legumes")).toBe("leaf");
    expect(foodIconKind("Aliment inconnu", "feculents")).toBe("bowl");
  });

  it("retombe sur bowl sans nom ni catégorie reconnus", () => {
    expect(foodIconKind("Aliment inconnu")).toBe("bowl");
  });

  it("donne une icône à chaque famille", () => {
    expect(categoryIconKind.fruits).toBe("apple");
    expect(categoryIconKind["produits-laitiers"]).toBe("yogurt");
    expect(Object.keys(categoryIconKind)).toHaveLength(9);
  });
});
