# Déploiement OVH : procédure actuelle

État vérifié le 20 octobre 2026. Cette procédure concerne la chaîne personnelle
GitHub Actions → GHCR → VPS OVH. La chaîne GitLab → serveur n°2 de l’école est
expliquée dans [déploiement école](deploiement-ecole.md).

## Circuit de livraison

1. Développer sur une branche `FR403-<ticket>-description`, puis pousser sur GitLab.
2. Ouvrir une MR GitLab vers `develop`, attendre les contrôles et fusionner en ligne.
3. Récupérer le `develop` fusionné et avancer GitHub sans réécrire son historique.
4. GitHub Actions exécute les contrôles API, mobile, simulateur et scripts de déploiement.
5. `publish` construit les images API et simulateur et les publie sur GHCR.
6. `deploy-recette` déploie l’API par digest, puis `deploy-simulator` met à jour le simulateur.

Sur `develop`, les étapes de publication et déploiement partent automatiquement
après les contrôles. Sur `main`, elles se lancent par `workflow_dispatch` depuis
Actions (« Run workflow ») après validation de la version stable. La synchronisation
GitLab → GitHub est une étape explicite, pas un miroir automatique configuré.

```bash
git fetch origin develop
git switch develop
git merge --ff-only origin/develop
git push github develop:develop
```

Ces commandes supposent un répertoire de travail prêt et les remotes `origin`
(GitLab) / `github`. Un refus de fast-forward demande de comparer les historiques,
pas de forcer le push. Les MR restent sur GitLab.

## Deux cibles, deux chaînes

| Chaîne | Construction | Déploiement | Déclenchement |
|---|---|---|---|
| GitLab école | Runner salle 102, kaniko, GHCR | Serveur n°2 via `deploy:ecole` | Automatique sur develop si `DEPLOY_ECOLE_ENABLED=true`, manuel sur main |
| GitHub personnelle | Runners GitHub, Buildx, GHCR | VPS OVH via `deploy-recette`, puis simulateur | Automatique sur develop, workflow manuel sur main |

Les deux chaînes construisent leurs propres images depuis le même commit. Un SHA
Git identique ne garantit pas des digests Docker identiques : dépendances externes
et outils de construction peuvent évoluer. La cible utilise le digest produit par
sa propre pipeline.

## Configuration et secrets

| Élément | Emplacement / rôle |
|---|---|
| `DEPLOY_HOST`, `DEPLOY_USER` | Secrets GitHub, destination SSH OVH |
| `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS` | Secrets GitHub ; clé dédiée et clé d’hôte vérifiée |
| `GITHUB_TOKEN` | Jeton fourni au job `publish`, avec `packages: write` |
| `.env.prod` | Configuration applicative sur le VPS, permissions 600, hors Git |
| `.env.release` | Digest déployé avec succès |
| `.env.previous` | Image API précédant le dernier déploiement réussi |

Les anciens paramètres GitLab `DEPLOY_RECETTE_ENABLED` ne pilotent plus OVH.
Les variables école sont documentées dans leur propre procédure. Ne pas afficher
les valeurs des secrets pendant la présentation.

Le projet Compose OVH est `equilibre-prod`, dans `/home/ubuntu/equilibre-prod`.
Les fichiers `docker-compose.yml` et `docker-compose.prod.yml` y sont provisionnés
séparément : le job API transmet le script par SSH, pas un checkout du dépôt.
Une modification Compose ou une nouvelle variable nécessite donc une préparation
explicite de la cible avant le déploiement de l’image.

### Caddy et adresse client

Caddy termine HTTPS et joint l’API sur `equilibre-proxy`. L’API ne publie pas de
port sur l’hôte ; MongoDB reste sur le réseau privé de l’application. Sur la cible,
configurer `TRUSTED_PROXY_IPS` avec l’IP exacte de Caddy, puis vérifier que la
surcharge Compose la transmet au conteneur API. Valeur observée le 20/10/2026 :
`172.20.0.2` ; c’est une observation, pas une adresse garantie après recréation.

```bash
docker network inspect equilibre-proxy --format '{{range .Containers}}{{.Name}}={{.IPv4Address}} {{end}}'
```

Une liste vide désactive toute confiance dans les en-têtes transférés. Les adresses
exactes sont séparées par des virgules ; aucun booléen, nombre de sauts ou CIDR.
Après changement du réseau ou recréation de Caddy, vérifier l’adresse puis recréer
l’API avec la configuration mise à jour. Le quota login doit distinguer les IP
clientes ; un client ne doit pas choisir son quota via un en-tête forgé.

## Déploiement et contrôle de santé

Le script `scripts/deploy-recette.sh` :

1. exige une référence `ghcr.io/.../equilibre-api@sha256:...` ;
2. prend un verrou `flock` sur le dossier et vérifie Compose, MongoDB et l’API ;
3. mémorise l’ID immuable de l’image API actuellement saine ;
4. télécharge la nouvelle image avant de modifier le service ;
5. remplace uniquement l’API (`--no-deps --no-build --pull never --wait`) ;
6. attend son healthcheck, qui vérifie `/api/health` et la connexion MongoDB ;
7. écrit `.env.release` et `.env.previous` après succès.

MongoDB et ses volumes ne sont pas recréés par ce script. Le workflow sérialise
les déploiements OVH ; le verrou cible protège également les exécutions manuelles.

Après publication, contrôler **le résultat des jobs de déploiement**, puis :

```bash
curl --fail --show-error https://equilibre.164-132-246-49.sslip.io/api/health
```

Un HTTP 200 et `status: ok` prouvent la disponibilité, pas le fonctionnement de
chaque parcours métier. Ajouter une recette de connexion et consultation avec un
compte de démonstration. Éviter un redéploiement sans changement pendant l’oral :
montrer les preuves d’une pipeline déjà terminée.

## Retour arrière

Si l’API remplacée n’est pas saine, le script tente de restaurer son image précédente
et attend sa santé. Le job reste en échec même si la restauration réussit. Il signale
un échec de restauration ; une coupure du serveur ou un SIGKILL peut demander une
intervention manuelle.

Pour un retour arrière métier, après sauvegarde et vérification de compatibilité :
prendre le même verrou et charger `.env.previous` après `.env.prod` à la place de
`.env.release`, puis remplacer seulement l’API avec `--no-deps --no-build --pull never
--wait`. Mettre `.env.release` à jour uniquement après succès. Conserver l’ancienne
image locale jusqu’à la fin de la recette.

Le retour arrière porte sur **l’image API**, pas sur les données ni la configuration
Compose. Une migration de données exige une stratégie de sauvegarde et de restauration
séparée. Ne jamais utiliser `down -v` sur une base à conserver.

## API, web et APK : trois livraisons différentes

| Composant | Livraison | Contrôle utile |
|---|---|---|
| API / simulateur | Workflow GitHub et images Docker | Commit, digest, jobs et santé |
| Démo web | Export Expo web puis publication dans son conteneur statique | Vérifier le bundle réellement servi et le parcours dans le navigateur |
| APK Android | EAS Build, profil preview, canal preview, hébergement sur le VPS | Version/build, runtime, SHA-256 du fichier téléchargé |
| Mise à jour JS compatible | EAS Update sur le canal preview | Plateforme, runtime compatible, identifiant de mise à jour et test après relancement |

La CI API ne publie actuellement ni le web, ni l’APK, ni une mise à jour OTA.
Une API à jour ne remplace pas le front embarqué. L’APK doit intégrer le design
attendu pour une première ouverture ; une OTA compatible peut s’appliquer après
vérification et téléchargement par l’application. Un changement natif demande
une nouvelle APK. Détails de construction : [guide mobile](../mobile/README.md).

Déployer l’API avant un client qui dépend d’un nouveau contrat. Pour chaque livraison,
noter : commit API, pipeline et digest ; commit web ; version/build/runtime APK ;
identifiant OTA éventuel. Les sauvegardes des fichiers statiques et de l’APK sont
distinctes du retour arrière Docker de l’API.

## Preuves et limites

Dernière livraison API vérifiée avant cette mise à jour documentaire, le 20/10/2026 :

- commit `9558de272f46f267aa34b25a1b7bd1521b95598b` ;
- [MR GitLab !129](https://git.uha4point0.fr/UHA40/fil-rouge-2026/4.0.3/equilibre-hach-kim/-/merge_requests/129) ;
- [GitHub Actions 39387151095](https://github.com/hachwilliam89-spec/Equilibre-HACH-Kim/actions/runs/39387151095), publication et deux déploiements réussis ;
- API publique `status: ok`, MongoDB `up` après déploiement.

Cette preuve ne valide pas automatiquement une modification ultérieure du proxy.
Les tests de contrat `bash scripts/test-deploy-recette.sh` et
`bash scripts/test-deploy-simulator.sh` utilisent des commandes simulées ; ils ne
remplacent pas les jobs distants ni une restauration réelle de base.

L’API est remplacée dans un conteneur unique : aucune absence totale d’interruption
n’est garantie. Les compteurs de limitation sont en mémoire et repartent à zéro au
redémarrage. La chaîne école est accessible depuis le campus en HTTP ; la démo
publique OVH passe par HTTPS.

## Historique

La préparation de septembre, les anciennes variables et les observations datées
sont conservées dans [l’archive du 25 septembre](historique/deploiement-recette-20260925.md).
Les passages de cette archive décrivent l’état de l’époque, pas la procédure actuelle.
