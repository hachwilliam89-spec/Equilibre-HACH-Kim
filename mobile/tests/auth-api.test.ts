import { authRequest, login } from "../src/auth/api";

const previousFetch = global.fetch;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = "https://api.example.test/api";
  global.fetch = jest.fn();
});

afterAll(() => { global.fetch = previousFetch; });

test("une erreur de connexion conserve le message d'authentification et son statut", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 401,
    ok: false,
    text: async () => JSON.stringify({ detail: "Non autorisé" }),
  });
  await expect(authRequest("login", {})).rejects.toMatchObject({
    status: 401,
    message: "E-mail ou mot de passe incorrect.",
  });
});

test("une réponse HTML inattendue ne devient pas une fausse panne réseau", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => "<html>Erreur du proxy</html>",
  });
  await expect(authRequest("login", {})).rejects.toThrow("Réponse inattendue du service");
});

test("une réponse d'erreur sans corps conserve son statut", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ status: 503, ok: false, text: async () => "" });
  await expect(authRequest("login", {})).rejects.toMatchObject({ status: 503 });
});

test("des données JSON incompatibles n'exposent pas le diagnostic Zod", async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    status: 200,
    ok: true,
    text: async () => JSON.stringify({ accessToken: "jeton" }),
  });
  await expect(login({ email: "coach@example.test", password: "password123" }))
    .rejects.toThrow("Données reçues du service invalides");
});
