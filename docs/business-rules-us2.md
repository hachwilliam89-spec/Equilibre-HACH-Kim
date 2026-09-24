# Suivi du poids — US2

Source : règles métier transmises par le porteur du projet le 24 septembre 2026
(note externe `business-rules.md`). Les critères définitifs des tickets restent
la référence. Ceux de FR403-671 ont été transmis et sont repris dans
[la fiche de livraison](FR403-671-mesures-historique.md).

## Mesures et historique

- Une mesure se rattache uniquement à un plan actif. Sans plan actif, elle est
  rejetée ; aucune mesure orpheline.
- Une journée correspond au jour calendaire UTC de réception par l’API, jamais
  à un horodatage envoyé par le simulateur.
- Une mesure reçue alors que le plan est actif, mais dont la date sort de
  `[dateDebut, dateCible]`, est conservée avec le flag `hors-plan`.
  Après la date cible, le plan devient terminé et n’est plus actif.
- Une variation automatique strictement supérieure à 3 kg en valeur absolue
  par rapport au poids valide de la veille, pour le même plan, rend la mesure
  suspecte. Sans valeur valide la veille, ce contrôle est ignoré.
- Une mesure suspecte est stockée et exclue du calcul d’écart. Une correction
  manuelle reste possible ce jour-là.
- Les corrections manuelles ne sont pas soumises au contrôle des 3 kg.
  Elles exigent un plan actif ; dans sa période, elles peuvent être retenues,
  sinon elles sont conservées hors-plan sans devenir la valeur retenue.
- Dès qu’une mesure valide existe pour le jour (automatique ou correction),
  toute nouvelle tentative automatique ou manuelle est refusée avec HTTP 409,
  y compris lors d’envois simultanés.
- L’historique conserve toutes les mesures enregistrées, y compris suspectes
  et hors-plan.

## Trajectoire et affichage

- Poids attendu = poids départ + (poids cible − poids départ)
  × jours écoulés depuis le début / durée totale du plan.
- Écart = valeur absolue du poids mesuré − poids attendu à la date de la mesure.
- Écart ≤ 1 kg : « dans les clous » ; écart > 1 kg : « écart détecté ».
- Dernière mesure valide d’aujourd’hui ou d’hier : statut calculé/conservé,
  accompagné de la date de cette mesure.
- Dernière mesure valide d’avant-hier ou plus ancienne : « pas de données
  récentes » (deux jours consécutifs sans mesure valide).
- « En attente de première mesure » est un état d’affichage distinct, à
  distinguer du cas où seules des mesures suspectes/hors-plan existent.
- Le récapitulatif du plan actif appartient à FR403-675 (US2).
  L’US1 validée fournit seulement l’accueil connecté côté utilisateur.

## Livraison et vérification

Ordre : FR403-671 → FR403-669/672/674 → FR403-670 → FR403-673 → FR403-675.
Une branche `FR403-…` et des changements séparés par ticket.

FR403-676 accompagne chaque étape : tests, Swagger pour les nouvelles routes,
documentation Confluence et preuves de recette. Inclure un test réel de
concurrence interdisant deux valeurs valides pour le même jour et des tests
d’autorisation propres aux routes de mesures.

Un prompt Rovo regroupé est fourni à chaque étape terminée.
