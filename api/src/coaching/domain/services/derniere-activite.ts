/**
 * Dernière activité d'un utilisateur vue par son coach : la plus récente
 * des dates connues (pesée, saisie alimentaire). null si aucune.
 */
export function derniereActivite(
  dates: ReadonlyArray<Date | null | undefined>,
): Date | null {
  let plusRecente: Date | null = null;
  for (const date of dates) {
    if (!date || !Number.isFinite(date.getTime())) continue;
    if (!plusRecente || date.getTime() > plusRecente.getTime()) {
      plusRecente = date;
    }
  }
  return plusRecente ? new Date(plusRecente) : null;
}
