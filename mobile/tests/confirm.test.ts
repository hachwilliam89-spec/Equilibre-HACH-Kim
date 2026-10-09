import { confirmAction, useConfirm } from "../src/ui/confirmStore";

afterEach(() => useConfirm.setState({ current: null }));

test("résout true quand l'utilisateur confirme", async () => {
  const answer = confirmAction({ title: "Se déconnecter ?", message: "…", confirmLabel: "Se déconnecter" });
  expect(useConfirm.getState().current).toMatchObject({ title: "Se déconnecter ?", cancelLabel: "Annuler", tone: "brand" });
  useConfirm.getState().answer(true);
  await expect(answer).resolves.toBe(true);
  expect(useConfirm.getState().current).toBeNull();
});

test("résout false à l'annulation", async () => {
  const answer = confirmAction({ title: "Annuler le plan ?", message: "…", confirmLabel: "Annuler le plan", tone: "danger" });
  useConfirm.getState().answer(false);
  await expect(answer).resolves.toBe(false);
});

test("une nouvelle demande refuse la précédente", async () => {
  const first = confirmAction({ title: "A", message: "…", confirmLabel: "OK" });
  const second = confirmAction({ title: "B", message: "…", confirmLabel: "OK", cancelLabel: null });
  await expect(first).resolves.toBe(false);
  expect(useConfirm.getState().current).toMatchObject({ title: "B", cancelLabel: null });
  useConfirm.getState().answer(true);
  await expect(second).resolves.toBe(true);
});

test("une réponse sans demande en cours est ignorée", () => {
  expect(() => useConfirm.getState().answer(true)).not.toThrow();
});
