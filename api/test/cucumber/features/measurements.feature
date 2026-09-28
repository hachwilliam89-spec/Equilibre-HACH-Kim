# language: fr
@us2 @FR403-674
Fonctionnalité: Blocage des doublons de mesure sur une même journée
  En tant qu'utilisatrice suivie
  Je souhaite qu'une seule mesure valide soit retenue par journée
  Afin d'éviter les doublons qui fausseraient le suivi de mon poids.

  Contexte:
    Étant donné un coach authentifié et une utilisatrice rattachée de 30 ans mesurant 170 cm
    Et un plan actif enregistré

  Scénario: Refuser une deuxième mesure valide le même jour
    Quand l'utilisatrice envoie un poids de 71.5 kg
    Alors le code HTTP est 201
    Quand l'utilisatrice envoie un poids de 70.2 kg
    Alors le code HTTP est 409
    Et le conflit de mesure porte le type measurement-day-conflict
    Et la base contient 1 mesure valide pour cette utilisatrice

  Scénario: Accepter une mesure quand la seule mesure valide date d'un autre jour
    Étant donné une mesure valide enregistrée hier pour cette utilisatrice
    Quand l'utilisatrice envoie un poids de 71.5 kg
    Alors le code HTTP est 201
    Et la base contient 2 mesures valides pour cette utilisatrice

  Scénario: Arbitrer deux réceptions valides simultanées le même jour
    Quand l'utilisatrice envoie simultanément deux poids valides
    Alors une réponse mesure vaut 201 et l'autre 409
    Et le conflit simultané porte le type measurement-day-conflict
    Et la base contient 1 mesure valide pour cette utilisatrice

  @FR403-672
  Scénario: Classer suspecte une mesure a plus de 3 kg d'ecart avec la veille
    Étant donné une mesure valide de 72 kg enregistrée hier pour cette utilisatrice
    Quand l'utilisatrice envoie un poids de 76 kg
    Alors le code HTTP est 201
    Et la mesure est classee "suspecte"
    Et la base contient 1 mesure valide pour cette utilisatrice

  @FR403-672
  Scénario: Garder valide un ecart inferieur ou egal a 3 kg avec la veille
    Étant donné une mesure valide de 72 kg enregistrée hier pour cette utilisatrice
    Quand l'utilisatrice envoie un poids de 74 kg
    Alors le code HTTP est 201
    Et la mesure est classee "valide"
    Et la base contient 2 mesures valides pour cette utilisatrice

  @FR403-672
  Scénario: Ignorer la veille d'un autre plan pour le controle suspect
    Étant donné une mesure valide de 60 kg enregistrée hier sur un autre plan
    Quand l'utilisatrice envoie un poids de 76 kg
    Alors le code HTTP est 201
    Et la mesure est classee "valide"

  @FR403-672
  Scénario: Classer hors-plan une mesure avant le debut du plan
    Étant donné que le plan actif demarre dans le futur
    Quand l'utilisatrice envoie un poids de 71.5 kg
    Alors le code HTTP est 201
    Et la mesure est classee "hors-plan"
    Et la base contient 0 mesure valide pour cette utilisatrice

  @FR403-675
  Scénario: Afficher l'attente de premiere mesure
    Quand l'utilisatrice consulte son suivi de poids
    Alors le code HTTP est 200
    Et le statut de suivi est "en-attente-premiere-mesure"
    Et le suivi renvoie le resume du plan actif

  @FR403-675
  Scénario: Afficher un suivi dans les clous
    Quand l'utilisatrice envoie un poids de 80 kg
    Alors le code HTTP est 201
    Quand l'utilisatrice consulte son suivi de poids
    Alors le code HTTP est 200
    Et le statut de suivi est "dans-les-clous"

  @FR403-675
  Scénario: Detecter un ecart de trajectoire dans le suivi
    Quand l'utilisatrice envoie un poids de 85 kg
    Alors le code HTTP est 201
    Quand l'utilisatrice consulte son suivi de poids
    Alors le code HTTP est 200
    Et le statut de suivi est "ecart-detecte"

  @FR403-675
  Scénario: Signaler l'absence de donnees recentes
    Étant donné une mesure valide de 80 kg enregistrée avant-hier pour cette utilisatrice
    Quand l'utilisatrice consulte son suivi de poids
    Alors le code HTTP est 200
    Et le statut de suivi est "pas-de-donnees-recentes"

  @FR403-670
  Scénario: Corriger le poids en secours quand aucune mesure du jour
    Quand l'utilisatrice envoie une correction manuelle de 79 kg
    Alors le code HTTP est 201
    Et la mesure est classee "valide"

  @FR403-670
  Scénario: Autoriser la correction quand la mesure du jour est suspecte
    Étant donné une mesure suspecte du jour pour cette utilisatrice
    Quand l'utilisatrice envoie une correction manuelle de 79 kg
    Alors le code HTTP est 201
    Et la mesure est classee "valide"

  @FR403-670
  Scénario: Refuser une correction si une mesure valide existe deja ce jour
    Quand l'utilisatrice envoie un poids de 80 kg
    Alors le code HTTP est 201
    Quand l'utilisatrice envoie une correction manuelle de 79 kg
    Alors le code HTTP est 409

  @FR403-670
  Scénario: Refuser une deuxieme correction manuelle le meme jour
    Quand l'utilisatrice envoie une correction manuelle de 79 kg
    Alors le code HTTP est 201
    Quand l'utilisatrice envoie une correction manuelle de 78 kg
    Alors le code HTTP est 409
