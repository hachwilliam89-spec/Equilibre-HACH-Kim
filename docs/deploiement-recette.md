# Recette OVH : procédure d'exploitation

Les fichiers de CD sont préparés localement. Leur présence ne signifie pas que les
variables GitLab sont configurées ni que cette CD a été exécutée sur OVH.
L'US1 et sa recette mobile sont validées. Ce chantier relève de FR403-679,
séparément de l'US2.

## État observé et préparation

Les observations ci-dessous proviennent de la note conservée dans le stash
du 23/09/2026 ; elles ne sont pas une nouvelle vérification du serveur.
Le porteur du projet confirme un déploiement manuel validé le 24/09/2026,
qui ne constitue pas une exécution du job CI `deploy:recette`.

Selon cette note, le 23/09/2026, HTTPS a été configuré sur le Caddy existant :
`https://equilibre.164-132-246-49.sslip.io/api`. Le DNS sslip.io pointe sur le VPS ;
le certificat est reconnu par un appel curl externe, sans désactivation de TLS.
`/api/health` retourne `status: ok` et MongoDB `up`.

API et MongoDB appartiennent au projet Compose `equilibre-prod` dans
`/home/ubuntu/equilibre-prod`. L'API n'a plus de port publié sur l'hôte. Caddy et
l'API partagent le réseau externe `equilibre-proxy` ; Caddy utilise l'alias
`equilibre-api-recette:3000`. MongoDB reste sur le seul réseau privé Équilibre.
Le service Caddy de l'autre projet conserve également son réseau `default`.
Son fichier Compose a été adapté pour conserver ce raccordement après recréation.

L'image API a été conservée, maintenant référencée par digest dans `.env.release` :
`ghcr.io/hachwilliam89-spec/equilibre-api@sha256:84148be6100fd2f79b7a7c08ff5b5d8b985d20f5ce9201e2a6ef3a2d637a8d83`.
L'identifiant du conteneur MongoDB est resté identique et l'autre application
`https://kcd-formes.fr` répond toujours HTTP 200 après l'opération.

Sauvegarde des configurations avant changement :
`/home/ubuntu/equilibre-prod/backup-https-20260923T135736Z`.
Ce n'est pas une sauvegarde de la base ni une preuve de passage de la CD.
Le script ponctuel `configure-recette-https.py` reste conservé dans le stash.
Il modifie également le proxy d’un autre projet : il ne fait pas partie de cette
livraison et ne doit pas être rejoué comme un job de déploiement.

Avant l'activation :

1. Raccordement HTTPS effectué : conserver `equilibre-proxy` et le bloc
   [Caddyfile.equilibre](Caddyfile.equilibre). Ne pas lancer un second proxy sur 80/443.
   sslip.io est un DNS tiers gratuit ; un domaine personnel peut le remplacer plus tard.
2. Sauvegarder les deux Compose existants et la base. Vérifier que le nom de projet et
   le volume Mongo restent identiques. Ne pas changer de version Mongo dans cette étape.
3. Installer les deux Compose validés dans `~/equilibre-prod`. Aucun dépôt applicatif
   n'est copié sur la cible. Le script de CD est transmis par SSH, les secrets restent
   dans `.env.prod`, avec des permissions `600`.
4. Le serveur utilise désormais `API_IMAGE` dans `.env.release` ; charger ce fichier
   après `.env.prod` lors des commandes manuelles. Sur une nouvelle cible, fournir une
   référence explicite dès le premier lancement supervisé. Ne jamais mettre `latest`.
   Le script exige ensuite une API et un Mongo déjà sains ; il ne réalise pas le bootstrap.
5. Contrôler les branches protégées develop/main, les droits de push et « Pipelines
   must succeed ». Si deux serveurs sont imposés par le sujet, traiter le VPS unique
   comme une limite temporaire : le runner et l'application y sont encore réunis.

## Variables GitLab

| Variable | Configuration |
| --- | --- |
| `GHCR_USER` | Compte de publication, protégé |
| `GHCR_TOKEN` | Token avec `write:packages`, protégé et masqué ; ne pas le déprotéger pour contourner une branche non protégée |
| `SSH_PRIVATE_KEY` | Variable de type **File**, protégée, portée `recette`, clé dédiée à la CD autorisée sur la cible |
| `SSH_KNOWN_HOSTS` | Variable de type **File**, protégée, portée `recette`, clé publique du serveur vérifiée par un canal de confiance |
| `DEPLOY_HOST` | Hôte ou IPv4 de recette, protégé, portée `recette` |
| `DEPLOY_USER` | Utilisateur SSH de recette, protégé, portée `recette` |
| `DEPLOY_RECETTE_ENABLED` | `true` seulement une fois le provisionnement terminé ; variable de portée globale car lue par `rules` |

Les clés multiligne de type File ne sont pas nécessairement masquables par GitLab ;
ne pas les afficher. Ne pas faire `ssh-keyscan` au moment du job pour accepter sans
vérification une clé présentée par le réseau. Le compte déployeur doit pouvoir utiliser
Docker ; cet accès est privilégié et doit être réservé aux personnes de confiance.
GHCR est public pour la lecture de cette image : pas de token de lecture envoyé au VPS.

DinD conserve la configuration sans TLS du runner existant. Son isolation réseau et
ses privilèges restent à contrôler côté runner ; un runner « de projet » n'est pas une
garantie d'absence de jobs concurrents. TLS est à privilégier lors de cette configuration.

## Livraison et retour arrière

Après réussite des stages quality/test/build, `docker:build` publie le SHA complet
et produit `image.ref` ainsi que `image.env` (conservation 30 jours). Le job manuel
`deploy:recette` lit `image.ref` de la même pipeline ; il ne reconstruit pas l'image.
Il est optionnel pour ne pas bloquer une pipeline en attente d'une décision de recette :
son échec doit être consulté même si GitLab accepte la pipeline avec avertissement.

`resource_group` sérialise les jobs GitLab et `flock` verrouille le dossier cible.
Le script vérifie la configuration et la santé des services, télécharge l'image avant
mutation puis remplace uniquement l'API avec `--no-deps --no-build --pull never --wait`.
MongoDB et ses volumes ne sont jamais supprimés ni recréés. Le HEALTHCHECK de l'image
vérifie `/api/health`, dont la connexion MongoDB.

Si la nouvelle API échoue au contrôle de santé, le script tente de restaurer l'image
précédente via son ID local immuable et attend sa santé. Le job échoue même si ce retour
arrière réussit. Un échec de restauration est signalé explicitement. Les signaux INT/TERM
sont traités, mais une coupure du serveur ou un SIGKILL peuvent exiger une intervention.
L'image précédente ne doit pas être supprimée par un nettoyage Docker automatique.

Après succès, `.env.release` conserve la nouvelle référence et `.env.previous`
l'ancienne. Sur le VPS, les opérations suivantes doivent charger `.env.release` :

```bash
cd ~/equilibre-prod
docker compose --project-name equilibre-prod --env-file .env.prod --env-file .env.release -f docker-compose.yml -f docker-compose.prod.yml ps
```

Un retour arrière métier, après une recette insatisfaisante malgré une API saine,
se fait sous le même verrou en chargeant `.env.previous` à la place de `.env.release`,
avec `up -d --no-deps --no-build --pull never --wait --wait-timeout 120 api`, puis en
copiant `.env.previous` vers `.env.release` **uniquement après succès**. Vérifier au
préalable la compatibilité des données avec l'ancienne version.

Le retour arrière porte sur l'image API, pas sur la configuration Compose ni sur les
données. Les changements de schéma/configuration demandent une procédure distincte.
Ne jamais employer `down -v` pour déployer ou réparer une base à conserver.

## Preuves à recueillir avant clôture

- Pipeline distante complète, digest publié et résultat du job de recette.
- HTTPS accessible depuis un réseau extérieur, accès direct API fermé.
- Coach connecté : liste, proposition sans écriture, soumission, consultation.
- Persistance du plan après redéploiement ; accès refusé depuis un autre coach.
- Retour arrière réel contrôlé sur une base de recette sauvegardée.
- Recette sur téléphone, puis APK Android autonome pour la présentation.

Les tests `bash scripts/test-deploy-recette.sh` simulent Docker : ils couvrent succès,
digest invalide, verrou, Mongo indisponible, échec de téléchargement, échec de santé avec
restauration, et échec de restauration. Ils ne remplacent pas une exécution sur le VPS.

## Validation FR403-679 en deux temps

Sur la branche du ticket, vérifier quality/test/build et les tests de contrat
des scripts. Les jobs publish/deploy sont réservés aux branches protégées
`develop`/`main` : leur absence sur la MR est attendue. Avant fusion, vérifier
les noms, types, protections et portées des variables GitLab sans afficher
leurs valeurs, ainsi que les prérequis serveur ci-dessus.

Après fusion par MR vers `develop`, recueillir le lien de la pipeline réussie,
le SHA, le digest de `image.ref`, puis le résultat du job manuel `deploy:recette`.
Ne pas déclarer le ticket terminé tant que ces preuves réelles manquent.
Aucun déploiement distant n’est effectué par les tests de contrat locaux.

## Vérifications locales du 25/09/2026

Sur `FR403-679-digest-deploiement-recette`, avant commit :

- Syntaxe Bash des quatre scripts : valide.
- 7 scénarios du script distant : réussis avec Docker et verrou simulés.
- 5 scénarios du transport : réussis avec SSH simulé, sans connexion distante.
  Couverture : transmission exacte du script et du digest, vérification de clé
  hôte activée, refus d'un hôte/utilisateur invalide et d'un digest absent ou mutable.
- YAML GitLab et GitHub : syntaxe analysée avec succès (ce contrôle local ne
  remplace pas la validation du pipeline par GitLab).
- Fusion Compose production : configuration valide avec `.env.example` et un
  digest fictif. Sans `API_IMAGE`, refus attendu ; aucun service démarré.
- `git diff --check` : réussi.

Le stash a été lu sans être appliqué ni supprimé. Les fichiers suivis retenus
étaient identiques à la base du stash dans `develop`, avant leur récupération.
Les fichiers mobiles, tests US1 et dossiers temporaires n'ont pas été repris.
Audit du serveur effectué en lecture seule : API et Mongo sains, réseau proxy
présent, configuration Compose et fichiers d'environnement présents, Docker,
Compose et flock disponibles. Aucun déploiement CI réel n'a encore été validé.

## Réglages GitLab vérifiés le 25/09/2026

- Fusion conditionnée à une pipeline réussie.
- `develop` et `main` protégées : fusion réservée aux Maintainers, push direct
  interdit et force push désactivé.
- `GHCR_TOKEN` et `GHCR_USER` : masquées et protégées, portée globale.
- `DEPLOY_HOST` et `DEPLOY_USER` : protégées, portée `recette`.
- `DEPLOY_RECETTE_ENABLED=false` : protégée, portée globale pour son utilisation
  dans les règles de création du job.
- `SSH_PRIVATE_KEY` et `SSH_KNOWN_HOSTS` : présence vérifiée dans GitLab,
  de type File, protégées et limitées à `recette`. Leur contenu n'a pas été
  affiché ; leur utilisation par le runner reste à valider dans le job réel.
- Accès SSH dédié préparé : clé Ed25519 distincte de la clé personnelle,
  clé publique installée avec l'option `restrict` (sans PTY ni forwarding).
  Connexion avec cette clé seule vérifiée sous `ubuntu`, sans déploiement.
  Ce compte conserve ses permissions existantes sur le serveur ; la clé n'est
  pas limitée à une commande forcée. Les clés hôte proviennent du fichier
  local de confiance utilisé pour la connexion avec vérification stricte.

### Prompt Rovo — documentation générale CI/CD

> Mets à jour uniquement la page Confluence « CI/CD - HACH Kim », sans modifier
> Jira ni ajouter un suivi de tickets. Dans la section des protections GitLab,
> indique les réglages vérifiés le 25/09/2026 : pipeline réussie obligatoire
> avant fusion ; main et develop protégées, fusion par Maintainers, push direct
> et force push interdits ; variables GHCR masquées et protégées. Les paramètres
> DEPLOY_HOST et DEPLOY_USER sont protégés et limités à recette. Le déploiement
> reste désactivé par DEPLOY_RECETTE_ENABLED=false, protégée et globale. Les deux
> variables SSH sont configurées en File, protégées et limitées à recette.
> L'accès SSH dédié a été testé depuis le Mac ; son utilisation par le runner
> reste à valider dans le job réel. Conserve la
> distinction entre tests simulés, déploiement manuel déjà validé et déploiement
> automatisé par CI encore à valider. Préserve le reste de la page.
