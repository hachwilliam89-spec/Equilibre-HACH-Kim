/** Nombre de journées proposées dans le sélecteur du journal. */
export const JOURS_CONSULTABLES = 7;
/** Journées présentes dans la base embarquée (disponibles hors ligne). */
export const JOURS_EMBARQUES = 2;

const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const JOURS_LONGS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export interface JourJournal {
  /** Jour calendaire UTC (clé des journaux côté serveur). */
  jourUtc: string;
  /** 0 = aujourd'hui, 1 = hier… */
  decalage: number;
  /** Libellé de la pastille : « Auj. », « Hier », « Mer. 14 ». */
  court: string;
  /** Titre de la carte : « Aujourd’hui », « Hier », « Mercredi 14 octobre ». */
  long: string;
  /** Seul le jour même se modifie ; les journées passées sont en lecture seule. */
  modifiable: boolean;
  /** Aujourd'hui et hier viennent de la base embarquée ; au-delà, de l'API. */
  horsLigne: boolean;
}

/** Les N derniers jours UTC, du plus récent au plus ancien (jamais de jour futur). */
export function derniersJours(maintenant = new Date(), nombre = JOURS_CONSULTABLES): JourJournal[] {
  const minuitUtc = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Array.from({ length: nombre }, (_, decalage) => {
    const jour = new Date(minuitUtc - decalage * 86_400_000);
    const libelleDate = `${JOURS_LONGS[jour.getUTCDay()]} ${jour.getUTCDate()} ${MOIS[jour.getUTCMonth()]}`;
    return {
      jourUtc: jour.toISOString().slice(0, 10),
      decalage,
      court: decalage === 0 ? "Auj." : decalage === 1 ? "Hier" : `${JOURS[jour.getUTCDay()]} ${jour.getUTCDate()}`,
      long: decalage === 0
        ? "Aujourd’hui"
        : decalage === 1
          ? "Hier"
          : libelleDate.charAt(0).toUpperCase() + libelleDate.slice(1),
      modifiable: decalage === 0,
      horsLigne: decalage < JOURS_EMBARQUES,
    };
  });
}
