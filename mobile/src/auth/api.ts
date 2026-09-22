import {
  registrationSchema,
  type Registration,
  credentialsSchema,
  sessionSchema,
  tokensSchema,
  type Credentials,
} from "./contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function authRequest(
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!url)
    throw new Error(
      "Adresse du service non configurée. Consulte le README mobile.",
    );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${url}/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const message =
        response.status === 401
          ? path === "login"
            ? "E-mail ou mot de passe incorrect."
            : "Ta session a expiré. Reconnecte-toi."
          : response.status === 409 && path === "register"
            ? "Cette adresse e-mail est déjà utilisée."
          : response.status === 429
            ? "Trop de tentatives. Patiente une minute avant de réessayer."
            : response.status === 400
              ? path === "register"
                ? "Vérifie les informations saisies et le code de ton coach."
                : "Vérifie les informations saisies."
              : "Le service est indisponible. Réessaie dans un instant.";
      throw new ApiError(message, response.status);
    }
    return response.status === 204 ? undefined : await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(
      "Connexion au service impossible. Vérifie ton réseau puis réessaie.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function login(credentials: Credentials) {
  return sessionSchema.parse(
    await authRequest("login", credentialsSchema.parse(credentials)),
  );
}
export async function refresh(refreshToken: string) {
  return tokensSchema.parse(await authRequest("refresh", { refreshToken }));
}
export async function logout(refreshToken: string) {
  await authRequest("logout", { refreshToken });
}

export async function register(data: Registration) {
  await authRequest("register", registrationSchema.parse(data));
}
