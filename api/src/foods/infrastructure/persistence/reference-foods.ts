import { Food, type FoodCategory } from '../../domain/entities/food.entity';

/**
 * Référentiel illustratif, pas la base Ciqual complète. Valeurs pour 100 g
 * issues de Ciqual 2025 (Anses), sauf le riz du scénario d'acceptation US3.
 * Les UUID existants restent stables pour préserver les journaux déjà créés.
 */
// prettier-ignore
const REFERENCE_FOOD_INPUTS: ReadonlyArray<readonly [
  string, string, FoodCategory, number, number, number, number,
]> = [
  ['8ed1ecba-adbd-4cf7-a577-563fa30d7850', 'Riz blanc cuit', 'feculents', 130, 2.7, 28, 0.3],
  ['7291d093-c8f8-4d2f-b5dd-43e7bb15893b', 'Pâtes cuites', 'feculents', 167, 6.1, 31.4, 1.1],
  ['c84da1c8-e9a2-4e67-a43c-a47506e043b0', 'Pain complet', 'feculents', 234, 8.66, 41.2, 1.7],
  ['b913c135-c1f1-478d-9a75-fc81221b62ef', 'Lentilles cuites', 'legumineuses', 125, 10.1, 16.2, 0.57],
  ['272de129-2d7f-444a-a084-85b4efeb045d', 'Poulet grillé sans peau', 'viandes', 141, 30.1, 0, 2],
  ['ea86525e-b3e8-4819-a71b-f4d86d2b21b4', 'Saumon cuit', 'poissons', 205, 23.2, 0.61, 12.2],
  ['7f736119-2f7d-4232-ab22-c69aba918a2a', 'Thon au naturel égoutté', 'poissons', 143, 26.8, 0, 3.94],
  ['824c6981-f9a2-45af-a677-cc71070e47cb', 'Œuf dur', 'oeufs', 134, 13.5, 0.52, 8.62],
  ['33c95328-5831-45ad-9229-77db3260995b', 'Lait demi-écrémé', 'produits-laitiers', 47.5, 3.46, 4.97, 1.55],
  ['164ade6e-dc4a-4494-bf4c-3602c7c0dc0e', 'Banane crue', 'fruits', 87.6, 1.06, 19.7, 0.5],
  ['22980f75-dd2a-4a7a-a6fe-66363e8ce9e4', 'Pomme crue avec peau', 'fruits', 54, 0.25, 11.6, 0.25],
  ['90c6823f-282f-4d0c-8751-ab8bb575ab7b', 'Avocat cru', 'fruits', 203, 1.56, 0, 20.6],
  ['42801bda-bef8-4e6d-8493-f3eab9011784', 'Carotte crue', 'legumes', 30.2, 0.78, 5.16, 0.5],
  ['fe7c7b9d-8c28-42cd-9924-1343024b1329', 'Brocoli cuit vapeur', 'legumes', 38, 4.13, 2.53, 0.7],
  ['901d9eaf-4ce3-421e-a9dc-46a4e0ad2aae', 'Amandes nature', 'autres', 615, 18.8, 9.51, 51.3],
  ['7bb81b3a-655c-4c69-ac54-5ee7962fe4be', "Huile d'olive vierge extra", 'autres', 899, 0.25, 0, 99.9],
  // Codes Ciqual 2025 : 19646, 19593, 19860, 12118.
  ['92ce32ba-9009-4987-a9d2-d08d756f12e5', 'Fromage blanc nature (2-3 % MG)', 'produits-laitiers', 75.7, 7.28, 3.86, 3.23],
  ['ba964ff6-05ca-454d-9134-7fe8b782e760', 'Yaourt nature', 'produits-laitiers', 50.1, 3.83, 4.26, 1.68],
  ['c3d5f53c-ca37-4f01-9cbb-c446b0717821', 'Yaourt grec nature', 'produits-laitiers', 103, 3.02, 3.73, 8.16],
  ['d809dde8-5082-43ae-a3e4-5fbaec1e2ef5', 'Emmental râpé', 'produits-laitiers', 368, 27.6, 0.58, 28.2],
  // Codes : 6251, 36306, 26065, 26231.
  ['9290e847-6051-4ac1-9aca-173a4099c906', 'Steak haché 5 % MG cuit', 'viandes', 155, 25.5, 0, 5.85],
  ['ac5d8659-9762-4d14-bbee-07047b7ecde0', 'Escalope de dinde grillée', 'viandes', 124, 28.5, 0, 1.09],
  ['ef8dbd45-fdf3-4fe6-999c-7b48b55859fe', 'Sardine crue', 'poissons', 160, 19.5, 0, 9.17],
  ['182a89ef-5ee3-447b-9eb4-6eca159014bd', 'Filets de sardines à l’huile d’olive égouttés', 'poissons', 202, 23.2, 1.16, 11.6],
  // Codes : 20019, 20020, 20021, 13037, 13021.
  ['578eddc3-a71f-41c7-9415-c00f334339e6', 'Concombre cru avec peau', 'legumes', 16.8, 0.65, 2.87, 0.11],
  ['a7b903eb-f1cb-4534-8ecf-e59a1293fa08', 'Courgette crue avec peau', 'legumes', 16.7, 1.21, 1.75, 0.32],
  ['2d511d63-754b-4a89-bb1d-d0cf7b4ab68b', 'Courgette cuite', 'legumes', 15.5, 0.93, 1.4, 0.36],
  ['0112f9dc-0b3a-4981-818b-70613b5a05ed', 'Poire crue avec peau', 'fruits', 56.6, 0.36, 12.3, 0.27],
  ['9e4c0eb1-ff71-491f-978b-01d4257089b2', 'Kiwi cru', 'fruits', 60.9, 0.88, 11, 0.6],
  // Codes : 32140, 4048, 7200, 7111, 31074.
  ['15e63ff4-316a-4361-8972-c6953c20c4fd', 'Flocons d’avoine', 'feculents', 369, 10.6, 57.7, 7.82],
  ['9561c8c0-fba7-4555-86b5-46d617374f37', 'Pomme de terre cuite', 'feculents', 94.9, 2.05, 17.2, 1.58],
  ['cf49a46d-75c6-41f1-831a-d62ce35a42f1', 'Pain de mie blanc', 'feculents', 279, 7.06, 50.4, 4.37],
  ['c87afad6-bd78-4f2b-88a8-110db0b7da33', 'Pain de mie complet', 'feculents', 257, 7.3, 41.8, 4.1],
  ['ab284c16-4704-48d2-9b28-ddf9b6cd56ff', 'Chocolat noir 70 %', 'autres', 591, 10.4, 26.9, 46.3],
  // Ciqual 2025 : 20056, 20016, 20030, 20034, 19999, 20027, 20031.
  ['c18793a7-8874-4b37-9411-75c1e0dfbef0', 'Champignon de Paris cru', 'legumes', 21, 2.11, 1.83, 0.36],
  ['1352cafd-3957-4bb0-a33b-2b788075bef2', 'Chou-fleur cru', 'legumes', 24.9, 1.81, 2.13, 0.7],
  ['77849d81-257d-4e40-979d-97f8d9b28489', 'Haricots verts cuits', 'legumes', 29.4, 2, 3, 0.17],
  ['bfc2a375-2a60-40d8-ae2e-730f31ff0df9', 'Oignon cru', 'legumes', 39, 1.1, 6.25, 0.62],
  ['009d7557-36cc-47ee-be2f-77abcc3e4ff3', 'Poivron cuit', 'legumes', 33, 1.11, 5.42, 0.33],
  ['7488805f-950f-4d08-b99d-13286fb45c8b', 'Épinards cuits', 'legumes', 19.6, 3.2, 0.25, 0.14],
  ['d8114f98-d8d0-4f52-8f19-eb68305d3f05', 'Laitue crue', 'legumes', 14.7, 1.35, 1.22, 0.2],
  // 13043, 13395, 28900, 28203, 19016, 19590.
  ['628a103b-345e-48d4-9c6a-b8ae09126a1d', 'Pêche crue avec peau', 'fruits', 37.9, 0.91, 7.55, 0.25],
  ['607e0be5-d687-4086-ba0e-4547a11da297', 'Raisin cru', 'fruits', 71, 0.7, 16.3, 0.25],
  ['9e094897-0bf8-45f0-b0db-22a5a2d9f4f9', 'Jambon cuit supérieur', 'viandes', 113, 21, 0.76, 2.83],
  ['b4e38aec-79bf-41db-abfd-db934f1736a2', 'Filet mignon de porc cuit', 'viandes', 168, 26.1, 0, 7.1],
  ['aee2398e-8356-46f8-8321-58d77fb14794', 'Lait entier', 'produits-laitiers', 63.9, 3.42, 4.78, 3.49],
  ['ba4b5655-82ba-45d6-afe9-bf6adf706c64', 'Mozzarella au lait de vache', 'produits-laitiers', 227, 16.5, 0.7, 17.7],
  // 20507, 20503, 9341, 20066, 16400, 31008, 22008.
  ['d7bb6bd4-d806-408f-a3d3-1fdc01051e54', 'Pois chiches cuits', 'legumineuses', 148, 8.31, 17.7, 3],
  ['69051799-2373-48a6-aa12-04da2fdb36cc', 'Haricots rouges cuits', 'legumineuses', 116, 9.63, 12.3, 0.6],
  ['e1e58008-1356-4b48-a15d-b48e2a4b52bc', 'Quinoa cuit', 'feculents', 149, 4.66, 27.9, 1.1],
  ['26975e99-7988-4944-9785-6dfeffe4ddda', 'Maïs doux en conserve égoutté', 'feculents', 105, 2.66, 18.3, 1.68],
  ['c3cda394-efdf-4564-a03b-72c6619f0f72', 'Beurre doux', 'autres', 753, 0.64, 0.71, 83],
  ['f487b42d-9720-4dc7-ab91-a62b00466683', 'Miel', 'autres', 331, 0.65, 82.1, 0],
  ['ee05dcc5-41e7-4464-8980-ad5966a234af', 'Blanc d’œuf cuit', 'oeufs', 47.3, 10.3, 1.12, 0.17],
  // Ajouts : aliments courants et adaptes au reequilibrage alimentaire.
  ['4e2c2490-6f14-4794-80dc-9a02dd9ea4db', 'Jaune d’œuf cuit', 'oeufs', 322, 15.9, 0.3, 28.6],
  ['d4a311ad-b428-4099-9188-5486f7363497', 'Œuf au plat', 'oeufs', 196, 13.6, 0.8, 15.3],
  ['8d1c42ab-cc56-4001-beaf-a20bcac177ab', 'Œufs brouillés', 'oeufs', 166, 11, 1.3, 13],
  ['00b0379f-e364-4dff-942e-3e47bda3dd12', 'Omelette nature cuite', 'oeufs', 154, 11, 0.7, 11.8],
  ['d53f7bc5-ee83-47ad-bac2-7cb1a79b8785', 'Riz complet cuit', 'feculents', 143, 2.8, 29, 0.9],
  ['11c59891-0f82-4ef9-9ebb-d5129120baf7', 'Patate douce cuite', 'feculents', 90, 1.5, 20, 0.15],
  ['b7891459-5d7f-492a-b2f4-eebe04bdba87', 'Semoule de couscous cuite', 'feculents', 112, 3.8, 23.3, 0.2],
  ['50348931-f909-4c10-970e-d6db35c6b0d2', 'Baguette', 'feculents', 270, 8.5, 55, 1.3],
  ['55e8930a-307f-4cea-869c-a5358fcaa46d', 'Haricots blancs cuits', 'legumineuses', 128, 8, 17, 0.5],
  ['717ee7c4-f0ff-45fe-8231-d413e722c2a3', 'Tofu nature', 'legumineuses', 120, 12, 2, 7],
  ['b41d50e3-150d-482b-b934-c732369bd5f9', 'Cabillaud cuit', 'poissons', 83, 19, 0, 0.7],
  ['e0955393-c641-4cb6-a40b-8662f5c48e39', 'Crevettes cuites', 'poissons', 99, 22.8, 0.2, 1.2],
  ['4e96ed51-869d-4a01-b1a8-a1cadf7a1017', 'Tomate crue', 'legumes', 18, 0.8, 2.9, 0.3],
  ['2b49a73c-43d7-4e14-89ef-b9075ddb8037', 'Aubergine cuite', 'legumes', 32, 0.9, 5, 0.2],
  ['c5bb2a7a-4639-481c-b346-c7792e3e542e', 'Petits pois cuits', 'legumes', 80, 5.4, 10, 0.4],
  ['64809d13-0635-4d56-af88-1068d480bc6d', 'Betterave rouge cuite', 'legumes', 42, 1.8, 7.5, 0.1],
  ['c6fe7c32-d185-478d-b603-ea83ea9d6fbe', 'Orange crue', 'fruits', 45, 1, 8.3, 0.3],
  ['7553c545-7832-44d8-a411-ca739b9e5d3d', 'Fraise crue', 'fruits', 33, 0.67, 5.5, 0.3],
  ['87d04920-0882-434f-bb26-91e167d1433a', 'Clémentine crue', 'fruits', 48, 0.8, 10, 0.2],
  ['efd2174f-fa83-410e-9f08-ad7758ef3b58', 'Ananas frais', 'fruits', 53, 0.5, 11.5, 0.2],
  ['c99d82a4-10d8-4a6f-8d12-858f08062a0d', 'Myrtilles crues', 'fruits', 57, 0.7, 12, 0.3],
  ['9c3cf694-7106-4f51-8780-c82350209c66', 'Skyr nature', 'produits-laitiers', 63, 11, 4, 0.2],
  ['0f5edfc2-506b-44c4-9e50-bd990f1e4d57', 'Comté', 'produits-laitiers', 417, 28, 1.5, 34],
  ['31cbcbc6-1699-4bb8-b405-c1ea3fd5d350', 'Camembert', 'produits-laitiers', 265, 19.8, 0.5, 21],
  ['69d981c0-fd37-40ae-85a4-7ade0a3ca396', 'Beurre de cacahuète', 'autres', 588, 25, 20, 50],
  ['f2e5a096-edbd-474e-9d49-dd29492a6af1', 'Noix (cerneaux)', 'autres', 654, 15, 11, 65],
];

export const REFERENCE_FOODS = REFERENCE_FOOD_INPUTS.map(
  ([id, nom, categorie, calories, proteines, glucides, lipides]) =>
    Food.create({
      id,
      nom,
      categorie,
      caloriesKcalPour100g: calories,
      proteinesGPour100g: proteines,
      glucidesGPour100g: glucides,
      lipidesGPour100g: lipides,
    }).toProps(),
);
