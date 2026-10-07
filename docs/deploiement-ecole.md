# Déploiement école (évaluation)

Chaîne GitLab de l'UHA, séparée en deux serveurs de l'école comme demandé :

| Rôle | Machine | Détail |
|---|---|---|
| CI | serveur salle 102 (`10.6.0.8`) | runner docker `uha40-salle-102-ci`, tag `uha40-salle-102`, partagé avec la classe |
| Images | GHCR | `ghcr.io/hachwilliam89-spec/equilibre-api`, publiée par digest |
| Déploiement | serveur n°2 (`ubuntu-dev`, `10.6.0.3`) | API sur le port 3000, MongoDB non exposé |

La registry GitLab de l'école (`git.uha4point0.fr:5050`) n'est pas joignable
depuis le réseau du campus (« No route to host ») : les images passent par GHCR.

## Déroulé du job `deploy:ecole`

1. Le job tourne sur le runner de la salle 102, dans un conteneur `alpine`.
2. Il récupère `image.ref` (artefact de `docker:build` de la même pipeline).
3. Il copie `docker-compose.yml` et `docker-compose.ecole.yml` dans
   `~/equilibre-ecole` sur le serveur n°2, en SSH.
4. Il exécute `scripts/deploy-ecole.sh` sur le serveur : téléchargement de
   l'image, `docker compose up --wait`, enregistrement dans `.env.release`.
5. Si l'API ne devient pas saine, l'image de `.env.release` est restaurée et
   le job reste en échec.

Aucun code source ni secret applicatif ne transite : `.env.ecole` est créé une
fois sur le serveur.

## Variables GitLab

| Variable | Type | Protégée | Contenu |
|---|---|---|---|
| `ECOLE_SSH_PRIVATE_KEY` | File | oui | clé privée dédiée au déploiement école |
| `ECOLE_SSH_KNOWN_HOSTS` | File | oui | sortie de `ssh-keyscan -t ed25519 10.6.0.3` |
| `DEPLOY_ECOLE_ENABLED` | Variable | oui | `true` |
| `GHCR_USER`, `GHCR_TOKEN` | Variable | oui (+ masquée pour le jeton) | publication sur GHCR (`write:packages`) |

## Préparation unique du serveur n°2

```bash
mkdir -p ~/equilibre-ecole && cd ~/equilibre-ecole
nano .env.ecole   # modèle : .env.example, secrets générés par openssl rand -hex 32
chmod 600 .env.ecole
```

Les paquets GHCR sont publics : aucun `docker login` n'est nécessaire sur le
serveur.

## Vérifications

- Tests de contrat (Docker simulé) : `bash scripts/test-deploy-ecole.sh`.
- Après déploiement : `curl -s http://10.6.0.3:3000/api/health` depuis le campus.
