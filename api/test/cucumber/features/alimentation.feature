# language: fr
@us3 @FR403-747
Fonctionnalité: Suivi de l'alimentation au regard du budget calorique
  En tant qu'utilisatrice suivie
  Je souhaite consigner mes aliments depuis une librairie de référence
  Afin de suivre mon respect du budget calorique fixé par mon coach.

  Contexte:
    Étant donné un coach authentifié et une utilisatrice rattachée de 30 ans mesurant 170 cm

  @FR403-755
  Scénario: Rechercher et consigner un aliment met à jour le total du jour
    Étant donné un plan actif enregistré
    Quand l'utilisatrice consigne 200 g de "Riz blanc cuit"
    Alors le code HTTP est 201
    Et l'entrée consignée vaut 260 kcal, 5.4 g de protéines, 56 g de glucides et 0.6 g de lipides
    Et le journal du jour totalise 260 kcal

  @FR403-755
  Scénario: Une recherche sans correspondance ne renvoie aucun aliment
    Quand l'utilisatrice recherche l'aliment "zzzintrouvable"
    Alors le code HTTP est 200
    Et la recherche ne renvoie aucun aliment

  Scénario: Rester dans le budget à la borne de 150 kcal
    Étant donné un budget manuel de 1800 kcal
    Et un plan actif enregistré
    Quand l'utilisatrice consigne 1500 g de "Riz blanc cuit"
    Alors le code HTTP est 201
    Quand l'utilisatrice consulte son statut alimentaire
    Alors le code HTTP est 200
    Et le statut alimentaire est "dans-le-budget"
    Et l'écart calorique vaut 150 kcal

  Scénario: Détecter un dépassement au-delà de la tolérance
    Étant donné un budget manuel de 1800 kcal
    Et un plan actif enregistré
    Quand l'utilisatrice consigne 1600 g de "Riz blanc cuit"
    Alors le code HTTP est 201
    Quand l'utilisatrice consulte son statut alimentaire
    Alors le code HTTP est 200
    Et le statut alimentaire est "depassement"
    Et l'écart calorique vaut 280 kcal

  Scénario: Retirer une entrée recalcule le total du jour
    Étant donné un plan actif enregistré
    Quand l'utilisatrice consigne 200 g de "Riz blanc cuit"
    Alors le code HTTP est 201
    Quand l'utilisatrice consigne 300 g de "Riz blanc cuit"
    Alors le code HTTP est 201
    Et le journal du jour totalise 650 kcal
    Quand l'utilisatrice retire la dernière entrée consignée
    Alors le code HTTP est 200
    Et le journal du jour totalise 260 kcal

  Scénario: Signaler l'absence de données récentes sans consignation
    Étant donné un plan actif enregistré
    Quand l'utilisatrice consulte son statut alimentaire
    Alors le code HTTP est 200
    Et le statut alimentaire est "pas-de-donnees-recentes"

  @FR403-755
  Scénario: Refuser une quantité nulle ou négative
    Étant donné un plan actif enregistré
    Quand l'utilisatrice consigne 0 g de "Riz blanc cuit"
    Alors le code HTTP est 400
    Quand l'utilisatrice consigne -1 g de "Riz blanc cuit"
    Alors le code HTTP est 400

  Scénario: Refuser une consignation sans plan actif
    Quand l'utilisatrice consigne 200 g de "Riz blanc cuit"
    Alors le code HTTP est 422

  Scénario: La librairie d'aliments reste en lecture seule
    Quand l'utilisatrice tente de créer un aliment dans la librairie
    Alors le code HTTP est 404
