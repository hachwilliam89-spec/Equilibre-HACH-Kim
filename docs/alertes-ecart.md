# Alertes d’écart persistant — US5 (FR403-964)

Le coach est averti quand un utilisateur s’écarte durablement de son plan, sur
le poids ou sur les calories. Il peut alors ajuster le plan actif sans le
recréer. Une alerte n’est pas stockée : elle est calculée à chaque lecture à
partir du suivi et disparaît d’elle-même.

## Règle commune

Une alerte apparaît après **3 valeurs valides consécutives hors tolérance**,
pour chaque métrique indépendamment. La première valeur dans la tolérance
interrompt la série ; l’alerte disparaît alors à la lecture suivante.

| Métrique | Valeur prise en compte | Hors tolérance | Ignorée (ni comptée, ni interruptrice) |
| --- | --- | --- | --- |
| Poids | Pesée `valide` du plan actif | écart à la trajectoire > 1 kg, en plus ou en moins | pesée `suspecte` ou `hors-plan` |
| Calories | Journée UTC clôturée (avant aujourd’hui) du plan actif | total > budget du jour + 150 kcal | journée sans entrée, journée en cours |

Les tolérances sont celles déjà affichées à l’utilisateur (± 1 kg de l’US2,
+ 150 kcal de l’US3). Le budget de comparaison est celui enregistré dans le
journal du jour.

Exemple : pesées valides à +1,5 kg, +1,6 kg, une pesée suspecte, puis +1,4 kg :
l’alerte « poids » apparaît à la troisième valeur valide. Si la pesée
suivante est à +0,4 kg, l’alerte disparaît.

## Ajustement du plan

`PATCH /api/plans/:id` (coach rattaché) modifie le poids cible, la date cible
et/ou le budget calorique du plan **actif**. Le poids de départ, la date de
début et le niveau d’activité ne changent pas.

| Règle | Comportement |
| --- | --- |
| Mêmes règles qu’à la création | IMC cible ≥ 18,5, rythme ≤ 1 kg/semaine en perte et ≤ 0,5 kg/semaine en prise, date cible après le début : sinon 400 `invalid-plan` |
| Date cible passée | 400 `invalid-plan` |
| Budget saisi | Conservé tel quel |
| Budget non saisi, objectif modifié | Recalculé comme à la création ; profil sans âge ou sexe : 400 `incomplete-metabolic-profile` (le coach saisit le budget) |
| Plan non actif ou expiré | 409 `plan-not-active` |
| Accès | 401 sans jeton, 403 rôle utilisateur ou coach non rattaché, 404 plan inconnu |
| Modification simultanée | 409 `plan-concurrent-update` (verrou de version du suivi) |
| Réinitialisation | Objectif modifié : `poidsAjusteLe` ; budget modifié : `budgetAjusteLe`. Seules les valeurs postérieures comptent ensuite pour la métrique concernée |

Pour les calories, la série repart des journées postérieures au jour de
l’ajustement : la journée de l’ajustement, commencée avec l’ancien budget,
n’est pas comptée.

## API

| Route | Accès | Réponse |
| --- | --- | --- |
| `GET /api/coach/alerts` | coach | 200 : utilisateurs rattachés ayant au moins une alerte, `{ id, email, prenom, nom, …, alertes }` |
| `GET /api/coach/clients` | coach | champ `alertes` sur chaque utilisateur (vide sans plan ou sans alerte) |
| `GET /api/coach/clients/:userId` | coach rattaché | champ `alertes` |
| `PATCH /api/plans/:id` `{ poidsCible?, dateCible?, budgetCalorique? }` | coach rattaché | 200 plan ajusté · 400 · 401 · 403 · 404 · 409 |

Une alerte : `{ metrique: "poids" | "calories", serie, depuis, derniere: { jourUtc, ecart, horsTolerance } }`.
`ecart` est en kg pour le poids, en kcal pour les calories.

## Stockage

Aucune collection ni champ d’alerte. Le plan embarqué dans `suivis` reçoit
deux dates facultatives, `poidsAjusteLe` et `budgetAjusteLe`. Les documents
existants restent valides sans migration.

## Application mobile (coach)

- **Liste** : section « Écart persistant » en tête, avant « À surveiller ».
  Chaque carte concernée porte le libellé « ÉCART PERSISTANT » (la priorité ne
  repose pas sur la seule couleur) et l’action « Ajuster le plan ». Un écart
  persistant remplace l’écart ponctuel de la même métrique.
- **Fiche** : bandeau « Écart persistant » (onglet Poids pour les deux
  métriques, onglet Alimentation pour les calories) avec le bouton « Ajuster le
  plan ».
- **Ajustement** : formulaire prérempli (poids cible, date cible, budget), mêmes
  contrôles qu’à la création, récapitulatif des changements et confirmation
  avant l’envoi. Seuls les champs modifiés sont envoyés ; un budget laissé tel
  quel est recalculé par l’API si l’objectif change. Les erreurs métier de
  l’API sont affichées telles quelles.

## Tests

| Niveau | Fichier |
| --- | --- |
| Unitaires API | `coaching/domain/services/ecart-persistant.spec.ts`, `coaching/application/use-cases/get-client-progression.use-case.spec.ts`, `coaching/application/use-cases/get-coach-alerts.use-case.spec.ts`, `plans/domain/entities/plan.entity.spec.ts`, `plans/application/use-cases/update-plan.use-case.spec.ts` |
| Intégration API (MongoDB réel) | `test/alertes-ecart.integration-spec.ts` |
| Mobile | `mobile/tests/coaching.test.ts`, `mobile/tests/plan-form.test.ts` |
