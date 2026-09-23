import { z } from "zod";
import { ApiError, refresh } from "../auth/api";
import { useSession } from "../auth/session";
import { storage } from "../auth/storage";

let refreshing: Promise<void> | null = null;
async function renewSession() {
  if (!refreshing) refreshing = (async () => {
    const previous = useSession.getState().session;
    if (!previous) throw new ApiError("Reconnectez-vous.", 401);
    try {
      const next = { ...previous, ...(await refresh(previous.refreshToken)) };
      if (useSession.getState().session?.refreshToken !== previous.refreshToken) throw new ApiError("Session modifiée. Reconnectez-vous.", 401);
      await storage.write(JSON.stringify(next));
      useSession.setState({ session: next });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await storage.clear();
        useSession.setState({ session: null, error: "Session expirée. Reconnectez-vous." });
      }
      throw error;
    }
  })().finally(() => { refreshing = null; });
  await refreshing;
}

export async function requestApi(path: string, method = "GET", body?: unknown, retry = true): Promise<unknown> {
  const session = useSession.getState().session;
  if (!session) throw new ApiError("Reconnectez-vous.", 401);
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Adresse du service non configurée.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method, headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal,
    });
  } catch {
    throw new Error("Connexion interrompue. Actualisez le plan avant de réessayer une soumission.");
  } finally { clearTimeout(timeout); }
  if (response.status === 401 && retry) {
    // Une requête concurrente peut déjà avoir renouvelé le jeton.
    if (useSession.getState().session?.accessToken === session.accessToken) await renewSession();
    return requestApi(path, method, body, false);
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const problem = z.object({ detail: z.string().optional(), errors: z.array(z.object({ message: z.string() })).optional() }).safeParse(data);
    throw new ApiError(problem.success ? problem.data.errors?.map((e) => e.message).join("\n") || problem.data.detail || "Opération refusée." : "Opération refusée.", response.status);
  }
  return data;
}
export const clientSchema = z.object({ id: z.string(), email: z.string(), tailleCm: z.number().optional(), age: z.number().optional(), sexe: z.enum(["homme", "femme"]).optional() });
export type Client = z.infer<typeof clientSchema>;
export const previewSchema = z.object({ userId: z.string(), poidsDepart: z.number(), poidsCible: z.number(), dateDebut: z.string(), dateCible: z.string(), imcCible: z.number(), niveauActivite: z.enum(["sedentaire", "actif", "sportif", "athlete"]), budgetCalorique: z.number(), budgetPlafonneAuBmr: z.boolean(), avertissement: z.string().nullable().optional() });
export const planSchema = previewSchema.extend({ id: z.string(), statut: z.enum(["actif", "annule", "termine"]) });
export type Plan = z.infer<typeof planSchema>;
export type Preview = z.infer<typeof previewSchema>;
export const clients = async () => z.array(clientSchema).parse(await requestApi("/users/me/clients"));
export const currentPlan = async (id: string) => planSchema.nullable().parse(await requestApi(`/plans/users/${encodeURIComponent(id)}`));
