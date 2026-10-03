# US3 — Suivi de l’alimentation : validation

Cette recette couvre FR403-747 à FR403-756. Le modèle documentaire et les
règles de calcul sont détaillés dans [journal-alimentaire.md](journal-alimentaire.md).
La synchronisation hors ligne (FR403-767) et les alertes de dépassement
persistant (US5) sont des travaux distincts.

## Parcours livré

Un utilisateur connecté avec un plan actif ouvre « Mon journal alimentaire ».
Il voit le total et les macronutriments du jour UTC, la cible calorique du plan,
le statut et les entrées consommées. « Ajouter un aliment » permet de rechercher
dans la bibliothèque en lecture seule, parcourir les familles, rechercher un
aliment ou retrouver ses favoris, puis saisir sa quantité en grammes dans une
fenêtre dédiée et voir une estimation avant validation. Après ajout, il revient
à la liste pour pouvoir consigner un autre aliment. L’API fixe le jour UTC et
renvoie les valeurs enregistrées. Le retour au journal recharge le total.
L’utilisateur choisit le repas auquel appartient l’aliment : petit-déjeuner,
déjeuner, dîner ou collation. Le journal regroupe les entrées par repas et affiche
un sous-total informatif ; le budget et le statut restent ceux du jour entier.
Chaque entrée du jour peut être retirée après confirmation ; le total et le
statut sont alors recalculés.

| Fonction | Route API | Règle visible |
| --- | --- | --- |
| Recherche par nom | `GET /api/foods?q=...` | Liste vide explicite ; valeurs affichées pour 100 g |
| Parcours par famille | `GET /api/foods?categorie=...` | Bibliothèque visible dès l’ouverture ; pagination |
| Favoris | `GET/PUT/DELETE /api/foods/me/favorites...` | Sélection propre au compte utilisateur |
| Ajout | `POST /api/food-journals/me/entries` | Quantité > 0 et ≤ 10 000 g ; calories et macros proportionnelles |
| Retrait | `DELETE /api/food-journals/me/entries/{entryId}` | Confirmation ; entrée retirée du journal |
| Statut et total | `GET /api/food-journals/me/status` | Dépassement seulement au-delà de budget + 150 kcal |

Le statut du dernier journal non vide est calculé côté serveur. Sans entrée
aujourd’hui, le journal mobile affiche 0 kcal pour **aujourd’hui** ; il n’attribue
pas à tort le total d’hier à la journée courante. Après deux jours consécutifs
sans entrée, le statut est « Pas de données récentes ». Les macronutriments
restent informatifs.

## Couverture automatisée

| Cas d’acceptation | Vérification |
| --- | --- |
| Bibliothèque préremplie, lecture seule, recherche sans casse ni accents, résultat vide | `api/test/foods.integration-spec.ts`, `api/test/food-search.integration-spec.ts` |
| 200 g de riz : 260 kcal, 5,4 g de protéines, 56 g de glucides, 0,6 g de lipides | `api/test/food-entry.integration-spec.ts`, `mobile/src/nutrition/tests/presentation.test.ts` |
| Quantité nulle, négative, hors limite ou aliment inconnu | `api/test/food-entry.integration-spec.ts`, tests mobiles de la quantité |
| Ajout, total du jour et persistance documentaire, y compris en concurrence | `api/test/food-entry.integration-spec.ts`, `api/test/food-journals.integration-spec.ts` |
| Retrait et recalcul, propriété de l’entrée, dernière entrée, concurrence | `api/test/food-entry-removal.integration-spec.ts` |
| Borne +150 kcal incluse, dépassement au-delà, journée absente ou ancienne | `api/src/nutrition/domain/services/food-budget-status.spec.ts`, `api/test/food-budget-status.integration-spec.ts` |
| Parcours recherche → ajout → statut → retrait → statut vide | `api/test/us3-user-journey.integration-spec.ts` |
| Contrats et routes appelés par le mobile | `mobile/src/nutrition/tests/api.test.ts` |
| Classement par repas, budget quotidien inchangé, anciennes entrées « Non classé » | `api/test/food-entry.integration-spec.ts`, tests de présentation et de contrat mobiles |

Depuis la racine du dépôt, avec le MongoDB de test lancé par `pnpm docker:test` :

```bash
pnpm --dir api test --runInBand
pnpm --dir api test:e2e:local --runInBand
pnpm --dir mobile typecheck
pnpm --dir mobile lint
pnpm --dir mobile test
pnpm --dir mobile exec expo export --platform ios --platform android
```

Ces tests vérifient les règles et les contrats. L’export Expo valide le bundle,
mais ne remplace pas une recette visuelle sur appareil.

Vérification locale du 3 octobre 2026 : 137/137 tests unitaires API,
110/110 tests d’intégration API avec MongoDB, 67/67 tests mobiles, lint et
typecheck API/mobile et export iOS/Android réussis. La recette iPhone reste à
confirmer pour cette évolution après déploiement.

Complément « catégories de repas » : 137 tests unitaires API, 108 tests
d’intégration API et 61 tests mobiles réussis sur la branche dédiée, avec
build, lint et vérification des types. La recette visuelle reste à confirmer.

## Recette à effectuer sur iPhone

Utiliser un compte utilisateur ayant un plan actif et l’API de recette. Ne pas
utiliser le compte coach pour consigner les aliments.

1. Ouvrir le journal sans entrée du jour : 0 kcal aujourd’hui, aucune entrée
   affichée, et budget du plan présent.
2. Rechercher « riz » ; vérifier « Riz blanc cuit », 130 kcal pour 100 g.
   Rechercher un nom absent : message « Aucun aliment trouvé ».
3. Choisir le riz et saisir `200` g : aperçu de 260 kcal, 5,4 g de protéines,
   56 g de glucides et 0,6 g de lipides. Une quantité `0` ou négative ne doit
   pas pouvoir être envoyée. Choisir « Déjeuner » ; sans choix de repas, l’ajout
   doit être refusé avec un message clair.
4. Ajouter : retour au journal avec le riz sous « Déjeuner », sa quantité, ses
   valeurs, un sous-total de 260 kcal et un total journalier de 260 kcal.
   Revenir au suivi de poids et vérifier le même budget du jour.
5. Retirer le riz : annuler une première fois et vérifier qu’il reste, puis
   confirmer. Vérifier que la liste est vide et le total revenu à 0 kcal.
6. Rechercher et sélectionner un autre aliment ; couper le réseau avant
   l’ajout. Vérifier le message d’erreur et consulter le journal avant un nouvel
   essai, car une réponse réseau perdue ne prouve pas que l’API n’a rien reçu.
7. Avec un utilisateur sans plan actif, ouvrir le journal : message dédié et
   aucune action d’ajout. Avec un coach, l’écran utilisateur doit rester
   inaccessible.

Noter la date, l’environnement et le résultat de cette recette après son
exécution. Elle n’est pas considérée comme validée par les seuls tests locaux.
