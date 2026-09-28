# Mesures de poids — API

## Réception automatique (FR403-669)

`POST /api/measurements` nécessite un JWT de rôle `utilisateur`.
Le simulateur envoie uniquement `{"poidsKg": 71.5}`. Le poids doit être un
nombre strictement positif ; les champs supplémentaires sont refusés (400).
L’utilisateur est identifié par le JWT, sans identifiant fourni dans le corps.

L’API recherche son plan actif, génère un UUID, un horodatage serveur UTC et
le jour UTC associé, puis persiste la mesure avec la source `automatique`.
Elle renvoie 201 avec la mesure, visible dans `GET /api/measurements/me`.
Sans plan actif (absent, annulé, terminé ou expiré), elle renvoie 422
`no-active-plan` et ne crée aucune mesure. L’expiration utilise le mécanisme
existant des plans ; le jour de date cible reste inclus.

Les erreurs 401, 403, 409 et 429 sont documentées dans Swagger.
L’index d’unicité hérité de FR403-671 reste en place et peut déjà produire 409.
La classification est provisoirement `valide` : FR403-672 ajoutera les statuts
`suspecte` et `hors-plan`. FR403-674 complétera les règles de blocage journalier,
notamment les corrections manuelles hors-plan. Ces règles ne sont donc pas
encore à considérer comme livrées par cette seule étape.
Le simulateur et sa fréquence quotidienne ne font pas partie de cet endpoint.

## Validation

`pnpm --dir api test:e2e:local --runInBand measurements.integration-spec.ts`

Tests avec MongoDB réel : persistance et historique, identité JWT, date serveur,
validation du corps, refus anonyme/JWT invalide/coach, absence de mesure
orpheline et expiration du plan. Les tests d’historique de FR403-671 sont conservés.

Recette Swagger : se connecter avec un utilisateur disposant d’un plan actif,
envoyer un poids positif, vérifier 201 puis sa présence dans l’historique.
Avec un corps vide, attendre 400 ; avec un utilisateur sans plan actif,
attendre 422 ; avec un coach, attendre 403. Utiliser un utilisateur sans mesure
valide déjà enregistrée aujourd’hui pour le scénario 201.
