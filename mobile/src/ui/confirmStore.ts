import type { ComponentType } from "react";
import { create } from "zustand";

export type ConfirmTone = "brand" | "danger";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** null : simple information, un seul bouton. */
  cancelLabel?: string | null;
  /** danger : action qui perd des données ou supprime quelque chose. */
  tone?: ConfirmTone;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

type Pending = ConfirmRequest & { resolve: (confirmed: boolean) => void };

type State = {
  current: Pending | null;
  ask: (request: ConfirmRequest) => Promise<boolean>;
  answer: (confirmed: boolean) => void;
};

/**
 * Fenêtre de confirmation de l'application (remplace Alert et window.confirm,
 * qui ne suivent pas la charte et n'existent pas toutes sur le web).
 * Une seule demande à la fois : une nouvelle demande refuse la précédente.
 */
export const useConfirm = create<State>((set, get) => ({
  current: null,
  ask: (request) =>
    new Promise<boolean>((resolve) => {
      get().current?.resolve(false);
      set({ current: { cancelLabel: "Annuler", tone: "brand", ...request, resolve } });
    }),
  answer: (confirmed) => {
    const current = get().current;
    if (!current) return;
    set({ current: null });
    current.resolve(confirmed);
  },
}));

export const confirmAction = (request: ConfirmRequest) => useConfirm.getState().ask(request);
