# Suivi de l’activité physique — US4 (FR403-963)

La montre connectée est simulée, comme la balance : elle transmet chaque jour un
total de pas. L’API en déduit un niveau d’activité, utilisé par le coach pour
calculer le budget calorique d’un nouveau plan. L’historique des pas est
informatif : aucun statut ni alerte n’y est associé.

## Règles

| Règle | Mise en œuvre |
| --- | --- |
| Un total par jour UTC | `POST /api/activity/steps` ; un nouvel envoi le même jour remplace la valeur (la montre envoie un total cumulé). |
| Bornes physiques | Entier de 0 à 50 000 ; au-delà, valeur négative ou décimale : HTTP 400, rien n’est enregistré. |
| Pas de plan requis | L’historique doit exister avant la création du plan ; le document `suivis` est créé au premier envoi si besoin. |
| Moyenne sur 7 jours | Les 7 jours UTC qui précèdent le calcul (la journée en cours, incomplète, est exclue). |
| Paliers | Sédentaire < 5 000 ; Actif 5 000 à 7 499 ; Sportif 7 500 à 9 999 ; Athlète ≥ 10 000. Bornes basses incluses. |
| Historique insuffisant | Moins de 7 jours renseignés : aucune déduction, le coach choisit le niveau. Sans choix : HTTP 400 `activity-level-required`. |
| Choix du coach | Un niveau fourni par le coach prévaut toujours sur la déduction. |
| Facteur figé | Le plan enregistre le niveau retenu ; de nouvelles mesures de pas ne modifient jamais un plan existant. |
| Conservation | Fenêtre glissante de trois mois, comme les mesures de poids. |

Exemple de l’US1 : calcul le 08/10/2026 avec 8 000, 8 200, 8 400, 8 100, 8 300,
7 900 et 8 500 pas du 01/10 au 07/10 : moyenne 8 200 pas/jour, niveau Sportif,
facteur 1,55.

## API

| Route | Accès | Réponse |
| --- | --- | --- |
| `POST /api/activity/steps` `{ nombrePas }` | utilisateur | 201 `{ jourUtc, nombrePas, recuLe }` · 400 · 401 · 403 · 409 conflit simultané |
| `GET /api/activity/me` | utilisateur | 200 `{ historique, moyenne7Jours: { debut, fin, joursRenseignes, moyennePas, niveau } }` |
| `POST /api/plans/preview`, `POST /api/plans` | coach | `niveauActivite` facultatif ; la proposition indique `niveauActiviteSource` (`pas` ou `coach`) et `moyennePas7Jours` |
| `GET /api/coach/clients/:userId` | coach rattaché | champ `activite` : moyenne des 7 jours et niveau déduit, même sans plan |

## Stockage

Champ `pasQuotidiens` du document `suivis` : `{ jourUtc, nombrePas, recuLe }`,
un élément par jour, écrit avec le même verrou de version que le reste de
l’agrégat. Pas de nouvelle collection.

## Application mobile

- **Coach** : à l’étape « budget » du formulaire de plan, le niveau déduit est
  présélectionné avec la moyenne utilisée. Tant que le coach n’en change pas,
  l’API recalcule elle-même le niveau ; un autre choix est envoyé tel quel.
  Sans 7 jours de pas, le choix reste manuel. La fiche « Suivi » affiche la
  moyenne des 7 jours.
- **Utilisateur** : carte « Activité · 7 derniers jours » dans l’onglet Suivi,
  chargée en ligne (message et « Réessayer » hors ligne).

## Simulateur

`simulator/balance.mjs` envoie le poids puis les pas dans la même session
(`SIMULATOR_BASE_STEPS`, `SIMULATOR_MAX_STEPS_VARIATION`, `SIMULATOR_STEPS=false`
pour désactiver). Voir [simulateur-balance.md](simulateur-balance.md).

## Tests

| Niveau | Fichier |
| --- | --- |
| Unitaires API | `activity/domain/services/niveau-activite.spec.ts`, `suivis/domain/entities/suivi.pas-quotidiens.spec.ts`, `plans/application/use-cases/prepare-plan.use-case.spec.ts` |
| Intégration API (MongoDB réel) | `test/activity.integration-spec.ts` |
| Simulateur | `simulator/balance.test.mjs` |
| Mobile | `mobile/src/activity/tests/presentation.test.ts` |
