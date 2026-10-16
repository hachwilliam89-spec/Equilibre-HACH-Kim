import { derniersJours } from "../journal-days";

describe("derniersJours", () => {
  const vendredi = new Date("2026-10-16T09:30:00Z");

  it("propose 7 jours UTC, du plus récent au plus ancien", () => {
    const jours = derniersJours(vendredi);

    expect(jours.map((j) => j.jourUtc)).toEqual([
      "2026-10-16", "2026-10-15", "2026-10-14", "2026-10-13",
      "2026-10-12", "2026-10-11", "2026-10-10",
    ]);
  });

  it("nomme aujourd'hui, hier puis le jour de la semaine", () => {
    const [auj, hier, avantHier] = derniersJours(vendredi);

    expect([auj.court, hier.court, avantHier.court]).toEqual(["Auj.", "Hier", "Mer. 14"]);
    expect(avantHier.long).toBe("Mercredi 14 octobre");
  });

  it("seul le jour même est modifiable ; aujourd'hui et hier sont embarqués", () => {
    const jours = derniersJours(vendredi);

    expect(jours.map((j) => j.modifiable)).toEqual([true, false, false, false, false, false, false]);
    expect(jours.map((j) => j.horsLigne)).toEqual([true, true, false, false, false, false, false]);
  });

  it("raisonne en UTC, comme les journaux du serveur", () => {
    // 23 h 30 à Paris le 15 = 21 h 30 UTC le 15 : le jour UTC reste le 15.
    expect(derniersJours(new Date("2026-10-15T21:30:00Z"), 1)[0].jourUtc).toBe("2026-10-15");
    // Passage de mois.
    expect(derniersJours(new Date("2026-11-01T08:00:00Z"), 2).map((j) => j.jourUtc)).toEqual([
      "2026-11-01", "2026-10-31",
    ]);
  });
});
