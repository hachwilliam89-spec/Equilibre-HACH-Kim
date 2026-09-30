# Suivi du poids — API (US2)

Module `measurements`, architecture hexagonale (domaine / application /
infrastructure). Toutes les routes exigent un JWT de rôle `utilisateur` ;
l'utilisateur est identifié par le JWT, jamais par le corps.

## Réception automatique (FR403-669)

`POST /api/measurements` — corps `{"poidsKg": 71.5}` uniquement (strictement
positif ; tout champ supplémentaire → 400). L'API rattache la mesure au plan
actif, génère UUID, horodatage serveur UTC et jour UTC, source `automatique`.
Sans plan actif (absent, annulé, terminé ou expiré) → 422 `no-active-plan`,
aucune mesure orpheline.

## Modèle et historique (FR403-671)

`GET /api/measurements/me` — historique personnel, tous plans, sources et
statuts confondus, par réception décroissante (liste éventuellement vide).
Les mesures sont imbriquées dans le document `suivis` de l'utilisateur. La
rétention visible couvre trois mois calendaires glissants UTC, journée limite
incluse, avec un maximum de 1 000 mesures récentes. La projection de lecture
écarte immédiatement les données plus anciennes ; elles sont supprimées du
document lors de l'écriture suivante. La dernière mesure valide du plan
actif est conservée séparément lorsqu'elle est plus ancienne afin de maintenir
le calcul du suivi.

Les lectures utilisent des projections MongoDB : l'historique ne charge que
`mesures`, et le statut ne charge que `derniereMesureValide` lorsque cela
suffit. Les contrats HTTP restent indépendants de la structure MongoDB grâce
aux DTO.

## Classification suspecte / hors-plan (FR403-672)

À la réception, le statut est classé (service de domaine pur
`classifyMeasurement`) :

- `hors-plan` si le jour UTC est hors de `[dateDebut, dateCible]` du plan actif ;
- `suspecte` si `|poids − poids valide de la veille du même plan| > 3 kg` ;
- `valide` sinon.
  Les mesures suspecte et hors-plan sont conservées dans l'historique mais
  exclues du suivi.

## Blocage des doublons du jour (FR403-674)

Une mesure valide ou toute correction manuelle crée le blocage journalier de
l'utilisateur. Toute tentative ultérieure du même jour UTC → 409
`measurement-day-conflict`, quel que soit le statut qu'aurait reçu la nouvelle
mesure. Une mesure automatique suspecte ou hors-plan ne crée pas ce blocage.

Le document `suivis` porte un compteur `version`. Chaque écriture compare puis
incrémente cette version dans une opération MongoDB atomique : deux requêtes
concurrentes ne peuvent donc pas valider le même état. Après cinq conflits
techniques de version, l'API renvoie 409 sans écriture partielle.

## Écart de trajectoire (FR403-673)

Service de domaine pur : `poids attendu = poids départ +
(poids cible − poids départ) × jours écoulés / durée totale` (jours civils UTC),
`écart = poids mesuré − poids attendu`. Tolérance `± 1 kg` (« dans les clous »).

## Affichage du statut de suivi (FR403-675)

`GET /api/measurements/me/suivi` — 200 avec l'objet de suivi, ou 200 `null` si
aucun plan actif. Statut calculé sur la dernière mesure valide du plan actif :

- `en-attente-premiere-mesure` : aucune mesure valide ;
- `pas-de-donnees-recentes` : dernière valide datée d'avant-hier ou avant ;
- `dans-les-clous` / `ecart-detecte` : dernière valide datée d'aujourd'hui ou
  hier, écart ≤ 1 kg ou non.
  La réponse porte le résumé du plan actif, la dernière mesure valide, le poids
  attendu et l'écart signé.

## Correction manuelle en secours (FR403-670)

`POST /api/measurements/correction` — corps `{"poidsKg": 74}`. Source
`manuelle`, jamais soumise au contrôle suspecte (override délibéré) : classée
`hors-plan` hors période, `valide` sinon. Retenue uniquement en l'absence d'une
mesure valide ou d'une correction manuelle du jour (donc possible après une
mesure automatique suspecte ou hors-plan) ; sinon 409
`measurement-day-conflict`. Une correction hors-plan est stockée sans entrer
dans le calcul, mais bloque les tentatives suivantes du jour. Sans plan actif
→ 422.

## Réponses d'erreur

RFC 7807 (`application/problem+json`) : 400 (corps invalide), 401 (non
authentifié), 403 (rôle interdit), 409 (`measurement-day-conflict`), 422
(`no-active-plan`), 429 (`measurement-history-limit`, capacité de 1 000 mesures
récentes atteinte). Documentées dans Swagger.

## Tests (FR403-676)

Sans mock, chaque couche par le moyen adapté :

- **Unitaires (Jest, purs)** : `measurement.entity`, `measurement-classification`,
  `measurement-trajectory`, `measurement-suivi` — calculs et règles isolés.
- **Intégration (Jest + Supertest, MongoDB réel)** :
  `measurements.integration-spec.ts` — structure documentaire, réception,
  historique, classification, limite 1 000/429, blocage du jour, suivi,
  correction manuelle, concurrence (une écriture retenue), projections et
  autorisations explicites (401/403) sur chaque route.
- **Cucumber / Gherkin** : `test/cucumber/features/measurements.feature` —
  parcours métier de l'US2 (`@us2`, tags par ticket).

Lancement (depuis la racine, `pnpm docker:test` au préalable) :

```
pnpm --dir api test --runInBand
pnpm --dir api test:e2e:local measurements
pnpm --dir api test:cucumber:local
```
