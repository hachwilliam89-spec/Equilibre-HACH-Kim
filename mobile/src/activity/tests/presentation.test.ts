import { coachActivityHint, formatPas, lignesActivite, moyenneSummary } from "../presentation";

const complete = {
  debut: "2026-10-01",
  fin: "2026-10-07",
  joursRenseignes: 7,
  moyennePas: 8200,
  niveau: "sportif" as const,
};
const incomplete = { ...complete, joursRenseignes: 3, moyennePas: null, niveau: null };

describe("présentation de l’activité (US4)", () => {
  it("formate un nombre de pas en français", () => {
    expect(formatPas(8200).replace(/\s/g, " ")).toBe("8 200 pas");
  });

  it("résume une moyenne complète avec son niveau", () => {
    expect(moyenneSummary(complete).replace(/\s/g, " ")).toBe(
      "8 200 pas par jour en moyenne · niveau Sportif",
    );
  });

  it("explique qu’il manque des jours", () => {
    expect(moyenneSummary(incomplete)).toBe(
      "3/7 jours renseignés : le niveau sera calculé après 7 jours de pas.",
    );
  });

  it("guide le coach selon l’historique disponible", () => {
    expect(coachActivityHint(complete)).toMatch(/^Déduit de la montre/);
    expect(coachActivityHint(incomplete)).toMatch(/\(3\/7\)/);
    expect(coachActivityHint(undefined)).toBe("Choisissez le niveau d’activité.");
  });

  it("place la journée en cours à part, puis la fenêtre de la moyenne", () => {
    const historique = ["2026-10-08", "2026-10-07", "2026-10-01", "2026-09-30"].map((jourUtc, i) => ({
      jourUtc,
      nombrePas: 1000 * (i + 1),
      recuLe: `${jourUtc}T20:00:00.000Z`,
    }));
    expect(lignesActivite({ historique, moyenne7Jours: complete }, "2026-10-08")).toEqual([
      { jourUtc: "2026-10-08", nombrePas: 1000, enCours: true },
      { jourUtc: "2026-10-07", nombrePas: 2000, enCours: false },
      { jourUtc: "2026-10-01", nombrePas: 3000, enCours: false },
    ]);
  });
});
