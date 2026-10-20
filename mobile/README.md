# Equilibre — application mobile

Application coach et utilisateur du fil rouge Equilibre : inscription,
plans de perte de poids, suivi du poids, journal alimentaire hors ligne et
suivi des utilisateurs par leur coach.
React Native + Expo SDK 57, TypeScript, Expo Router, Zustand et `expo-sqlite`.

## Fonctionnalités

| Espace | Écran | Ce qu’il permet |
| --- | --- | --- |
| Accès | Connexion / Inscription | Onglets sur la même page ; inscription coach, ou utilisateur avec le code de son coach (`EQ-7A9B2C4D`) ; prénom et nom demandés |
| Utilisateur | Suivi | Courbe du poids (trajectoire cible et pesées valides), budget du jour, saisie de poids de secours |
| Utilisateur | Journal | Entrées, total calorique et macros d’une journée ; sélection des 7 derniers jours ; ajout depuis la bibliothèque, récents ou favoris |
| Utilisateur | Profil | Prénom, nom, taille, âge, sexe ; coach rattaché affiché par son nom |
| Coach | Utilisateurs | Liste des utilisateurs rattachés, affichés par prénom et nom |
| Coach | Fiche utilisateur | Onglets Plan, Suivi (courbe, alertes, dernières pesées) et Alimentation (barres des derniers jours) ; création et annulation de plan |
| Coach | Mon compte | Identité du coach, code coach et bouton « Copier mon code » |

La déconnexion est visible dans la barre haute de chaque écran connecté ; les
actions destructives (retrait, annulation de plan, déconnexion) passent par
une boîte de confirmation aux couleurs de l’application.

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

Sur téléphone, `localhost` désigne le téléphone, pas le Mac : vérifier
`/api/health` depuis le navigateur du téléphone en cas d’erreur réseau. Pour
l’environnement de test, démarrer `pnpm docker:test` à la racine et utiliser le
port API 3001. Après modification de l’URL, redémarrer Expo.

Sur iPhone physique : installer Expo Go (SDK 57), mettre le Mac et l’iPhone sur
le même Wi-Fi, renseigner `EXPO_PUBLIC_API_URL=http://IP_DU_MAC:3000/api`,
lancer `pnpm start` puis scanner le QR code. `expo-sqlite`, `expo-crypto` et les
sélecteurs natifs sont inclus dans Expo Go : aucun development build n’est
nécessaire.

## Session

Voir [le cycle de connexion documenté](../docs/login.md), y compris la réponse
de renouvellement perdue et la conservation des saisies après expiration.

- Connexion sur `/auth/login` ; rôle, identifiant et identité fournis par le serveur.
- Jetons conservés dans Expo SecureStore sur iOS/Android, jamais dans SQLite ;
  l’aperçu web les garde en mémoire uniquement.
- Session glissante de 30 jours : chaque renouvellement (`/auth/refresh`)
  remplace le refresh token et repousse l’échéance. Les requêtes concurrentes
  partagent un seul renouvellement après un 401.
- Hors ligne au démarrage, la session enregistrée ouvre la base embarquée ; le
  jeton est renouvelé à la première requête réseau.
- Jeton révoqué ou expiré : retour au formulaire avec « Session expirée » ;
  panne réseau : la session est conservée et l’action peut être réessayée.
- Déconnexion : révocation serveur puis suppression locale, et retour immédiat
  à la page d’accès.

## Synchronisation et mode hors ligne

Les données de l’utilisateur sont copiées dans une base SQLite
(`expo-sqlite`) et synchronisées dans les deux sens avec l’API (`/api/sync`).
Ajouts et retraits d’aliments, saisie de poids de secours et favoris
fonctionnent sans réseau : chaque modification est appliquée localement et
placée dans une file d’attente. À la synchronisation (retour au premier plan,
modification, toutes les 2 minutes, bouton « Actualiser »), le serveur renvoie
le résultat de chaque opération et un instantané ; l’acquittement des
opérations et le remplacement de l’état serveur sont écrits dans une seule
transaction SQLite. Le serveur garde une trace des entrées retirées : un ajout
rejoué après un retrait ne recrée pas l’entrée.

Un bandeau indique l’état (« Synchronisé à… », « Hors ligne · 2 modifications
en attente ») et explique les modifications refusées. La recherche dans la
bibliothèque reste en ligne : hors ligne, utiliser « Récents » ou « Favoris ».
Détails, schéma et diagrammes : [Page 9 — Synchronisation](../docs/synchronisation.md).

## Journal alimentaire — US3

L’écran Journal ouvre la journée UTC en cours : entrées, total calorique,
macros et statut (même règle que l’API, recalculée sur l’appareil pour rester
juste hors ligne). « Ajouter » interroge la bibliothèque, affiche les valeurs
pour 100 g puis estime celles de la quantité saisie (de 1 à 10 000 g). Une
entrée se modifie ou se retire, avec confirmation.

Une rangée de pastilles permet de consulter les 7 derniers jours (FR403-754) :

| Journée | Source | Modification |
| --- | --- | --- |
| Aujourd’hui | base embarquée, hors ligne compris | oui |
| Hier | base embarquée, hors ligne compris | lecture seule |
| J-2 à J-6 | `GET /api/food-journals/me/days/:jourUtc`, en ligne | lecture seule |

Une journée passée est affichée avec le budget enregistré dans son journal.
Hors ligne, une journée ancienne affiche un message et un bouton « Réessayer ».
Sans plan actif, le journal affiche un message dédié. La
[recette US3](../docs/recette-us3.md) détaille les scénarios à vérifier.

## Activité physique — US4

L’onglet Suivi affiche une carte « Activité · 7 derniers jours » : moyenne de
pas, niveau déduit et pas des derniers jours, transmis par la montre simulée.
Elle est chargée en ligne (`GET /api/activity/me`) ; hors ligne, un message et
un bouton « Réessayer » la remplacent. Côté coach, le formulaire de plan
présélectionne le niveau déduit des 7 derniers jours ; sans 7 jours de pas, le
choix reste manuel. Détails : [activité physique](../docs/activite-physique.md).

## Alertes d’écart persistant — US5

La liste du coach ouvre sur une section « Écart persistant » : utilisateurs
ayant 3 pesées valides ou 3 journées clôturées consécutives hors tolérance.
Chaque carte porte un libellé texte en plus de la couleur. La fiche affiche un
bandeau avec le bouton « Ajuster le plan » : formulaire prérempli (poids cible,
date cible, budget), contrôles de la création, récapitulatif et confirmation,
puis `PATCH /api/plans/:id`. Détails : [alertes d’écart](../docs/alertes-ecart.md).

## Parcours coach

« Utilisateurs » liste les comptes rattachés au coach (`GET /api/users/me/clients`).
La fiche d’un utilisateur (`GET /api/coach/clients/:userId`) présente trois
onglets :

- **Plan** : plan actif ou création en deux étapes — objectifs (poids, dates,
  IMC et rythme indicatifs), puis activité, proposition de budget
  (`POST /api/plans/preview`, sans enregistrement) et validation
  (`POST /api/plans`, qui revalide les règles). Le plan peut être ajusté
  (US5) ou annulé après confirmation.
- **Suivi** : courbe du poids, alertes d’écart et dernières pesées sur 3 mois.
- **Alimentation** : barres des calories des derniers jours face au budget.

La taille est obligatoire ; sans âge ou sexe, le budget est saisi manuellement.

Les graphiques (`src/charts`, `react-native-svg`) ne font aucune requête : ils
reçoivent des données déjà chargées. Une ligne pointillée entre deux pesées
signale des jours sans mesure, sans inventer de valeur ; la dernière valeur est
aussi écrite en texte pour ne pas dépendre de la couleur.

## Sélecteurs de dates, taille et poids

Les dates se choisissent dans le calendrier natif (champ date sur le Web),
affichées en JJ/MM/AAAA et transmises en AAAA-MM-JJ. Les poids se sélectionnent
au dixième de kilogramme et la taille au centimètre ; « Saisir au clavier »
permet une saisie directe et annuler un sélecteur conserve la valeur
précédente.

## Vérification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec expo export --platform ios --platform android
```

Les tests Jest couvrent les formulaires, les contrats de réponse, le
renouvellement de session, le moteur de synchronisation et la base locale :
les mêmes tests de contrat tournent sur l’adaptateur mémoire et sur le vrai SQL
(sql.js), y compris l’annulation d’une transaction et la persistance du
fichier après fermeture. Ils ne remplacent pas la recette visuelle sur
téléphone.

### Recette sur téléphone

| Action | Résultat attendu |
| --- | --- |
| Inscrire un utilisateur avec le code d’un coach | Retour à Connexion, e-mail prérempli |
| Code coach inconnu ou e-mail déjà utilisé | Message explicite, formulaire conservé |
| Connexion coach puis utilisateur | Espace correspondant, nom affiché |
| Mode avion : ajouter puis retirer un aliment | Journal à jour, bandeau « en attente » |
| Réseau rétabli | Bandeau « Synchronisé à… », données identiques côté coach |
| Pastille J-3 en ligne, puis hors ligne | Journal en lecture seule, puis message et « Réessayer » |
| Fermer puis rouvrir l’application | Session restaurée sans saisie |
| Se déconnecter | Retour immédiat à la page d’accès |

Sources : [Expo Router](https://docs.expo.dev/router/installation/),
[SecureStore SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/),
[SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/).

## Générer l’APK Android (EAS Build)

L’APK est construit dans le cloud par EAS Build à partir de `eas.json` : la
configuration est versionnée, le build est reproductible et ne dépend pas d’un
poste équipé d’Android Studio.

| Profil | Sortie | Usage |
| --- | --- | --- |
| `preview` | `.apk` installable directement | démo, formateur, tests sur téléphone |
| `production` | `.aab` | publication sur le Play Store (non utilisée pour l’instant) |

Les deux profils pointent l’application vers l’API de recette en HTTPS
(`https://equilibre.164-132-246-49.sslip.io/api`), joignable depuis n’importe quel
réseau. Le numéro de version Android (`versionCode`) est géré par EAS et
incrémenté à chaque build (`appVersionSource: remote`).

Première fois (une seule fois, depuis `mobile/`) :

```bash
pnpm dlx eas-cli login
pnpm dlx eas-cli init        # crée le projet Expo et ajoute son identifiant dans app.json
```

Construire l’APK :

```bash
pnpm dlx eas-cli build --platform android --profile preview
```

À la fin du build, EAS affiche un lien et un QR code de téléchargement de
l’APK. Sur Android, autoriser l’installation depuis cette source puis ouvrir
le fichier.

L’identifiant Android de l’application est `dev.wkhach.equilibre`. Il ne doit
plus changer une fois l’application installée chez quelqu’un : un autre
identifiant serait considéré comme une autre application.

## Mises à jour à distance (EAS Update)

L’application embarque `expo-updates` : une modification du code JavaScript
(écrans, logique, textes) est publiée sans nouvel APK. L’application télécharge
la mise à jour au démarrage et l’applique au lancement suivant.

```bash
pnpm dlx eas-cli update --channel preview --environment preview --message "fix: ..."
```

- `--channel preview` vise les APK construits avec le profil `preview`.
- `--environment preview` prend `EXPO_PUBLIC_API_URL` dans les variables EAS
  (sinon le `.env` local, qui pointe sur `localhost`, serait embarqué).
- `runtimeVersion` suit la politique `fingerprint` : une mise à jour n’est
  envoyée qu’aux APK dont le code natif est identique. Après l’ajout d’une
  bibliothèque native, d’une permission ou un changement de version d’Expo, il
  faut reconstruire l’APK (`eas build`) au lieu de publier une mise à jour.
