import { z } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function parseApiData<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error("Données reçues du service invalides. Réessaie plus tard.");
  }
  return result.data;
}

const problemSchema = z.object({
  detail: z.string().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

function fallbackMessage(status: number): string {
  if (status === 401) return "Session expirée. Reconnectez-vous.";
  if (status === 403) return "Accès refusé.";
  if (status === 404) return "Ressource introuvable sur le serveur.";
  if (status === 429) return "Trop de requêtes. Réessaie dans un instant.";
  if (status >= 500) return "Le service est temporairement indisponible. Réessaie plus tard.";
  return "Opération refusée.";
}

export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new Error("Connexion au service impossible. Vérifie ton réseau puis réessaie.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseApiResponse(
  response: Response,
  overrideMessage?: (status: number) => string,
): Promise<unknown> {
  let body: string;
  try {
    body = await response.text();
  } catch {
    throw new Error("Connexion au service interrompue. Vérifie ton réseau puis réessaie.");
  }
  if (response.status === 204) return null;
  if (!body) {
    if (!response.ok) throw new ApiError(overrideMessage?.(response.status) ?? fallbackMessage(response.status), response.status);
    throw new Error("Réponse vide inattendue du service. Réessaie plus tard.");
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    if (!response.ok) {
      const message = response.status === 404
        ? "Cette fonctionnalité n'est pas disponible sur le serveur. Une mise à jour de l'API est nécessaire."
        : fallbackMessage(response.status);
      throw new ApiError(overrideMessage?.(response.status) ?? message, response.status);
    }
    throw new Error("Réponse inattendue du service. Réessaie plus tard.");
  }

  if (!response.ok) {
    const problem = problemSchema.safeParse(data);
    const details = problem.success
      ? problem.data.errors?.map((error) => error.message).join("\n") || problem.data.detail
      : undefined;
    throw new ApiError(overrideMessage?.(response.status) ?? (details || fallbackMessage(response.status)), response.status);
  }
  return data;
}
