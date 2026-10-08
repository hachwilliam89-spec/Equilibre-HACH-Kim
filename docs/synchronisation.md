# Page 9 — Synchronisation

L’application mobile embarque une base **SQLite** (`expo-sqlite`) synchronisée
**dans les deux sens** avec MongoDB. L’utilisateur consulte son suivi, ajoute ou
retire des aliments, saisit son poids de secours et gère ses favoris **même sans
réseau** ; les modifications partent dès que la connexion revient.

Jira : tâche [FR403-767](https://uha4point0.atlassian.net/browse/FR403-767)
(synchronisation), au service de [US2 — suivi du poids](https://uha4point0.atlassian.net/browse/FR403-668)
et [US3 — suivi de l’alimentation](https://uha4point0.atlassian.net/browse/FR403-747).

## 1. Principes

| Principe | Mise en œuvre |
| --- | --- |
| Strict nécessaire | La base locale ne contient que ce que l’utilisateur voit à l’écran (voir §2). Le référentiel complet des aliments n’est pas copié. |
| Le serveur fait autorité | Toute modification locale est rejouée par l’API **avec les mêmes règles métier** que les routes en ligne. Ce que le serveur refuse est retiré de l’appareil et expliqué à l’utilisateur. |
| Lecture locale d’abord | Les écrans lisent uniquement la base embarquée : affichage immédiat, hors ligne compris. |
| Écriture locale d’abord | Une action écrit dans une file d’attente locale (*outbox*) puis déclenche une synchronisation. |
| Idempotence | Les identifiants (opération, entrée alimentaire, mesure) sont générés sur l’appareil (UUID v4). Rejouer une opération déjà traitée ne crée pas de doublon. |
| Échanges minimaux | 1 requête par cycle : `push` renvoie l’instantané à jour ; sans modification, `pull` renvoie **204 sans corps** si rien n’a changé (curseur). |

Le rôle **coach** reste en ligne : il prépare des plans et ne saisit pas de suivi.

## 2. Données embarquées

| Donnée | Pourquoi elle est sur l’appareil | Origine | Visible par | Conservée |
| --- | --- | --- | --- | --- |
| Plan actif + statut de suivi du poids (attendu, écart) | Écran « Mon suivi de poids » | serveur | l’utilisateur connecté | jusqu’au prochain instantané |
| Mesures des 3 derniers mois | Historique et courbe | serveur | l’utilisateur connecté | fenêtre glissante de 3 mois |
| Budget calorique et cibles de macros | Journal et budget du jour | serveur | l’utilisateur connecté | jusqu’au prochain instantané |
| Journaux alimentaires d’**aujourd’hui et d’hier** (UTC) | Journal du jour ; le statut alimentaire ne regarde pas plus loin qu’hier | serveur | l’utilisateur connecté | fenêtre glissante J et J-1 |
| Aliments favoris | Ajout rapide hors ligne | serveur | l’utilisateur connecté | jusqu’au retrait du favori |
| 8 aliments récents | Ajout rapide hors ligne | appareil uniquement | l’utilisateur connecté | les 8 derniers utilisés |
| Modifications en attente | File d’envoi | appareil uniquement | l’utilisateur connecté | jusqu’à acceptation, refus ou 5 tentatives |

Toutes ces données sont effacées à la déconnexion. Le rôle coach n’a aucune
donnée embarquée.

Ne sont **pas** embarqués : le référentiel d’aliments (recherche en ligne), les
journaux plus anciens, les données des autres utilisateurs, les jetons (stockés
dans SecureStore, jamais dans SQLite). À la déconnexion, la base est vidée ; à
la connexion d’un autre compte, elle est effacée.

### Schéma SQLite (version 1, migration par `PRAGMA user_version`)

```plantuml
@startuml
hide circle
skinparam linetype ortho
entity meta {
  * cle : TEXT <<PK>>
  valeur : TEXT
  --
  user_id, curseur, synchronise_le
}
entity plan_actif {
  * id : TEXT <<PK>>
  poids_depart, poids_cible : REAL
  date_debut, date_cible : TEXT
  budget_calorique : REAL
  statut_suivi : TEXT
  poids_attendu, ecart_kg : REAL
  cible_proteines_g, cible_glucides_g, cible_lipides_g : REAL
}
entity mesures {
  * id : TEXT <<PK>>
  plan_id, recu_le, jour_utc, source, statut : TEXT
  poids_kg : REAL
}
entity journaux {
  * plan_id : TEXT <<PK>>
  * jour_utc : TEXT <<PK>>
  budget_calorique : REAL
}
entity entrees_alimentaires {
  * id : TEXT <<PK>>
  plan_id, jour_utc : TEXT <<FK>>
  food_id, nom, categorie_repas, recu_le : TEXT
  quantite_g, calories_kcal, proteines_g, glucides_g, lipides_g : REAL
}
entity aliments {
  * id : TEXT <<PK>>
  nom, categorie : TEXT
  valeurs pour 100 g : REAL
  favori : INTEGER
  utilise_le : TEXT
}
entity operations_en_attente {
  * id : TEXT <<PK>>
  type : TEXT
  charge : TEXT (JSON)
  cree_le : TEXT
  tentatives : INTEGER
}
journaux ||--o{ entrees_alimentaires
plan_actif ||--o{ journaux
plan_actif ||--o{ mesures
@enduml
```

Les tables issues du serveur sont **remplacées** à chaque instantané reçu. Les
modifications en attente ne sont jamais écrites dedans : la vue affichée est
calculée à la lecture (`projection.ts`) = dernier état serveur + opérations en
file. Recevoir un instantané ne fait donc jamais disparaître une saisie pas
encore envoyée.

## 3. API de synchronisation

Routes réservées au rôle `utilisateur` (JWT). L’utilisateur vient toujours du
jeton, jamais du corps de la requête.

| Route | Rôle | Réponses |
| --- | --- | --- |
| `GET /api/sync/me?curseur=…` | **Pull** : instantané du strict nécessaire | `200` instantané · `204` rien n’a changé · `401` · `403` |
| `POST /api/sync/me/operations` | **Push** : rejoue jusqu’à 100 opérations dans l’ordre | `200` `{ resultats, instantane }` · `400` lot invalide · `401` · `403` |

Le **curseur** est une empreinte SHA-256 du contenu de l’instantané et du jour
UTC : un statut qui dépend de la date (« pas de données récentes ») change
aussi le curseur.

### Opérations rejouées

| Type | Champs | Règle appliquée par le serveur |
| --- | --- | --- |
| `ajout-aliment` | `entreeId`, `foodId`, `quantiteGrammes`, `categorieRepas?`, `consommeLe` | Même calcul que l’ajout en ligne. L’heure de consommation de l’appareil est retenue (repas d’hier soir saisi hors ligne → journal d’hier) si elle n’est ni dans le futur (tolérance 5 min), ni plus vieille que 7 jours, ni hors de la période du plan. |
| `retrait-aliment` | `entreeId` | Recalcul des totaux. Entrée introuvable = déjà retirée. |
| `saisie-poids` | `mesureId`, `poidsKg`, `saisiLe` | Saisie de secours **du jour** : refusée si elle arrive un autre jour UTC ou si une mesure valide existe déjà ce jour. Horodatée par le serveur à la réception. |
| `favori` | `foodId`, `favori` | Ajout/retrait idempotent. |

### Résultat par opération

| Statut | Signification | Action de l’appareil |
| --- | --- | --- |
| `appliquee` | Enregistrée | Retire l’opération de la file |
| `deja-appliquee` | Rejeu d’une opération déjà traitée (réponse perdue) | Retire l’opération |
| `rejetee` | Refus métier définitif (`code` + `message`) | Retire et explique à l’utilisateur |
| `a-reessayer` | Conflit de concurrence ou erreur transitoire | Garde ; abandon après 5 tentatives |

## 4. Déclenchement

- ouverture de l’espace utilisateur (après restauration de la session, **même
  hors ligne** : la session enregistrée est reprise sans attendre le réseau) ;
- retour de l’application au premier plan ;
- après chaque modification locale ;
- toutes les 2 minutes tant que l’application est ouverte ;
- bouton « Synchroniser » / « Actualiser ».

Un seul cycle à la fois ; une modification faite pendant un cycle relance un
cycle juste après. Avant la déconnexion, une dernière synchronisation est
tentée ; s’il reste des modifications non envoyées, l’utilisateur est prévenu
et doit confirmer.

## 5. Conflits

| Situation | Résolution |
| --- | --- |
| Même opération envoyée deux fois (réseau coupé avant la réponse) | Identifiants client → `deja-appliquee`, aucun doublon |
| Aliment ajouté puis retiré hors ligne, avant envoi | Les deux opérations s’annulent sur l’appareil, rien n’est envoyé |
| Favori basculé plusieurs fois hors ligne | Seul le dernier choix est envoyé |
| Balance et saisie manuelle le même jour | Règle « une mesure valide par jour » : la saisie hors ligne est rejetée et l’utilisateur en est informé |
| Deux écritures simultanées sur le même suivi | Verrou optimiste (`version` du document `suivis`) côté serveur, nouvel essai automatique puis `a-reessayer` |
| Donnée modifiée ailleurs (autre appareil, balance) | Le prochain instantané remplace la copie locale |

### Suppressions

| Sens | Règle |
| --- | --- |
| Appareil → serveur | Retirer un aliment hors ligne crée une opération `retrait-aliment` dans la file. L’entrée disparaît de l’écran, mais l’opération reste jusqu’à la réponse du serveur. Si l’entrée n’avait pas encore été envoyée, l’ajout et le retrait s’annulent sur l’appareil. Retirer un favori envoie `favori` à `false`. Les mesures de poids ne se suppriment pas (historique conservé, règles de l’US2). |
| Serveur → appareil | Pas de marqueur de suppression : chaque instantané contient **tout** le périmètre embarqué et remplace les tables serveur dans une transaction. Un élément absent de l’instantané disparaît de l’appareil : entrée retirée depuis un autre appareil, favori retiré, journal sorti de la fenêtre J/J-1, mesure de plus de 3 mois. Il n’y a donc aucun marqueur à nettoyer. |

Coût de ce choix : un instantané reste petit (2 journaux, environ 90 mesures,
les favoris) et le curseur évite tout transfert quand rien n’a changé (`204`).

## 6. Diagrammes de séquence

### 6.1 Ajout d’un aliment hors ligne puis retour du réseau

```plantuml
@startuml
actor Utilisateur
participant "Écran journal" as UI
participant "useSync\n(moteur)" as Sync
database "SQLite\n(appareil)" as DB
participant "API NestJS\n/sync" as API
participant "AddFoodEntryUseCase" as UC
database MongoDB

Utilisateur -> UI : Ajouter « Riz 200 g, dîner »
UI -> Sync : ajouterAliment(aliment, 200, diner)
Sync -> DB : INSERT operations_en_attente\n(id, entreeId UUID, consommeLe)
Sync -> DB : lire état serveur + file
Sync --> UI : vue = serveur + opération en attente
UI --> Utilisateur : entrée affichée « en attente », total recalculé
Sync -> API : POST /sync/me/operations
API -x Sync : erreur réseau
Sync --> UI : « Hors ligne · 1 modification en attente »

== Le réseau revient (premier plan, minuterie ou bouton) ==

Sync -> DB : SELECT operations_en_attente
Sync -> API : POST /sync/me/operations\n{ operations: [ajout-aliment] }
API -> UC : executeDepuisSynchro(userId du JWT, entrée)
UC -> UC : fenêtre (futur, 7 jours, période du plan)
UC -> MongoDB : charger suivi ; entreeId déjà présente ?
UC -> MongoDB : updateOne si version inchangée
UC --> API : appliquée
API -> MongoDB : lecture du strict nécessaire
API --> Sync : 200 { resultats: [appliquee], instantane }
Sync -> DB : DELETE opération ; remplacer tables serveur (transaction)
Sync --> UI : vue à jour
UI --> Utilisateur : « Synchronisé à 14:32 »
@enduml
```

### 6.2 Pull sans modification locale

```plantuml
@startuml
participant "useSync" as Sync
database "SQLite" as DB
participant "API /sync" as API
database MongoDB

Sync -> DB : file vide ? curseur ?
Sync -> API : GET /sync/me?curseur=abc
API -> MongoDB : suivi, mesures, journaux J et J-1, favoris
API -> API : empreinte du contenu + jour UTC
alt empreinte = curseur
  API --> Sync : 204 No Content
  Sync -> DB : synchronise_le = maintenant
else contenu modifié (balance, autre appareil, nouveau jour)
  API --> Sync : 200 instantané + nouveau curseur
  Sync -> DB : remplacer tables serveur (transaction)
end
@enduml
```

### 6.3 Saisie de poids hors ligne refusée

```plantuml
@startuml
actor Utilisateur
participant "useSync" as Sync
database "SQLite" as DB
participant "API /sync" as API
participant "CorrectMeasurementUseCase" as UC
database MongoDB

Utilisateur -> Sync : saisirPoids(79,4) — hors ligne
Sync -> DB : INSERT opération saisie-poids
note over MongoDB : entre-temps, la balance\nenvoie une mesure valide
Sync -> API : POST /sync/me/operations
API -> UC : executeDepuisSynchro
UC -> MongoDB : mesure valide déjà présente ce jour
UC --> API : 409 measurement-day-conflict
API --> Sync : { statut: rejetee, code: measurement-day-conflict }
Sync -> DB : DELETE opération ; remplacer tables serveur
Sync --> Utilisateur : « Ton poids saisi (79,4 kg) n’a pas été retenu :\nune mesure valide existait déjà ce jour-là. »
@enduml
```

## 7. Organisation du code

### API (`api/src/sync`, module d’orchestration hexagonal)

| Fichier | Rôle |
| --- | --- |
| `domain/operation-synchro.ts` | Types des opérations et des résultats |
| `application/use-cases/get-sync-snapshot.use-case.ts` | Compose les use cases existants (suivi du poids, historique, budget, favoris) |
| `application/use-cases/apply-sync-operations.use-case.ts` | Rejoue chaque opération via le use case métier correspondant et classe le résultat |
| `infrastructure/http/sync.controller.ts`, `sync.dto.ts` | Routes, validation Zod, curseur, Swagger |
| `nutrition/domain/services/saisie-differee.ts` | Fenêtre d’acceptation d’une entrée hors ligne |
| `measurements/domain/services/saisie-differee-poids.ts` | Saisie de poids hors ligne : même jour uniquement |

Aucune règle métier n’est dupliquée : `AddFoodEntryUseCase` et
`CorrectMeasurementUseCase` exposent une variante `executeDepuisSynchro`
(identifiant client, idempotence) qui partage le reste de leur code.

### Mobile (`mobile/src/sync`)

| Fichier | Rôle |
| --- | --- |
| `local-store.ts` | Port de la base embarquée |
| `sqlite-store.ts` | Adaptateur SQLite : schéma, migration, requêtes |
| `memory-store.ts` | Adaptateur mémoire pour l’aperçu web (aucune donnée persistée dans le navigateur) |
| `projection.ts` | Vue = état serveur + file ; règle de statut alimentaire reprise du serveur |
| `engine.ts` | Cycle push/pull, lots de 100, gestion des rejets et des tentatives |
| `useSync.ts` | État Zustand, actions des écrans, annulation locale des opérations non envoyées |
| `SyncStatus.tsx`, `presentation.ts` | Bandeau d’état et explication des refus |

## 8. Tests

| Niveau | Fichier | Couvre |
| --- | --- | --- |
| Unitaires API | `saisie-differee*.spec.ts`, `add-food-entry.use-case.spec.ts`, `apply-sync-operations.use-case.spec.ts`, `sync.dto.spec.ts` | Fenêtres temporelles, idempotence, classification des résultats, curseur, validation |
| HTTP API | `sync.controller.spec.ts` | 401/403, 200 puis 204 avec curseur, conversion des dates, 400, Swagger |
| Intégration API (MongoDB réel, sans mock) | `test/sync.integration-spec.ts` | Pull, push, rejeu sans doublon, refus métier, état final de la base |
| Mobile | `src/sync/tests/*.test.ts` | Contrat identique des adaptateurs SQLite (vrai SQL via sql.js) et mémoire, projection, moteur, store |

```bash
pnpm test                       # unitaires API
pnpm test:e2e:local             # intégration (MongoDB de test démarré)
pnpm --dir mobile test          # mobile
```

### Recette sur iPhone

**Jeu de données fictif** : un compte utilisateur de démonstration avec un plan
actif créé par le coach (80 → 75 kg sur 30 jours, budget 1 800 kcal), au moins
une mesure envoyée par le simulateur de balance, et l’aliment « Riz blanc cuit »
(130 kcal pour 100 g) en favori. Aucune donnée personnelle réelle.

**Modification côté serveur** : depuis Swagger (`/api/docs`), connecté avec le
même compte, `POST /api/food-journals/me/entries` ajoute une entrée sans passer
par le téléphone. Le simulateur de balance peut aussi envoyer une mesure.

La colonne « Observé » se remplit pendant la recette (date, OK ou KO, remarque).

| # | Action | Résultat attendu | Observé |
| --- | --- | --- | --- |
| 1 | Se connecter, ouvrir le suivi | « Synchronisé à hh:mm » | |
| 2 | Activer le mode Avion, rouvrir l’app | Session reprise, données affichées, bandeau « Hors ligne » | |
| 3 | Ajouter « Riz blanc cuit 200 g » hors ligne | Entrée visible « en attente », total +260 kcal, statut recalculé | |
| 4 | Fermer complètement l’app, la rouvrir toujours hors ligne | L’entrée et l’opération en attente sont toujours là | |
| 5 | Ajouter puis retirer un aliment hors ligne | Rien en attente pour cet aliment | |
| 6 | Désactiver le mode Avion | Bandeau « Synchronisé », entrée confirmée ; visible dans MongoDB (collection `suivis`) | |
| 7 | Couper le réseau pendant l’envoi (mode Avion juste après l’ajout), puis le rétablir | Une seule entrée dans MongoDB, aucun doublon | |
| 8 | Ajouter une entrée depuis Swagger, puis « Actualiser » sur le téléphone | L’entrée apparaît ; toujours présente après fermeture et réouverture hors ligne | |
| 9 | Retirer cette entrée depuis Swagger (`DELETE /api/food-journals/me/entries/{id}`), puis « Actualiser » | L’entrée disparaît du téléphone | |
| 10 | « Actualiser » sans aucun changement | Réponse `204` côté API, rien de dupliqué ni d’effacé | |
| 11 | Saisir un poids hors ligne alors que la balance a déjà envoyé une mesure valide | Message de refus explicite, la mesure de la balance est conservée | |
| 12 | Se déconnecter avec des modifications en attente | Avertissement, confirmation demandée | |
| 13 | Se connecter avec un autre compte | Aucune donnée du compte précédent | |

## 9. Limites connues

- **Abandon après 5 tentatives** : une opération qui reçoit 5 fois `a-reessayer` est retirée de la file et l’utilisateur en est informé ; elle n’est pas rejouée ensuite.
- **Historique alimentaire** : seuls les journaux d’aujourd’hui et d’hier sont consultables hors ligne.
- **Recherche d’aliments** : impossible hors ligne (le référentiel n’est pas embarqué) ; l’ajout hors ligne passe par les favoris et les aliments récents.
- **Poids hors ligne** : accepté seulement s’il arrive le jour même (UTC) et qu’aucune mesure valide n’existe déjà ce jour-là.
- **Instantané complet** : adapté au petit périmètre d’un utilisateur ; un volume plus grand demanderait des changements paginés par curseur.
- **Aperçu web** : l’adaptateur mémoire ne persiste rien ; la synchronisation hors ligne se démontre sur téléphone.
- **Coach** : aucune donnée hors ligne, toutes ses actions passent en ligne.
