# Bibliothèque d'aliments

La collection MongoDB `aliments` contient le référentiel global en lecture
seule de l'US3. Les utilisateurs peuvent rechercher ces aliments mais ne
peuvent ni en créer, ni en modifier, ni en supprimer.

Chaque document utilise un UUID applicatif stable et contient :

- le nom affiché et sa forme normalisée pour la recherche sans casse ni accent ;
- les calories en kcal pour 100 g ;
- les protéines, glucides et lipides en grammes pour 100 g.

Un index unique sur `nomNormalise` empêche les doublons et prépare la recherche
par nom. Au démarrage de l'API, un seed fait des mises à jour avec `upsert` sur
des identifiants fixes. Le relancer corrige le référentiel sans créer de
doublon.

## Provenance des données

Le MVP embarque un sous-ensemble court d'aliments courants, et non l'ensemble
des 3 484 références disponibles. Les valeurs proviennent de :

> Anses. 2025. Table de composition nutritionnelle des aliments Ciqual 2025.
> https://doi.org/10.57745/RDMHWY

Ce jeu de données est diffusé sous Licence Ouverte Etalab 2.0. La référence
« Riz blanc cuit » reprend volontairement les valeurs fixées par le scénario
d'acceptation de l'US3 : 130 kcal, 2,7 g de protéines, 28 g de glucides et
0,3 g de lipides pour 100 g.
