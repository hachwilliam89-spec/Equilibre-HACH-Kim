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

Le suivi conserve trois mois calendaires glissants de journaux, en incluant
le jour limite UTC. Les anciens plans restent dans le document tant qu'un
journal ou une mesure conservée les référence. Le champ `version` du suivi
protège la mise à jour simultanée du plan, des mesures et des journaux : une
écriture fondée sur une version dépassée est refusée puis pourra être retentée
par le cas d'utilisation concerné.

Les documents `suivis` créés avant l'US3 restent lisibles : l'absence du champ
`journauxAlimentaires` est interprétée comme une liste vide.
