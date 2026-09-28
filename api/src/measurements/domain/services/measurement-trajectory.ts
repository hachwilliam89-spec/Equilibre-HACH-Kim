/**
 * Ecart de poids par rapport a la trajectoire lineaire du plan (FR403-672 pour
 * la tolerance de suivi, FR403-673 pour le calcul de l'ecart). Une variation
 * quotidienne normale etant de 1 a 2 kg, la mesure est « dans les clous » tant
 * que l'ecart avec le poids attendu ne depasse pas 1 kg.
 */
export const TOLERANCE_ECART_KG = 1;

export interface TrajectoirePlan {
  poidsDepart: number;
  poidsCible: number;
  dateDebut: Date;
  dateCible: Date;
}

export interface EcartTrajectoire {
  /** Poids theorique attendu au jour de la mesure selon la trajectoire. */
  poidsAttendu: number;
  /** Ecart signe : poids mesure moins poids attendu (kg). */
  ecartKg: number;
  /** Vrai si |ecart| <= TOLERANCE_ECART_KG. */
  dansLesClous: boolean;
}

const jourUtc = (date: Date): string => date.toISOString().slice(0, 10);
const joursEntre = (debutJourUtc: string, finJourUtc: string): number =>
  (Date.parse(`${finJourUtc}T00:00:00Z`) -
    Date.parse(`${debutJourUtc}T00:00:00Z`)) /
  86_400_000;

/**
 * Poids attendu au jour donne :
 * poids depart + (poids cible - poids depart) * jours ecoules / duree totale.
 * Les jours sont comptes en jours civils UTC.
 */
export function poidsAttendu(
  plan: TrajectoirePlan,
  jourMesureUtc: string,
): number {
  const dureeTotale = joursEntre(
    jourUtc(plan.dateDebut),
    jourUtc(plan.dateCible),
  );
  if (dureeTotale <= 0) {
    return plan.poidsDepart;
  }
  const joursEcoules = joursEntre(jourUtc(plan.dateDebut), jourMesureUtc);
  const ratio = joursEcoules / dureeTotale;
  return plan.poidsDepart + (plan.poidsCible - plan.poidsDepart) * ratio;
}

/** Ecart d'une mesure par rapport a la trajectoire, et statut de tolerance. */
export function evaluerEcart(
  plan: TrajectoirePlan,
  jourMesureUtc: string,
  poidsMesureKg: number,
): EcartTrajectoire {
  const attendu = poidsAttendu(plan, jourMesureUtc);
  const ecartKg = poidsMesureKg - attendu;
  return {
    poidsAttendu: attendu,
    ecartKg,
    dansLesClous: Math.abs(ecartKg) <= TOLERANCE_ECART_KG,
  };
}
