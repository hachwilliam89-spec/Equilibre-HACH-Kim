# Journal alimentaire quotidien — modèle (FR403-749)

Le journal alimentaire est imbriqué dans le document `suivis` de l'utilisateur.
Il ne crée pas de collection supplémentaire. Un journal correspond à un plan
et à un jour civil UTC. Lors de sa création, il copie le budget calorique du
plan actif afin de conserver la cible applicable à cette journée.

Chaque entrée porte un UUID, l'aliment choisi, sa quantité en grammes et
l'horodatage de réception fourni par le serveur. Le nom et les valeurs pour
100 g de l'aliment sont copiés dans l'entrée : une évolution ultérieure du
référentiel ne change donc pas les journées déjà consignées. L'application
calcule les calories et macronutriments consommés selon
`valeur pour 100 g × quantité / 100`, avec deux décimales. Les totaux du jour
sont recalculés à partir des entrées après chaque ajout ou retrait.

Une entrée peut être classée dans `petit-dejeuner`, `dejeuner`, `diner` ou
`collation`. Cette catégorie sert uniquement à regrouper les aliments dans
l'application mobile : le budget et le statut restent calculés sur le total
de la journée. Les anciennes entrées sans catégorie sont affichées sous
« Non classé » ; elles conservent leurs valeurs nutritionnelles.

Le suivi conserve trois mois calendaires glissants de journaux, en incluant
le jour limite UTC. Les anciens plans restent dans le document tant qu'un
journal ou une mesure conservée les référence. Le champ `version` du suivi
protège la mise à jour simultanée du plan, des mesures et des journaux : une
écriture fondée sur une version dépassée est refusée puis pourra être retentée
par le cas d'utilisation concerné.

Les documents `suivis` créés avant l'US3 restent lisibles : l'absence du champ
`journauxAlimentaires` est interprétée comme une liste vide.

## Ajouter un aliment consommé (FR403-751)

`POST /api/food-journals/me/entries` est réservé à l'utilisateur authentifié.
Le corps contient l'identifiant UUID d'un aliment du référentiel (`foodId`) et
sa quantité en grammes (`quantiteGrammes`, strictement positive, maximum
10 000 g). `categorieRepas` est facultatif pour préserver les anciens clients ;
sans ce champ, l'entrée est « Non classé ». Un plan actif est nécessaire.
L'API détermine seule la date et le
jour UTC de réception, puis crée ou complète le journal de ce jour.

La réponse `201` contient l'entrée et le journal avec ses totaux immédiatement
recalculés. Une quantité invalide renvoie `400`, un aliment inconnu `404`, et
l'absence de plan actif `422`. En cas d'ajouts simultanés, la version du suivi
empêche de perdre une entrée : l'API recharge le journal et réessaie l'écriture.

## Retirer une entrée (FR403-752)

`DELETE /api/food-journals/me/entries/{entryId}` retire une entrée de l'un des
journaux conservés de l'utilisateur authentifié. Le serveur retrouve son
journal par l'UUID de l'entrée, recalcule les calories et macronutriments du
jour, puis renvoie le journal mis à jour (`200`). Il reste possible de corriger
une journée dont le plan est terminé. L'entrée d'un autre utilisateur ou un
identifiant inconnu renvoie `404` ; un UUID invalide renvoie `400`.

Quand la dernière entrée est retirée, le journal peut rester présent avec des
totaux à zéro. Il ne représente alors aucune consommation et devra être traité
comme une journée sans données par le calcul du statut alimentaire.

## Statut par rapport au budget (FR403-753)

`GET /api/food-journals/me/status` renvoie `null` sans plan actif. Sinon, il
compare le total calorique du dernier journal **non vide** du plan actif au
budget du plan. L'écart signé vaut `total du jour − budget`. Un écart supérieur
à `+150 kcal` produit `depassement` ; la borne `+150` reste `dans-le-budget`.
Les macronutriments sont affichés à titre informatif, sans seuil d'alerte.

Si le dernier journal non vide date d'aujourd'hui ou d'hier UTC, son statut et
son écart sont renvoyés avec la date du journal. Après deux journées sans
entrée, le statut devient `pas-de-donnees-recentes` et l'écart vaut `null`.
Un journal laissé vide après le retrait de sa dernière entrée ne compte pas
comme une journée renseignée. Les alertes de dépassement persistant relèvent
de l'US5 et ne sont pas déclenchées par cette lecture.
