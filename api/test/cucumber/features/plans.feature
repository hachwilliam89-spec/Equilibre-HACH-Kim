# language: fr
@us1
Fonctionnalité: Soumission du plan par le coach
  En tant que coach
  Je souhaite soumettre un plan à un utilisateur qui m'est rattaché
  Afin de lui donner une trajectoire de poids et un budget calorique.

  Contexte:
    Étant donné un coach authentifié et une utilisatrice rattachée de 30 ans mesurant 170 cm

  @FR403-123 @FR403-126
  Plan du scénario: Validation des dates, du poids et du rythme
    Quand le coach soumet un plan de <depart> kg vers <cible> kg sur <jours> jours
    Alors le code HTTP est <code>
    Et la base contient <nombre> plan pour cette utilisatrice

    Exemples:
      | depart | cible | jours | code | nombre |
      | 80     | 75    | 35    | 201  | 1      |
      | 80     | 75    | 0     | 400  | 0      |
      | 80     | 75    | -10   | 400  | 0      |
      | 80     | 80    | 35    | 400  | 0      |
      | 82     | 74    | 28    | 400  | 0      |
      | 82     | 78    | 28    | 201  | 1      |
      | 70     | 74    | 28    | 400  | 0      |
      | 70     | 72    | 28    | 201  | 1      |
      | 46     | 45    | 14    | 400  | 0      |
      | 101    | 93    | 56    | 201  | 1      |

  @FR403-126
  Scénario: Accepter la borne exacte de l'IMC cible
    Étant donné une taille de 200 cm dans le profil
    Quand le coach soumet un plan de 75 kg vers 74 kg sur 14 jours
    Alors le code HTTP est 201
    Et l'IMC cible retourné et enregistré vaut 18.5

  @FR403-127
  Plan du scénario: Calculer la suggestion et appliquer le plancher BMR
    Quand le coach soumet un plan de 82 kg vers <cible> kg sur 28 jours
    Alors le code HTTP est 201
    Et le budget retourné et enregistré vaut <budget> kcal avec un plancher <plancher>

    Exemples:
      | cible | budget   | plancher |
      | 80    | 1885.825 | non      |
      | 78    | 1571.5   | oui      |

  @FR403-127
  Plan du scénario: Retenir le budget choisi par le coach
    Étant donné un budget manuel de <budget> kcal
    Quand le coach soumet un plan de 82 kg vers 80 kg sur 28 jours
    Alors le code HTTP est 201
    Et le budget retourné et enregistré vaut <budget> kcal avec un plancher non

    Exemples:
      | budget |
      | 1900   |
      | 2000   |

  @FR403-123
  Scénario: Refuser deux plans actifs simultanés
    Quand le coach soumet simultanément deux plans valides
    Alors une réponse vaut 201 et l'autre 409
    Et la base contient 1 plan pour cette utilisatrice

  @FR403-123
  Scénario: Refuser un coach non rattaché
    Étant donné un autre coach authentifié
    Quand le coach soumet un plan de 80 kg vers 75 kg sur 35 jours
    Alors le code HTTP est 403
    Et la base contient 0 plan pour cette utilisatrice

  @FR403-123
  Scénario: Retourner null lorsque aucun plan actif existe
    Quand l'utilisatrice et son coach consultent le plan actif
    Alors les deux réponses valent 200 avec le corps JSON null
    Et la base contient 0 plan pour cette utilisatrice

  @FR403-123
  Scénario: Annuler un plan et en soumettre un nouveau
    Étant donné un plan actif enregistré
    Quand le coach annule ce plan
    Alors le code HTTP est 200
    Et le statut enregistré vaut "annule"
    Quand le coach soumet un plan de 80 kg vers 75 kg sur 35 jours
    Alors le code HTTP est 201
    Et la base contient 2 plan pour cette utilisatrice

  @FR403-123
  Scénario: Garder le plan actif le jour de sa date cible
    Étant donné un plan actif enregistré dont la date cible est aujourd'hui
    Quand le coach consulte le plan actif
    Alors le code HTTP est 200
    Et le statut retourné et enregistré vaut "actif"

  @FR403-123
  Scénario: Terminer un plan expiré avant de refuser son annulation
    Étant donné un plan actif enregistré dont la date cible était hier
    Quand le coach annule ce plan
    Alors le code HTTP est 409
    Et le statut enregistré vaut "termine"
    Quand le coach soumet un plan de 80 kg vers 75 kg sur 35 jours
    Alors le code HTTP est 201
    Et la base contient 2 plan pour cette utilisatrice
