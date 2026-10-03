# Bibliothèque d'aliments

La collection MongoDB `aliments` contient le référentiel global en lecture
seule de l'US3. Les utilisateurs peuvent rechercher ces aliments mais ne
peuvent ni en créer, ni en modifier, ni en supprimer.

Chaque document utilise un UUID applicatif stable et contient :

- le nom affiché, sa forme normalisée et sa famille alimentaire ;
- les calories en kcal pour 100 g ;
- les protéines, glucides et lipides en grammes pour 100 g.

Un index unique sur `nomNormalise` empêche les doublons ; un index
`categorie, nomNormalise` facilite le parcours par famille. Au démarrage de
l'API, un seed fait des mises à jour avec `upsert` sur
des identifiants fixes. Le relancer corrige le référentiel sans créer de
doublon.

## Recherche dans l'API

`GET /api/foods` est accessible à un coach ou un utilisateur connecté, même
sans plan actif. Le paramètre facultatif `q` cherche une partie du nom sans
tenir compte de la casse ni des accents (par exemple `pates` retrouve
« Pâtes cuites » et `oeuf` retrouve « Œuf dur »). Le paramètre facultatif
`categorie` filtre parmi les familles (féculents, légumineuses, viandes,
poissons, œufs, légumes, fruits, produits laitiers et autres). Sans `q`, les
aliments restent consultables par pages. Les caractères spéciaux sont cherchés
littéralement.

Les résultats sont triés par nom normalisé puis par identifiant, et paginés
avec `page` (défaut 1) et `size` (défaut 20, maximum 50). La réponse est un
tableau d'aliments avec leurs valeurs pour 100 g ; une recherche sans résultat
renvoie `200` et un tableau vide. Les paramètres invalides renvoient `400`.
La bibliothèque est en lecture seule : les valeurs pour la quantité consommée
sont calculées lors de l'ajout d'une entrée au journal. L'écran mobile montre
les aliments dès l'ouverture, permet de parcourir les familles et d'ouvrir une
fenêtre de saisie de quantité. Après ajout, la fenêtre se ferme et la liste
reste affichée pour consigner un autre aliment.

## Favoris

Un utilisateur peut marquer ou retirer un aliment de référence en favori.
`GET /api/foods/me/favorites` retourne ses favoris ;
`PUT /api/foods/me/favorites/{foodId}` et
`DELETE /api/foods/me/favorites/{foodId}` les modifient de façon idempotente.
Les identifiants favoris sont imbriqués dans le document `users` du compte ;
MongoDB applique `$addToSet` et `$pull` atomiquement, sans collection de
liaison ni modification du référentiel commun. Les favoris sont accessibles
sur les autres appareils avec le même compte. Seul le rôle utilisateur peut
utiliser ces routes.

## Provenance des données

Le MVP embarque 54 aliments courants répartis en neuf familles, et non
l'ensemble de la base Ciqual. Cela rend le parcours utile tout en gardant le
référentiel contrôlé en lecture seule. Les valeurs proviennent de :

> Anses. 2025. Table de composition nutritionnelle des aliments Ciqual 2025.
> https://doi.org/10.57745/RDMHWY

Ce jeu de données est diffusé sous Licence Ouverte Etalab 2.0. La référence
« Riz blanc cuit » reprend volontairement les valeurs fixées par le scénario
d'acceptation de l'US3 : 130 kcal, 2,7 g de protéines, 28 g de glucides et
0,3 g de lipides pour 100 g.
