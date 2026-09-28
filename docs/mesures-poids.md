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
Un index unique partiel `one_valid_measurement_per_user_day`
(`{userId, jourUtc}`, filtré sur `statut: valide`) garantit au plus une mesure
valide par utilisateur et par jour.

## Classification suspecte / hors-plan (FR403-672)

À la réception, le statut est classé (service de domaine pur
`classifyMeasurement`) :
- `hors-plan` si le jour UTC est hors de `[dateDebut, dateCible]` du plan actif ;
- `suspecte` si `|poids − poids valide de la veille du même plan| > 3 kg` ;
- `valide` sinon.
Les mesures suspecte et hors-plan sont conservées dans l'historique mais
exclues du suivi.

## Blocage des doublons du jour (FR403-674)

Une seule mesure `valide` par utilisateur et par jour UTC, toutes sources
confondues. Toute mesure valide supplémentaire le même jour → 409
`measurement-day-conflict`. Pré-contrôle explicite dans le use case ; l'index
unique partiel reste le filet anti-course (deux insertions valides simultanées
→ une seule réussit). Les statuts suspecte / hors-plan n'entrent pas dans la
règle.

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
mesure valide du jour (donc possible quand aucune mesure automatique valide, ou
quand celle du jour est suspecte) ; sinon 409 `measurement-day-conflict`. Une
correction hors-plan est stockée sans être retenue. Sans plan actif → 422.

## Réponses d'erreur

RFC 7807 (`application/problem+json`) : 400 (corps invalide), 401 (non
authentifié), 403 (rôle interdit), 409 (`measurement-day-conflict`), 422
(`no-active-plan`), 429 (quota). Documentées dans Swagger.

## Tests (FR403-676)

Sans mock, chaque couche par le moyen adapté :
- **Unitaires (Jest, purs)** : `measurement.entity`, `measurement-classification`,
  `measurement-trajectory`, `measurement-suivi` — calculs et règles isolés.
- **Intégration (Jest + Supertest, MongoDB réel)** :
  `measurements.integration-spec.ts` — réception, historique, classification,
  blocage du jour, suivi, correction manuelle, concurrence (deux mesures valides
  simultanées → une seule retenue), et autorisations explicites (401/403) sur
  chaque route.
- **Cucumber / Gherkin** : `test/cucumber/features/measurements.feature` —
  parcours métier de l'US2 (`@us2`, tags par ticket).

Lancement (depuis la racine, `pnpm docker:test` au préalable) :

```
pnpm --dir api test --runInBand
pnpm --dir api test:e2e:local measurements
pnpm --dir api test:cucumber:local
```
