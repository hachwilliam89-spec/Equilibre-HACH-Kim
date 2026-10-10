import {
  SESSION_EXPIRED_MESSAGE,
  registrationSchema,
  type Registration,
  credentialsSchema,
  sessionSchema,
  tokensSchema,
  type Credentials,
} from "./contracts";
import { fetchWithTimeout, parseApiData, parseApiResponse } from "../network/http";
export { ApiError } from "../network/http";

export async function authRequest(
  path: string,
  body: unknown,
): Promise<unknown> {
  const url = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (!url)
    throw new Error(
      "Adresse du service non configurée. Consulte le README mobile.",
    );
  const response = await fetchWithTimeout(`${url}/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseApiResponse(response, (status) =>
    status === 401
      ? path === "login"
        ? "E-mail ou mot de passe incorrect."
        : SESSION_EXPIRED_MESSAGE
      : status === 409 && path === "register"
        ? "Cette adresse e-mail est déjà utilisée."
        : status === 429
          ? "Trop de tentatives. Patiente une minute avant de réessayer."
          : status === 400
            ? path === "register"
              ? "Vérifie les informations saisies et le code de ton coach."
              : "Vérifie les informations saisies."
            : "Le service est indisponible. Réessaie dans un instant.",
  );
}
export async function login(credentials: Credentials) {
  return parseApiData(sessionSchema,
    await authRequest("login", credentialsSchema.parse(credentials)),
  );
}
export async function refresh(refreshToken: string) {
  return parseApiData(tokensSchema, await authRequest("refresh", { refreshToken }));
}
export async function logout(refreshToken: string) {
  await authRequest("logout", { refreshToken });
}

export async function register(data: Registration) {
  await authRequest("register", registrationSchema.parse(data));
}
