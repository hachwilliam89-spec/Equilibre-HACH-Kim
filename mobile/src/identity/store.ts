import { create } from "zustand";
import type { Person } from "./identity";

type State = {
  /** Compte connecté (utilisateur ou coach) ; null tant qu'il n'est pas chargé. */
  me: Person | null;
  /** Coach de rattachement (rôle utilisateur uniquement). */
  coach: Person | null;
  setMe: (me: Person | null) => void;
  setCoach: (coach: Person | null) => void;
  reset: () => void;
};

/** Identité affichée (salutation, profil) ; non persistée, rechargée à la connexion. */
export const useIdentity = create<State>((set) => ({
  me: null,
  coach: null,
  setMe: (me) => set({ me }),
  setCoach: (coach) => set({ coach }),
  reset: () => set({ me: null, coach: null }),
}));
