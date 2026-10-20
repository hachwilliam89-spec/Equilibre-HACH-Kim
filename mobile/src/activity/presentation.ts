import type { Activite, ActivityLevel, MoyenneActivite } from "./api";

export const activityLevelLabel: Record<ActivityLevel, string> = {
  sedentaire: "Sédentaire",
  actif: "Actif",
  sportif: "Sportif",
  athlete: "Athlète",
};

/** 8200 → « 8 200 pas » (espaces insécables du français). */
export function formatPas(nombrePas: number): string {
  return `${Math.round(nombrePas).toLocaleString("fr-FR")} pas`;
}

/** Phrase de synthèse de la moyenne, lisible sans graphique. */
export function moyenneSummary(moyenne: MoyenneActivite): string {
  if (moyenne.moyennePas === null || moyenne.niveau === null) {
    return `${moyenne.joursRenseignes}/7 jours renseignés : le niveau sera calculé après 7 jours de pas.`;
  }
  return `${formatPas(moyenne.moyennePas)} par jour en moyenne · niveau ${activityLevelLabel[moyenne.niveau]}`;
}

/** Indication affichée au coach à côté du choix du niveau d'activité. */
export function coachActivityHint(moyenne: MoyenneActivite | undefined): string {
  if (!moyenne) return "Choisissez le niveau d’activité.";
  if (moyenne.moyennePas === null || moyenne.niveau === null) {
    return `Moins de 7 jours de pas (${moyenne.joursRenseignes}/7) : choisissez le niveau d’activité.`;
  }
  return `Déduit de la montre : ${formatPas(moyenne.moyennePas)} par jour sur les 7 derniers jours. Vous pouvez choisir un autre niveau.`;
}

export type LigneActivite = { jourUtc: string; nombrePas: number; enCours: boolean };

/**
 * Jours affichés : la journée en cours (non comptée, encore incomplète) puis
 * les jours de la fenêtre de la moyenne, du plus récent au plus ancien.
 */
export function lignesActivite(activite: Activite, aujourdhuiUtc: string): LigneActivite[] {
  const { debut, fin } = activite.moyenne7Jours;
  const lignes: LigneActivite[] = [];
  const enCours = activite.historique.find((jour) => jour.jourUtc === aujourdhuiUtc);
  if (enCours) lignes.push({ jourUtc: enCours.jourUtc, nombrePas: enCours.nombrePas, enCours: true });
  for (const jour of activite.historique) {
    if (jour.jourUtc >= debut && jour.jourUtc <= fin) {
      lignes.push({ jourUtc: jour.jourUtc, nombrePas: jour.nombrePas, enCours: false });
    }
  }
  return lignes;
}
