# Equilibre — application mobile

Premier incrément FR403-140 : connexion et inscription coach/utilisateur à l’API existante.
React Native + Expo SDK 57, TypeScript, Expo Router et Zustand.

## Démarrer

Depuis la racine :

```bash
pnpm docker:dev
cd mobile
pnpm install
cp .env.example .env
# Adapter EXPO_PUBLIC_API_URL dans .env avant de lancer Expo.
pnpm start
```

L’URL inclut `/api`. Elle est publique et ne doit contenir aucun secret.

| Appareil | Exemple d’URL de développement |
| --- | --- |
| Simulateur iOS sur le Mac | `http://localhost:3000/api` |
| Émulateur Android standard | `http://10.0.2.2:3000/api` |
| Téléphone réel sur le même réseau | `http://IP_LOCALE_DU_MAC:3000/api` |

Pour l’environnement de test, démarrer `pnpm docker:test` à la racine et utiliser le port API configuré (3001 dans le guide). Ne pas confondre le port Expo et le port API. Après modification de l’URL, redémarrer Expo. Utiliser HTTPS pour le déploiement réel.

### Recette principale : iPhone physique

1. Installer Expo Go sur l’iPhone (version compatible SDK 57).
2. Connecter le Mac et l’iPhone au même réseau Wi-Fi.
3. Relever l’adresse IP du Mac dans Réglages Système → Wi-Fi → Détails → TCP/IP.
4. Dans `mobile/.env`, mettre `EXPO_PUBLIC_API_URL=http://IP_DU_MAC:3000/api` (ou le port API choisi).
5. Vérifier `http://IP_DU_MAC:3000/api/health` dans Safari sur l’iPhone : réponse JSON saine attendue.
6. Lancer `pnpm start` depuis `mobile/`, puis scanner le QR code avec l’appareil photo de l’iPhone et ouvrir Expo Go. Autoriser l’accès au réseau local si iOS le demande.
7. Se connecter avec un compte de démonstration existant dans cet environnement.
8. Fermer complètement Expo Go, rouvrir le projet et vérifier la restauration de session ; tester ensuite la déconnexion.

Sur iPhone physique, ne pas utiliser localhost : il désigne l’iPhone. Le tunnel Metro éventuel ne rend pas automatiquement l’API du Mac accessible. Aucun simulateur Android n’est nécessaire. Si Expo Go ne prend pas en charge le SDK, utiliser un development build iOS compatible ; ne pas déclarer la recette native terminée avant ce test.

Installer Expo Go compatible SDK 57 ou un development build adapté. Sur téléphone, `localhost` désigne le téléphone, pas le Mac. Vérifier `/api/health` depuis le navigateur du téléphone en cas d’erreur réseau.

Un compte existant est nécessaire, inscrit via Swagger dans le même environnement. Aucune inscription ni réinitialisation de mot de passe n’est encore proposée par le mobile.

## Session

- Login sur `/auth/login` ; rôle et identifiant fournis par le serveur.
- Session conservée dans Expo SecureStore sur iOS/Android, jamais dans SQLite.
- Mot de passe uniquement dans le formulaire, effacé après connexion réussie.
- Au redémarrage : `/auth/refresh`, puis sauvegarde des nouveaux jetons après rotation.
- Jeton révoqué/expiré : retour au formulaire ; panne réseau : possibilité de réessayer sans effacer la session.
- Logout : révocation serveur, puis suppression locale. Si le réseau échoue, l’écran reste connecté et propose de réessayer.
- L’aperçu web ne conserve la session qu’en mémoire. Il nécessite une configuration CORS adaptée côté API ; ce n’est pas le parcours de validation mobile.
- Le renouvellement automatique lors de futurs appels métier sera raccordé avec le module plans. Cet incrément restaure la session au démarrage.

## Vérification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform ios --platform android
```

Les tests locaux valident les contrats du formulaire et des réponses, pas le rendu natif ou SecureStore. Les tests API continuent de tourner depuis la racine.

### Recette sur téléphone (à exécuter)

| Action | Résultat attendu |
| --- | --- |
| E-mail mal formé ou mot de passe de moins de 8 caractères | Message local ; aucun appel de connexion |
| Identifiants valides de coach | Espace coach et bouton de déconnexion |
| Identifiants valides d’utilisateur | Espace utilisateur |
| Mot de passe incorrect | Message explicite ; formulaire conservé |
| Quota login dépassé | Message invitant à patienter |
| Couper le réseau puis tenter de se connecter | Erreur réseau ; bouton à nouveau utilisable |
| Fermer puis rouvrir l’application après connexion | Restauration via rotation du refresh token |
| Révoquer le refresh token puis rouvrir | Formulaire avec message de session expirée |
| Se déconnecter puis relancer | Formulaire ; aucune restauration de l’ancienne session |

## Suite : FR403-128

Le formulaire de proposition/soumission n’est pas encore implémenté. L’accueil connecté est une transition explicite. La sélection d’un utilisateur rattaché nécessite aussi une API de liste dédiée (absente des routes actuelles) ; ne pas remplacer cette sélection par des utilisateurs fictifs en production.

Sources : [installation Expo Router](https://docs.expo.dev/router/installation/), [SecureStore SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/).

## Inscription et code coach

La page d’accès conserve le logo Equilibre et son slogan, avec les onglets « Connexion » et « Inscription ». L’onglet « Inscription » propose les rôles coach et utilisateur. Pour un utilisateur, le code transmis par son coach est obligatoire (format `EQ-7A9B2C4D`). Après inscription, retour à l’onglet Connexion avec un message de confirmation et l’e-mail prérempli, sans connexion automatique. Les onglets sont désactivés pendant une requête.

L’espace coach affiche son code et le bouton « Copier mon code ». Le code est renvoyé à la connexion et conservé avec la session. Pour une session antérieure à cette fonctionnalité, se déconnecter puis se reconnecter après mise à jour de l’API.

Recette iPhone : connecter un coach, copier son code, se déconnecter, inscrire un utilisateur avec ce code, puis se connecter avec ce nouveau compte. Vérifier aussi le refus d’un code inconnu et d’un e-mail déjà utilisé.
