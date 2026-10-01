# Simulateur de balance connectée — FR403-729

Le simulateur est un client externe de l’API. Il ne lit et ne modifie jamais
MongoDB directement : il se connecte avec un compte `utilisateur`, génère un
poids avec `@faker-js/faker`, appelle `POST /api/measurements`, puis révoque sa
session. L’API reste responsable du rattachement au plan, de l’horodatage UTC,
du statut et des conflits journaliers.

## Configuration

```bash
cp simulator/.env.example simulator/.env
```

Renseigner dans `simulator/.env` un compte utilisateur possédant un plan actif.
Ce fichier est ignoré par Git et ne doit jamais être partagé ni commité.

## Démonstration ponctuelle

```bash
pnpm simulate:balance
```

Une valeur réaliste autour de `SIMULATOR_BASE_WEIGHT_KG` est générée puis
envoyée immédiatement. Une seconde exécution le même jour reçoit normalement
le conflit métier HTTP 409 et ne crée aucun doublon.

Pour démontrer la détection d’anomalie, faire correspondre
`SIMULATOR_BASE_WEIGHT_KG` à la dernière mesure valide, puis lancer :

```bash
SIMULATOR_MODE=suspect pnpm simulate:balance
```

Faker génère alors une variation volontairement supérieure à 3 kg par rapport
au poids de référence configuré.

## Fonctionnement quotidien

```bash
pnpm simulate:balance:daily
```

Le premier envoi est immédiat, puis le processus attend
`SIMULATOR_INTERVAL_MS` entre deux tentatives. La valeur par défaut est de
24 heures. Le processus s’arrête proprement avec `Ctrl+C`. En production, un
ordonnanceur externe pourrait lancer la commande ponctuelle une fois par jour ;
la fréquence relève du simulateur, pas de l’API.

## Tests

```bash
pnpm test:simulator
```

Les tests vérifient la plage normale, le mode suspect, la configuration et la
séquence connexion → mesure automatique → déconnexion sans appeler le réseau.
