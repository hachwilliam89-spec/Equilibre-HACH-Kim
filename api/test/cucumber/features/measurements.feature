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
