import { dateValue, displayDate, localDate, nextDate } from "../src/ui/dates";

describe("Dates calendaires du coach", () => {
  it.each(["2026-03-29", "2026-10-25", "2028-02-29"])("conserve le jour sélectionné %s sans conversion UTC", (value) => {
    const date = localDate(value);
    expect(date.getHours()).toBe(12);
    expect(dateValue(date)).toBe(value);
  });
  it.each([
    ["2026-03-29", "2026-03-30"],
    ["2026-10-25", "2026-10-26"],
    ["2028-02-28", "2028-02-29"],
    ["2026-12-31", "2027-01-01"],
  ])("borne la date cible après %s", (start, expected) => {
    expect(nextDate(start)).toBe(expected);
  });
  it("affiche les dates API en français sans décalage de fuseau", () => {
    expect(displayDate("2026-09-24T00:00:00.000Z")).toBe("24/09/2026");
  });
});
