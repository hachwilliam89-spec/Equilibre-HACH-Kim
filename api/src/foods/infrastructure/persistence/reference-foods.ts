import { Food } from '../../domain/entities/food.entity';

/**
 * Sous-ensemble volontairement court pour le MVP.
 *
 * Les valeurs proviennent de la Table de composition nutritionnelle des
 * aliments Ciqual 2025 de l'Anses (licence ouverte Etalab 2.0), sauf le riz
 * blanc cuit dont les valeurs sont celles du scenario d'acceptation de l'US3.
 * Les identifiants sont fixes afin que le seed reste idempotent et que les
 * references stockees dans les journaux demeurent stables.
 */
const REFERENCE_FOOD_INPUTS = [
  ['8ed1ecba-adbd-4cf7-a577-563fa30d7850', 'Riz blanc cuit', 130, 2.7, 28, 0.3],
  ['7291d093-c8f8-4d2f-b5dd-43e7bb15893b', 'Pâtes cuites', 167, 6.1, 31.4, 1.1],
  [
    'c84da1c8-e9a2-4e67-a43c-a47506e043b0',
    'Pain complet',
    234,
    8.66,
    41.2,
    1.7,
  ],
  [
    'b913c135-c1f1-478d-9a75-fc81221b62ef',
    'Lentilles cuites',
    125,
    10.1,
    16.2,
    0.57,
  ],
  [
    '272de129-2d7f-444a-a084-85b4efeb045d',
    'Poulet grillé sans peau',
    141,
    30.1,
    0,
    2,
  ],
  [
    'ea86525e-b3e8-4819-a71b-f4d86d2b21b4',
    'Saumon cuit',
    205,
    23.2,
    0.61,
    12.2,
  ],
  [
    '7f736119-2f7d-4232-ab22-c69aba918a2a',
    'Thon au naturel égoutté',
    143,
    26.8,
    0,
    3.94,
  ],
  ['824c6981-f9a2-45af-a677-cc71070e47cb', 'Œuf dur', 134, 13.5, 0.52, 8.62],
  [
    '33c95328-5831-45ad-9229-77db3260995b',
    'Lait demi-écrémé',
    47.5,
    3.46,
    4.97,
    1.55,
  ],
  [
    '164ade6e-dc4a-4494-bf4c-3602c7c0dc0e',
    'Banane crue',
    87.6,
    1.06,
    19.7,
    0.5,
  ],
  [
    '22980f75-dd2a-4a7a-a6fe-66363e8ce9e4',
    'Pomme crue avec peau',
    54,
    0.25,
    11.6,
    0.25,
  ],
  ['90c6823f-282f-4d0c-8751-ab8bb575ab7b', 'Avocat cru', 203, 1.56, 0, 20.6],
  [
    '42801bda-bef8-4e6d-8493-f3eab9011784',
    'Carotte crue',
    30.2,
    0.78,
    5.16,
    0.5,
  ],
  [
    'fe7c7b9d-8c28-42cd-9924-1343024b1329',
    'Brocoli cuit vapeur',
    38,
    4.13,
    2.53,
    0.7,
  ],
  [
    '901d9eaf-4ce3-421e-a9dc-46a4e0ad2aae',
    'Amandes nature',
    615,
    18.8,
    9.51,
    51.3,
  ],
  [
    '7bb81b3a-655c-4c69-ac54-5ee7962fe4be',
    "Huile d'olive vierge extra",
    899,
    0.25,
    0,
    99.9,
  ],
] as const;

export const REFERENCE_FOODS = REFERENCE_FOOD_INPUTS.map(
  ([id, nom, calories, proteines, glucides, lipides]) =>
    Food.create({
      id,
      nom,
      caloriesKcalPour100g: calories,
      proteinesGPour100g: proteines,
      glucidesGPour100g: glucides,
      lipidesGPour100g: lipides,
    }).toProps(),
);
