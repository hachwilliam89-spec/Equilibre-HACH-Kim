# Equilibre

Application de suivi de rééquilibrage alimentaire avec accompagnement coach.

Un coach définit pour un utilisateur un plan de poids et un budget calorique
calculé à partir de son métabolisme. L'utilisateur reçoit automatiquement ses
pesées via une balance connectée simulée, consigne son alimentation à partir
d'une librairie de référence, et suit son écart à la trajectoire fixée.

Projet fil rouge de Licence Professionnelle Développement Full Stack — UHA 4.0.

Documentation détaillée du backend : [README de l’API](api/README.md).

## Stack

| Composant | Technologie |
|---|---|
| API | NestJS (Node.js / TypeScript), architecture hexagonale par module |
| Base de données | MongoDB 8.0 via Mongoose |
| Mobile | React Native (Expo) — connexion et session initialisées |
| Authentification | JWT + refresh token |
| Conteneurisation | Docker / Docker Compose |
| Qualité | ESLint 9 (flat config) + Prettier, Husky, commitlint |
| Tests | Jest, Supertest, Cucumber |
| Documentation API | Swagger sur `/api/docs` |

## Prérequis

- Docker Desktop
- Node 24 et pnpm 10.25.0 (via corepack) — uniquement pour lancer le lint et
  les tests hors conteneur ; le reste tourne dans Docker

```bash
corepack enable
```

## Démarrage

```bash
git clone https://git.uha4point0.fr/UHA40/fil-rouge-2026/4.0.3/equilibre-hach-kim.git
cd equilibre-hach-kim

# Fichiers d'environnement (non versionnés)
cp .env.example .env.dev
cp .env.example .env.test

# Générer les secrets — le schéma de validation exige 32 caractères minimum
openssl rand -hex 32   # à reporter dans JWT_SECRET
openssl rand -hex 32   # à reporter dans JWT_REFRESH_SECRET

# Dépendances (pour le lint et les tests locaux)
pnpm install
pnpm --dir api install

# Lancer l'environnement de développement
pnpm docker:dev
```

Après la copie de `.env.example`, modifier `.env.test` :

```dotenv
NODE_ENV=test
API_PORT=3001
MONGO_PORT=27018
```

Configurer également `MONGO_URI` pour utiliser la base distincte
`equilibre_test`, avec les identifiants MongoDB de cet environnement.
Les ports distincts permettent de démarrer les environnements de développement
et de test en parallèle.

`NODE_ENV=test` est indispensable : le modèle contient `NODE_ENV=development`.
L’image de test utilise le stage de production, sans `pino-pretty`. Conserver
le mode développement lui ferait charger ce module absent et empêcherait
le démarrage de l’API.

Vérification :

```bash
pnpm docker:dev:ps                      # les deux conteneurs doivent être healthy
curl -s localhost:3000/api/health       # {"status":"ok", ... "mongo":{"status":"up"}}
```

Documentation Swagger : http://localhost:3000/api/docs

## Scripts

| Commande | Effet |
|---|---|
| `pnpm docker:dev` | Construit si besoin et démarre l'environnement de développement |
| `pnpm docker:dev:ps` | État et santé des conteneurs |
| `pnpm docker:dev:logs` | Logs des deux services |
| `pnpm docker:dev:logs:api` | Logs de l'API seule |
| `pnpm docker:dev:logs:mongo` | Logs de MongoDB seul |
| `pnpm docker:dev:down` | Arrête l'environnement de développement |
| `pnpm docker:test` | Démarre l'environnement de test (API 3001, Mongo 27018) |
| `pnpm docker:test:logs` | Logs de l'environnement de test |
| `pnpm docker:test:down` | Arrête et purge l'environnement de test |
| `pnpm docker:prod` | Démarre la production depuis l'image de la registry |
| `pnpm docker:prod:down` | Arrête la production |
| `pnpm lint` | Lance ESLint sur l'API |
| `pnpm test` | Tests unitaires |
| `pnpm test:cov` | Tests unitaires avec rapport de couverture |
| `pnpm test:e2e:local` | Tests d’intégration Jest/Supertest avec MongoDB de test ; nécessite `pnpm docker:test` |
| `pnpm test:cucumber:local` | Exécute les scénarios Gherkin de l’US1 avec MongoDB de test ; nécessite `pnpm docker:test` |

## Environnements

Les trois environnements sont isolés : bases, utilisateurs, volumes et secrets
distincts. `docker-compose.yml` contient la configuration commune et n'est
jamais lançable seul ; chaque environnement résulte de sa fusion avec un
fichier de surcharge.

| | Développement | Test | Production |
|---|---|---|---|
| Base | `equilibre_dev` | `equilibre_test` | `equilibre` |
| Stockage | volume nommé | mémoire (`tmpfs`) | volume nommé |
| Port API | 3000 | 3001 | 3000 |
| Mongo exposé | oui (27017) | oui (27018) | non |
| Stage Docker | `development` (mode watch) | `production` | `production` |

L’environnement de test stocke MongoDB en mémoire (`tmpfs`). Les données
restent présentes tant que le conteneur tourne : relancer Jest ne vide pas
la base. Pour repartir d’une base vide, supprimer puis relancer
l’environnement de test :

```bash
pnpm docker:test:down
pnpm docker:test
# Attendre que MongoDB soit healthy avant de lancer les tests
pnpm --dir api test:e2e:local --runInBand
```

Cette procédure efface les données de l’environnement de test.

## Structure

```
.
├── api/                     API NestJS
│   ├── src/
│   │   ├── auth/            module d'authentification
│   │   │   ├── domain/          entités et ports (aucune dépendance technique)
│   │   │   ├── application/     cas d'usage
│   │   │   └── infrastructure/  adaptateurs Mongoose et HTTP
│   │   ├── config/          validation des variables d'environnement (Zod)
│   │   ├── common/          filtres et erreurs transverses
│   │   └── health/          endpoint de santé (Terminus)
│   ├── Dockerfile           build multi-stage : deps, development, builder, production
│   └── .dockerignore
├── mobile/                  application React Native (connexion et session)
├── docker-compose.yml       configuration commune
├── docker-compose.dev.yml   surcharge développement
├── docker-compose.test.yml  surcharge test
├── docker-compose.prod.yml  surcharge production
└── .env.example             modèle des fichiers d'environnement
```

Chaque module métier suit la même structure hexagonale : le domaine ne connaît
que ses propres interfaces, les adaptateurs branchent la technique dessus. Les
règles métier se testent en TypeScript pur, sans base de données ni mock.

## Conventions

**Branches** — une branche par tâche, nommée `FR403-X-Description` où `X` est
le numéro du ticket Jira. Intégration par merge request vers `develop`, puis
vers `main` pour les fonctionnalités terminées et vérifiées. Conserver les
commits de fusion pour rendre le regroupement des changements visible.

**Commits** — format conventional commits, vérifié automatiquement par
commitlint au moment du commit.

```
feat(auth): ajoute le rafraichissement de jeton
fix(docker): corrige le chemin du Dockerfile
```

**Qualité** — Husky installe deux hooks à la racine :

- `pre-commit` lance ESLint et Prettier sur les fichiers TypeScript indexés
- `commit-msg` valide le format du message

Un lint en échec bloque le commit.

## Sécurité

- Aucun secret n'est versionné : les fichiers `.env.*` sont exclus, seul
  `.env.example` est suivi
- Les secrets JWT sont validés au démarrage (32 caractères minimum) ; une
  configuration invalide empêche l'application de démarrer
- Le conteneur de production tourne sous un utilisateur sans privilèges
- En-têtes de sécurité HTTP via Helmet
- Les journaux masquent les en-têtes d'autorisation, les cookies et les mots
  de passe
- En production, MongoDB n'est pas exposé : il n'est joignable que par l'API,
  via le réseau interne Docker

## Application mobile

Le premier écran de connexion est disponible dans `mobile/`. Voir [le guide mobile](mobile/README.md) pour configurer l’adresse API, lancer Expo et effectuer la recette sur téléphone. Le formulaire du plan (FR403-128) reste à implémenter.
