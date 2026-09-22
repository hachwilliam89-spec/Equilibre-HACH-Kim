import { create } from "zustand";
import * as api from "./api";
import { sessionSchema, type Session, type Credentials } from "./contracts";
import { storage } from "./storage";

type State = {
  session: Session | null;
  busy: boolean;
  ready: boolean;
  error: string | null;
  restore: () => Promise<void>;
  signIn: (data: Credentials) => Promise<void>;
  signOut: () => Promise<void>;
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Une erreur est survenue. Réessaie.";

export const useSession = create<State>((set, get) => ({
  session: null,
  busy: false,
  ready: false,
  error: null,
  restore: async () => {
    if (get().busy) return;
    set({ busy: true, error: null });
    try {
      const raw = await storage.read();
      if (raw) {
        const parsed = sessionSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          await storage.clear();
        } else {
          const next = {
            ...parsed.data,
            ...(await api.refresh(parsed.data.refreshToken)),
          };
          await storage.write(JSON.stringify(next));
          set({ session: next });
        }
      }
      set({ ready: true });
    } catch (error) {
      if (error instanceof api.ApiError && error.status === 401) {
        await storage.clear();
        set({ ready: true, session: null, error: error.message });
      } else if (error instanceof SyntaxError) {
        await storage.clear();
        set({ ready: true });
      } else {
        set({ error: message(error) });
      }
    } finally {
      set({ busy: false });
    }
  },
  signIn: async (data) => {
    if (get().busy) return;
    set({ busy: true, error: null });
    try {
      const session = await api.login(data);
      try {
        await storage.write(JSON.stringify(session));
      } catch {
        await api.logout(session.refreshToken).catch(() => undefined);
        throw new Error(
          "Impossible de conserver la session sur cet appareil. Réessaie.",
        );
      }
      set({ session });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: false });
    }
  },
  signOut: async () => {
    const session = get().session;
    if (!session || get().busy) return;
    set({ busy: true, error: null });
    try {
      // En cas de panne réseau, garder la session et permettre de réessayer la révocation.
      await api.logout(session.refreshToken);
      await storage.clear();
      set({ session: null });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ busy: false });
    }
  },
}));
