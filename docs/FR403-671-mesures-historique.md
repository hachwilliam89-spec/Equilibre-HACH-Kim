# FR403-671 — Modèle de mesure et historique

Branche : `FR403-671-modele-mesure-historique`.

## Contrat livré

Chaque mesure contient `id`, `userId`, `planId`, `poidsKg` (nombre fini,
strictement positif), `receivedAt` (réception UTC), `jourUtc` (jour dérivé de
la réception), `source` (`automatique` ou `manuelle`) et `statut` (`valide`,
`suspecte` ou `hors-plan`). Les identifiants sont obligatoires. L'identifiant
MongoDB garantit l'unicité de la mesure. L'adaptateur ne propose ni mise à jour
ni suppression : les corrections ultérieures sont des mesures distinctes.

`GET /api/measurements/me` retourne un tableau, vide en l'absence de mesure.
L'utilisateur est déterminé par le JWT, sans identifiant cible dans la requête.
La réponse contient toutes ses mesures, y compris celles d'anciens plans,
toutes sources et tous statuts. Tri par réception décroissante, puis identifiant
décroissant en cas d'égalité. Aucun filtre sur le plan actif ou sur la validité.
Les mesures suspectes/hors-plan restent visibles dans l'historique.

Réponses : 200 avec le tableau, 401 sans JWT valide, 403 pour le rôle coach.
Le contrat de réponse est décrit dans Swagger.

```json
[
  {
    "id": "identifiant-mesure",
    "userId": "identifiant-utilisateur",
    "planId": "identifiant-plan",
    "poidsKg": 72.5,
    "receivedAt": "2026-09-24T10:00:00.000Z",
    "jourUtc": "2026-09-24",
    "source": "automatique",
    "statut": "valide"
  }
]
```

## Persistance et suite de l'US2

Collection `measurements`, index de lecture `(userId, receivedAt, _id)` et
index unique partiel `(userId, jourUtc)` pour le statut `valide`, initialisé
avant que le module serve les requêtes. Deux insertions valides simultanées
ne peuvent pas créer deux valeurs retenues ; un doublon devient un conflit 409.

Ce ticket n'expose pas de route d'écriture. Les futurs cas d'usage d'ingestion
doivent fournir l'heure serveur, vérifier l'existence et l'appartenance du plan
actif, appliquer la période et les contrôles métier, puis utiliser le repository.
Les références Mongoose ne sont pas des clés étrangères : ce modèle exige les
identifiants, mais ne vérifie pas seul l'existence du plan/utilisateur.
L'index empêche deux mesures **valides** le même jour ; il ne remplace pas le
contrôle applicatif refusant **toute** tentative après une mesure valide.
Ces contrôles et leurs tests HTTP seront ajoutés avec les routes d'écriture.

Ordre maintenu : 671 → 669/672/674 → 670 → 673 → 675 ; preuves et tests 676
au fil de l'eau. Les critères propres aux prochains tickets restent à recevoir.

## Preuves locales — 24 septembre 2026 (FR403-676)

- `pnpm --dir api test --runInBand` : 9 suites, 93 tests réussis,
  dont 17 tests du modèle de mesure.
- `pnpm --dir api lint` : réussi.
- `pnpm --dir api build` : réussi.
- `pnpm --dir api test:e2e:local --runInBand measurements.integration-spec.ts` :
  5 tests réussis avec MongoDB réel. L'exécution a nécessité l'accès hors sandbox
  au service MongoDB local et au serveur HTTP de test.

Les tests d'intégration vérifient les accès anonyme/JWT invalide/coach,
l'historique vide, tous les statuts et sources, les anciens plans, le tri,
l'isolation entre deux utilisateurs même avec un paramètre `userId` falsifié,
la concurrence automatique/manuelle au niveau repository, la conservation des
autres statuts et les contraintes de persistance.

Les fixtures sont supprimées uniquement pour les identifiants créés par la suite.
Ces résultats sont locaux ; ils ne constituent pas une exécution de la CI distante,
ni une recette mobile, ni un test de concurrence HTTP des futures routes d'écriture.

## Recette manuelle et circuit de livraison

Recette manuelle Swagger réalisée par Hach Kim le 24 septembre 2026 sur
`localhost:3000`, code API `4dcd6d26` :

- 12:31:21 UTC : sans authentification, réponse 401.
- 12:32:11 UTC : utilisateur authentifié sans mesure, réponse 200 avec `[]`.
- 12:33:20 UTC : coach authentifié, réponse 403.

Les réponses ont été fournies dans la conversation de vérification. Aucun jeton
ni mot de passe n'est conservé dans cette fiche. L'historique rempli, son tri et
l'isolation sont vérifiés automatiquement, pas par cette recette manuelle.

Circuit de livraison : MR de chaque ticket vers `FR403-US2-suivi-poids`, puis
MR US2 vers `develop`, puis MR `develop` vers `main`, avec commits de fusion
conservés sans squash. La création d'une MR ne vaut pas réussite de la CI.

## Prompt Rovo regroupé

> Mets à jour la documentation Confluence Équilibre pour l'US2 et FR403-671,
> avec une entrée de suivi FR403-676. FR403-671 est implémenté et vérifié localement
> sur la branche FR403-671-modele-mesure-historique : modèle avec identifiants de
> mesure/utilisateur/plan, poids numérique fini strictement positif, réception UTC,
> jour UTC dérivé, sources automatique/manuelle et statuts valide/suspecte/hors-plan.
> GET /api/measurements/me expose l'historique personnel complet, anciens plans
> inclus, par réception décroissante ; identité issue du JWT, réponses 200/401/403,
> contrat Swagger documenté. MongoDB garantit l'unicité des identifiants et d'une
> valeur valide par utilisateur/jour ; concurrence testée au niveau repository.
> Preuves : 93 tests unitaires, 5 tests d'intégration MongoDB, lint et build réussis
> le 24 septembre 2026. Ajoute la recette manuelle Swagger de Hach Kim sur l'API
> locale : sans authentification 401 à 12:31:21 UTC, utilisateur sans mesure
> 200 avec [] à 12:32:11 UTC, coach 403 à 12:33:20 UTC. Distingue ces trois
> contrôles manuels des scénarios automatisés ; ne copie aucun secret.
> Précise que les routes d'écriture et leurs contrôles métier,
> notamment plan actif et refus de toute tentative après une valeur valide,
> restent aux tickets suivants ; le test de concurrence HTTP reste à faire avec
> ces routes. Ne présente pas ces preuves comme une CI distante ou une recette
> mobile. Conserve l'ordre 671 → 669/672/674 → 670 → 673 → 675, avec 676 au fil
> de l'eau. L'US1 reste validée et le récapitulatif du plan actif appartient à 675.
> Ne modifie pas les critères d'acceptation ni le statut Jira des autres tickets.
