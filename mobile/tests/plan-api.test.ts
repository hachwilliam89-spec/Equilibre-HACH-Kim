import { ApiError, refresh } from "../src/auth/api";
import { useSession } from "../src/auth/session";
import { storage } from "../src/auth/storage";
import { requestApi } from "../src/plans/api";

jest.mock("../src/auth/api", () => ({
  ApiError: class extends Error { status: number; constructor(message: string, code: number) { super(message); this.status = code; } },
  refresh: jest.fn(),
}));
jest.mock("../src/auth/session", () => ({ useSession: { getState: jest.fn(), setState: jest.fn() } }));
jest.mock("../src/auth/storage", () => ({ storage: { write: jest.fn(), clear: jest.fn() } }));
const initial = { userId: "coach", role: "coach" as const, accessToken: "expired", refreshToken: "refresh" };
const response = (status: number, data: unknown) => ({ status, ok: status < 400, json: async () => data }) as Response;
let session: typeof initial | null;
const previousFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks(); session = { ...initial };
  process.env.EXPO_PUBLIC_API_URL = "https://api.example.test/api";
  (useSession.getState as jest.Mock).mockImplementation(() => ({ session }));
  (useSession.setState as jest.Mock).mockImplementation((patch) => { if ("session" in patch) session = patch.session; });
  global.fetch = jest.fn();
});
afterAll(() => { global.fetch = previousFetch; });
test("deux requetes expirees partagent un seul renouvellement puis utilisent le nouveau jeton", async () => {
  (refresh as jest.Mock).mockResolvedValue({ accessToken: "new", refreshToken: "rotated" });
  (global.fetch as jest.Mock).mockImplementation(async (_url, options) => response(options.headers.Authorization === "Bearer expired" ? 401 : 200, []));
  await Promise.all([requestApi("/users/me/clients"), requestApi("/users/me/clients")]);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledTimes(4);
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(session?.accessToken).toBe("new");
});
test("un refresh refuse efface la session et ne rejoue pas la soumission", async () => {
  (refresh as jest.Mock).mockRejectedValue(new ApiError("Session expirée", 401));
  (global.fetch as jest.Mock).mockResolvedValue(response(401, {}));
  await expect(requestApi("/plans", "POST", {})).rejects.toThrow("Session expirée");
  expect(session).toBeNull(); expect(storage.clear).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test("une erreur metier conserve son message et ne relance pas le POST", async () => {
  (global.fetch as jest.Mock).mockResolvedValue(response(409, { detail: "Un plan actif existe déjà." }));
  await expect(requestApi("/plans", "POST", {})).rejects.toThrow("Un plan actif existe déjà.");
  expect(global.fetch).toHaveBeenCalledTimes(1); expect(refresh).not.toHaveBeenCalled();
});
