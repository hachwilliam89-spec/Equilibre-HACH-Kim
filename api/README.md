# Équilibre — API

Backend du projet fil rouge UHA 4.0 : accompagnement du rééquilibrage alimentaire
par un coach. L’API utilise NestJS, TypeScript et MongoDB via Mongoose.

[Dépôt GitLab](https://git.uha4point0.fr/UHA40/fil-rouge-2026/4.0.3/equilibre-hach-kim)
 · [Installation générale et environnements Docker](../README.md)

## Modules présents

- **auth** : inscription, connexion, renouvellement des jetons et déconnexion ;
  rôles `coach` et `utilisateur`.
- **plans** : soumission d’un plan pour un utilisateur rattaché, calcul de l’IMC
  cible, contrôle du rythme, calcul du budget calorique, consultation et annulation.
- **health** : vérification de la disponibilité de MongoDB.

Le suivi des pesées et le journal alimentaire font partie du périmètre métier
prévu, mais leurs modules ne sont pas encore présents dans cette API.
La déduction du niveau d’activité depuis une montre simulée relève de l’US4,
hors MVP ; le niveau d’activité du plan est actuellement choisi manuellement.

## Démarrage avec Docker

Prérequis : Docker Compose, Node.js **24.9.0 minimum** et pnpm **10.25.0**
pour les commandes locales. Toutes les commandes ci-dessous s’exécutent
**depuis la racine du dépôt**, et non depuis `api/`.

Suivre d’abord le [README principal](../README.md#démarrage) pour préparer
`.env.dev`, `.env.test`, les secrets et les dépendances. Puis :

```bash
pnpm docker:dev
pnpm docker:dev:ps
curl http://localhost:3000/api/health
```

Les deux services doivent être `healthy`. Avec le port de développement par défaut :

- API : `http://localhost:3000/api`
- Swagger : `http://localhost:3000/api/docs`
- Santé : `http://localhost:3000/api/health`

Adapter le port des URL si `API_PORT` est modifié dans `.env.dev`.

```bash
pnpm docker:dev:logs:api
pnpm docker:dev:down
```

Le mode de développement Docker recharge l’API lors des changements de code.
L’arrêt standard conserve les données du volume de développement.

## Configuration

La configuration de l’API est validée au démarrage dans
[`src/config/env.schema.ts`](src/config/env.schema.ts).

| Variable | Utilisation |
|---|---|
| `NODE_ENV` | `development`, `test` ou `production` ; défaut : `development` |
| `MONGO_URI` | URI MongoDB obligatoire, avec les identifiants et la base de l’environnement |
| `JWT_SECRET` | Secret du jeton d’accès, au moins 32 caractères |
| `JWT_REFRESH_SECRET` | Secret du jeton de renouvellement, au moins 32 caractères |
| `PORT` | Port d’écoute de l’API ; défaut : `3000` |
| `BCRYPT_SALT_ROUNDS` | Coût bcrypt entre 4 et 15 ; défaut : `10` |

`API_PORT` et `MONGO_PORT` servent à Docker Compose pour publier les ports sur
la machine hôte. Ils ne changent pas les ports internes des services.
Dans Docker, MongoDB est accessible sous le nom `mongo` ; depuis la machine
hôte, il est accessible sur `localhost` avec le port publié.

Compose transmet actuellement `NODE_ENV`, `MONGO_URI` et les deux secrets JWT
à l’API. Pour surcharger `PORT` ou `BCRYPT_SALT_ROUNDS` dans un conteneur,
il faut également les déclarer dans sa configuration `environment`.
Les fichiers d’environnement contenant des secrets ne doivent pas être versionnés.

## Routes disponibles

Toutes les routes utilisent le préfixe `/api`. Les schémas de requête et les
réponses documentées sont consultables dans Swagger.

| Méthode | Route | Utilisation / accès |
|---|---|---|
| GET | `/api/health` | Santé de l’API et de MongoDB |
| POST | `/api/auth/register` | Inscription d’un coach ou utilisateur |
| POST | `/api/auth/login` | Connexion ; retourne les jetons |
| POST | `/api/auth/refresh` | Renouvellement avec rotation du refresh token |
| POST | `/api/auth/logout` | Révocation du refresh token fourni ; réponse 204 |
| POST | `/api/plans` | Soumission d’un plan ; coach authentifié |
| GET | `/api/plans/me` | Plan actif de l’utilisateur connecté, ou `null` |
| GET | `/api/plans/users/:userId` | Plan actif d’un utilisateur rattaché au coach, ou `null` |
| POST | `/api/plans/:id/cancel` | Annulation d’un plan ; coach concerné |

Pour les routes protégées, transmettre `Authorization: Bearer <accessToken>`.
Dans Swagger, utiliser le bouton **Authorize** avec le jeton d’accès obtenu
à la connexion. Les routes de renouvellement et de déconnexion attendent
un champ `refreshToken` dans le corps JSON.

## Architecture

```text
src/
├── auth/              Authentification
├── plans/             Plans de poids et budgets caloriques
├── common/            Erreurs, filtres, rôles et sécurité transverses
├── config/            Validation de l’environnement
├── health/            Contrôle de santé MongoDB
├── app.module.ts      Assemblage des modules
└── main.ts            Démarrage, préfixe API, Helmet et Swagger
```

Les modules `auth` et `plans` suivent une architecture hexagonale :

- `domain/` : entités, règles métier et interfaces des repositories ;
- `application/` : cas d’usage ;
- `infrastructure/` : routes HTTP, validation des entrées et persistance Mongoose.

## Qualité et tests

Depuis la racine du dépôt, après installation des dépendances :

| Commande | Utilisation |
|---|---|
| `pnpm --dir api lint` | Vérification ESLint |
| `pnpm --dir api build` | Compilation TypeScript/NestJS dans `api/dist/` |
| `pnpm --dir api test --runInBand` | Tests unitaires |
| `pnpm --dir api test:cov` | Tests unitaires et rapport de couverture |
| `pnpm --dir api test:e2e:local --runInBand` | Tests d’intégration avec MongoDB de test |

Les tests unitaires se trouvent dans `src/**/*.spec.ts`. Les tests
d’intégration se trouvent dans `test/*.e2e-spec.ts` et couvrent notamment
l’authentification et les plans.

### Tests d’intégration locaux

Préparer `.env.test` avec `NODE_ENV=test`, des secrets JWT valides,
`API_PORT=3001`, `MONGO_PORT=27018` et une URI visant `equilibre_test`.
Les identifiants MongoDB doivent correspondre à ceux de ce même environnement.
Après la copie du modèle, remplacer explicitement `NODE_ENV=development` par
`NODE_ENV=test` : sinon l’API tente de charger `pino-pretty`, absent de l’image
de production utilisée pour les tests.

```bash
pnpm docker:test
pnpm --dir api test:e2e:local --runInBand
pnpm docker:test:down
```

Attendre que MongoDB de test soit sain avant de lancer les tests.
Le script [`scripts/test-e2e-local.sh`](scripts/test-e2e-local.sh) charge
`.env.test` à la racine et adapte l’URI vers `localhost:MONGO_PORT/equilibre_test`.
Les suites démarrent leur propre application Nest de test et utilisent une
véritable base MongoDB ; elles ne ciblent pas l’API du conteneur via son port HTTP.

`pnpm docker:test` démarre l’environnement mais ne lance pas les tests.
`pnpm docker:test:down` supprime l’environnement de test et ses volumes.
Relancer uniquement Jest ne réinitialise pas automatiquement MongoDB.

## Protections de l’authentification

- Mots de passe hachés avec bcrypt ; limite de 72 octets UTF-8 à l’inscription
  et à la connexion.
- Rotation des refresh tokens et révocation lors de la déconnexion.
- Limitation des requêtes : 100 par minute et par IP au niveau global,
  5 par minute pour la connexion.
- Contrôle JWT et rôles sur les routes de plans.
- En-têtes HTTP Helmet et masquage des données sensibles dans les journaux.

Ces mécanismes décrivent l’implémentation actuelle ; les tests restent la
référence pour les scénarios effectivement vérifiés.

## Scénarios métier Cucumber / Gherkin

Les scénarios lisibles de l’US1 se trouvent dans
[`test/cucumber/features/plans.feature`](test/cucumber/features/plans.feature).
Les tags `@us1` et `@FR403-123`, `@FR403-126`, `@FR403-127` relient les
scénarios aux règles et aux tickets. Ils complètent les tests Jest existants.

Depuis la racine, avec `.env.test` préparé :

```bash
pnpm docker:test
pnpm test:cucumber:local
```

La commande compile l’API, puis lance Cucumber selon `api/cucumber.cjs`.
Chaque scénario utilise une instance Nest, des comptes authentifiés par l’API,
des appels HTTP Supertest et une vraie base MongoDB. Les assertions vérifient
les réponses et les documents enregistrés. Le nettoyage supprime uniquement
les données du scénario ; il ne vide pas les autres données de test.

Un rapport HTML est généré dans `api/reports/cucumber.html` (non versionné).
Les sorties du terminal donnent le nombre de scénarios et d’étapes réussis.
Avec l’environnement déjà exporté, `pnpm test:cucumber` lance la même suite.
Le runner exige `NODE_ENV=test` et une URI visant la base `equilibre_test`.

La suite actuelle couvre 21 scénarios de l’US1 : dates, poids, IMC et rythme,
budget automatique ou manuel, accès du coach, absence de plan, concurrence,
annulation et expiration. Elle ne constitue pas encore une couverture de
chaque retour possible de toutes les routes, ni du parcours mobile.

### Répartition des vérifications

- **Jest unitaire** : calculs et limites du domaine, contrat des DTO.
- **Jest intégration** : authentification et contrôles complémentaires des plans
  (profils incomplets, budget sédentaire, conflit séquentiel, droits de consultation
  et d’annulation, lecture d’un plan expiré).
- **Cucumber** : scénarios métier des plans (dates, poids, IMC, rythme, budgets,
  concurrence, absence de plan, annulation et échéance).

Les scénarios d’intégration déjà entièrement couverts par Cucumber ont été
retirés de Jest. Leurs assertions supplémentaires ont été transférées :
rattachement utilisateur/coach, IMC enregistré, index MongoDB unique et nombre
de plans actifs. Les tests unitaires restent utiles pour isoler les calculs.
Pour vérifier l’ensemble, exécuter les trois commandes :

```bash
pnpm test --runInBand
pnpm test:e2e:local --runInBand
pnpm test:cucumber:local
```
