import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, configureHttp, http, setAccessToken } from "@/api/http";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const envelope = (status: number, code: string, param?: string) =>
  json(status, {
    error: { type: "invalid_request_error", code, message: code, param },
  });
const session = (token: string) => ({
  object: "session",
  access_token: token,
  expires_at: "2026-11-12T10:00:00Z",
  user: { user_id: "u-1", username: "aran" },
});

/** Answers by path; records each call's path and Authorization header. */
const server = (routes: Record<string, (auth?: string) => Response>) => {
  const calls: { path: string; auth?: string }[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input)
        .replace(/^\/api/, "")
        .split("?")[0];
      const auth = (init?.headers as Record<string, string> | undefined)
        ?.Authorization;
      calls.push({ path, auth });
      const route = routes[path];
      if (!route) throw new TypeError("Failed to fetch");
      return route(auth);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return calls;
};

const onSession = vi.fn();
const onSignedOut = vi.fn();

beforeEach(() => {
  setAccessToken("token-1");
  configureHttp({ onSession, onSignedOut });
});

afterEach(() => {
  vi.unstubAllGlobals();
  onSession.mockReset();
  onSignedOut.mockReset();
});

describe("talking to the backend", () => {
  it("sends the access token and returns the body", async () => {
    const calls = server({ "/users/me": () => json(200, { user_id: "u-1" }) });
    expect(await http.get("/users/me")).toEqual({ user_id: "u-1" });
    expect(calls[0].auth).toBe("Bearer token-1");
  });

  it("turns the error envelope into an ApiError with its code and field", async () => {
    server({ "/users/me": () => envelope(409, "email_taken", "email") });
    const err = await http
      .patch("/users/me", { email: "x@y.z" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      code: "email_taken",
      param: "email",
    });
  });

  it("reports an unreachable server as a network error", async () => {
    server({});
    await expect(http.get("/users/me")).rejects.toMatchObject({
      code: "network",
    });
  });
});

describe("an expired access token", () => {
  it("is refreshed once and the request repeated with the new one", async () => {
    const calls = server({
      "/users/me": (auth) =>
        auth === "Bearer token-2"
          ? json(200, { ok: true })
          : envelope(401, "token_expired"),
      "/auth/refresh": () => json(200, session("token-2")),
    });

    expect(await http.get("/users/me")).toEqual({ ok: true });
    expect(calls.map((c) => c.path)).toEqual([
      "/users/me",
      "/auth/refresh",
      "/users/me",
    ]);
    expect(onSession).toHaveBeenCalledOnce();
  });

  it("shares one refresh between requests that expire together", async () => {
    let refreshes = 0;
    server({
      "/notifications": (auth) =>
        auth === "Bearer token-2"
          ? json(200, [])
          : envelope(401, "token_expired"),
      "/auth/refresh": () => {
        refreshes += 1;
        return json(200, session("token-2"));
      },
    });

    await Promise.all([http.get("/notifications"), http.get("/notifications")]);
    expect(refreshes).toBe(1);
  });

  it("signs the person out when the session can't be refreshed", async () => {
    server({
      "/users/me": () => envelope(401, "token_expired"),
      "/auth/refresh": () => envelope(401, "refresh_token_invalid"),
    });

    await expect(http.get("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(onSignedOut).toHaveBeenCalledOnce();
  });
});

describe("after a reload, with no token in memory", () => {
  it("gets one from the refresh cookie before the first request", async () => {
    setAccessToken(null);
    const calls = server({
      "/auth/refresh": () => json(200, session("token-3")),
      "/users/me": () => json(200, { ok: true }),
    });

    await http.get("/users/me");
    expect(calls).toEqual([
      { path: "/auth/refresh", auth: undefined },
      { path: "/users/me", auth: "Bearer token-3" },
    ]);
  });

  it("doesn't need a token for public endpoints", async () => {
    setAccessToken(null);
    const calls = server({
      "/auth/sessions": () => json(200, session("token-4")),
    });

    await http.post(
      "/auth/sessions",
      { username: "a", password: "b" },
      { auth: false },
    );
    expect(calls.map((c) => c.path)).toEqual(["/auth/sessions"]);
  });
});
