# Simulateur de balance connectée — FR403-729

Le simulateur est un client externe de l’API. Il ne lit et ne modifie jamais
MongoDB directement : il se connecte avec un compte `utilisateur`, génère un
poids avec `@faker-js/faker`, appelle `POST /api/measurements`, puis révoque sa
session. L’API reste responsable du rattachement au plan, de l’horodatage UTC,
du statut et des conflits journaliers.

## Configuration

```bash
cp simulator/.env.example simulator/.env
pnpm --dir simulator install
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

## Fonctionnement quotidien local

```bash
pnpm simulate:balance:daily
```

Le premier envoi est immédiat, puis le processus attend
`SIMULATOR_INTERVAL_MS` entre deux tentatives. La valeur par défaut est de
24 heures. Le processus s’arrête proprement avec `Ctrl+C`. En production, un
ordonnanceur externe pourrait lancer la commande ponctuelle une fois par jour ;
la fréquence relève du simulateur, pas de l’API.

## Planification sur la recette OVH — FR403-746

En recette, le simulateur ne reste pas actif pendant 24 heures. GitLab publie
une image Docker dédiée, puis le job manuel `deploy:simulator` installe une
tâche cron qui lance chaque jour un conteneur éphémère avec `--once`. Le
conteneur se connecte à l’API sur le réseau Docker privé et disparaît après
l’envoi. Une erreur ou un conflit HTTP 409 n’efface pas la tâche cron : la
prochaine exécution quotidienne aura toujours lieu.

Avant le premier déploiement, créer sur le VPS le fichier protégé suivant :

```bash
cd ~/equilibre-prod
cat > .env.simulator <<'EOF'
SIMULATOR_EMAIL=utilisateur-recette@example.com
SIMULATOR_PASSWORD=a_remplacer
SIMULATOR_BASE_WEIGHT_KG=75
SIMULATOR_MAX_DAILY_VARIATION_KG=0.4
SIMULATOR_MODE=normal
EOF
chmod 600 .env.simulator
```

Le compte doit avoir le rôle `utilisateur` et un plan actif. Il est conseillé
de lui réserver un compte de recette. `SIMULATOR_API_URL` n’est pas nécessaire
sur le VPS : le lanceur force l’adresse interne
`http://equilibre-api:3000/api`. Les identifiants restent sur le serveur et ne
transitent ni dans Git ni dans les artefacts GitLab.

Dans GitLab, ajouter la variable protégée et globale
`DEPLOY_SIMULATOR_ENABLED=true`. Après une fusion dans `develop` ou `main`, la
pipeline publie l’image
`ghcr.io/hachwilliam89-spec/equilibre-balance-simulator` et produit
`simulator-image.ref`. Lancer ensuite manuellement `deploy:simulator`. Le job
transmet par SSH le script d’installation et cette référence par digest ; il
n’envoie pas le dépôt.

Le cron est installé à **06:00, heure configurée sur le serveur**. Contrôles :

```bash
crontab -l
cat ~/equilibre-prod/.simulator-image.release
tail -n 100 ~/equilibre-prod/logs/balance-simulator.log
~/equilibre-prod/run-balance-simulator.sh
```

La dernière commande effectue un envoi immédiat. Si une mesure valide existe
déjà ce jour UTC, le message HTTP 409 confirme que l’API bloque le doublon.
Le conteneur s’exécute en lecture seule, sans capability Linux et avec
`no-new-privileges`. Un verrou `flock` empêche deux exécutions simultanées.

Pour suspendre la planification sans supprimer la configuration, éditer la
crontab avec `crontab -e` et commenter le bloc compris entre :

```text
# BEGIN equilibre-balance-simulator
# END equilibre-balance-simulator
```

Pour la réactiver ou mettre à jour l’image, relancer `deploy:simulator`. Le
script remplace son propre bloc de façon idempotente et conserve le digest
précédent dans `.simulator-image.previous`.

## Tests

```bash
pnpm test:simulator
```

Les tests vérifient la plage normale, le mode suspect, la configuration et la
séquence connexion → mesure automatique → déconnexion sans appeler le réseau.

```bash
pnpm test:deploy:simulator
```

Ce second test vérifie sans connexion distante le digest immuable, le transport
SSH, l’installation idempotente du cron, le maintien de la planification après
une erreur et les options de sécurité du conteneur.
