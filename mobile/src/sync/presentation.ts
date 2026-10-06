import type { Rejet } from "./engine";

/** Libellé d'une modification refusée, compréhensible par un non-initié. */
export function messageRejet(rejet: Rejet): string {
  const { operation, code } = rejet;
  const quoi =
    operation.type === "ajout-aliment"
      ? `L’ajout de « ${operation.aliment.nom} »`
      : operation.type === "retrait-aliment"
        ? "Le retrait d’un aliment"
        : operation.type === "saisie-poids"
          ? `Ton poids saisi (${operation.poidsKg.toLocaleString("fr-FR")} kg)`
          : `Le favori « ${operation.aliment.nom} »`;
  const pourquoi: Record<string, string> = {
    "measurement-day-conflict": "une mesure valide existait déjà ce jour-là",
    "saisie-poids-expiree": "la saisie de secours n’est valable que le jour même",
    "saisie-trop-ancienne": "elle date de plus de 7 jours",
    "saisie-hors-plan": "elle est en dehors de la période de ton plan",
    "saisie-dans-le-futur": "l’heure de ton téléphone semble incorrecte",
    "no-active-plan": "aucun plan n’est actif",
    "food-not-found": "l’aliment n’existe plus",
    abandon: "le serveur n’a pas pu l’enregistrer après plusieurs essais",
  };
  return `${quoi} n’a pas été retenu : ${
    (code && pourquoi[code]) ?? rejet.message.replace(/\.$/, "").toLocaleLowerCase("fr-FR")
  }.`;
}

/** Ligne d'état affichée en tête des écrans utilisateur. */
export function etatSynchro(input: {
  enCours: boolean;
  horsLigne: boolean;
  synchroniseLe: string | null;
  operationsEnAttente: number;
  maintenant?: Date;
}): { texte: string; ton: "neutre" | "attente" | "alerte" } {
  const attente =
    input.operationsEnAttente === 0
      ? ""
      : input.operationsEnAttente === 1
        ? " · 1 modification en attente"
        : ` · ${input.operationsEnAttente} modifications en attente`;
  if (input.enCours) return { texte: `Synchronisation…${attente}`, ton: "neutre" };
  if (input.horsLigne) {
    return {
      texte: `Hors ligne${attente || " · tes données restent consultables"}`,
      ton: "alerte",
    };
  }
  if (!input.synchroniseLe) return { texte: "Jamais synchronisé", ton: "attente" };
  const date = new Date(input.synchroniseLe);
  const maintenant = input.maintenant ?? new Date();
  const memeJour = date.toDateString() === maintenant.toDateString();
  const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const quand = memeJour
    ? `à ${heure}`
    : `le ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${heure}`;
  return {
    texte: `Synchronisé ${quand}${attente}`,
    ton: input.operationsEnAttente > 0 ? "attente" : "neutre",
  };
}

/**
 * Ce que l'écran peut afficher : les données locales dès qu'elles existent,
 * même hors ligne ; un chargement seulement avant la toute première
 * synchronisation.
 */
export function etatChargement(input: {
  initialise: boolean;
  synchroniseLe: string | null;
  enCours: boolean;
  horsLigne: boolean;
  erreur: string | null;
}): { loading: boolean; error: string } {
  if (!input.initialise) {
    return input.erreur
      ? { loading: false, error: input.erreur }
      : { loading: true, error: "" };
  }
  if (input.synchroniseLe !== null) return { loading: false, error: "" };
  if (input.enCours) return { loading: true, error: "" };
  if (input.horsLigne || input.erreur) {
    return {
      loading: false,
      error:
        input.erreur && !input.horsLigne
          ? input.erreur
          : "Tes données ne sont pas encore sur cet appareil. Connecte-toi à Internet pour une première synchronisation.",
    };
  }
  return { loading: true, error: "" };
}
