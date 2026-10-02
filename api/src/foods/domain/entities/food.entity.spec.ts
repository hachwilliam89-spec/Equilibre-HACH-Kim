import { Food, normalizeFoodName } from './food.entity';

const validFood = {
  id: '8ed1ecba-adbd-4cf7-a577-563fa30d7850',
  nom: 'Riz blanc cuit',
  caloriesKcalPour100g: 130,
  proteinesGPour100g: 2.7,
  glucidesGPour100g: 28,
  lipidesGPour100g: 0.3,
};

describe('Food', () => {
  it('normalise le nom pour une recherche sans casse ni accent', () => {
    expect(normalizeFoodName('  Pâtes   fraîches  ')).toBe('pates fraiches');
  });

  it('cree un aliment de reference valide', () => {
    expect(Food.create(validFood).toProps()).toEqual({
      ...validFood,
      nomNormalise: 'riz blanc cuit',
    });
  });

  it.each([
    ['caloriesKcalPour100g', -1],
    ['caloriesKcalPour100g', 1001],
    ['proteinesGPour100g', 101],
    ['glucidesGPour100g', Number.NaN],
    ['lipidesGPour100g', -0.1],
  ] as const)(
    'refuse une valeur nutritionnelle invalide pour %s',
    (field, value) => {
      expect(() => Food.create({ ...validFood, [field]: value })).toThrow();
    },
  );
});
