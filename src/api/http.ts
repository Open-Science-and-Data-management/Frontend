import { API_BASE_URL } from "@/config/api-mode";

/**
 * The one door to the backend: base URL, the access token, the refresh flow
 * and the error envelope, so no caller handles any of them itself.
 *
 * - The access token lives in memory only, never in localStorage. After a
 *   reload it's gone, and the first request gets a new one from the refresh
 *   cookie.
 * - A 401 for a missing or expired token triggers one refresh (shared by
 *   every request waiting on it), then one retry. If refreshing fails, the
 *   person is signed out.
 * - Errors arrive as `{ error: { type, code, message, param } }` and are
 *   thrown as `ApiError`.
 */

export interface Session {
  object: "session";
  access_token: string;
  token_type?: string;
  expires_at: string;
  user: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly type?: string;
  readonly param?: string;
  /** The whole error object, for codes that carry more (e.g. draft_conflict). */
  readonly details: Record<string, unknown>;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    type?: string;
    param?: string;
    details?: Record<string, unknown>;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.type = init.type;
    this.param = init.param;
    this.details = init.details ?? {};
  }
}

let accessToken: string | null = null;
let refreshing: Promise<Session | null> | null = null;

let hooks: {
  /** A refresh produced a new session (its user may have changed). */
  onSession?: (session: Session) => void;
  /** Refreshing failed: the person has to sign in again. */
  onSignedOut?: () => void;
} = {};

export const configureHttp = (next: typeof hooks) => {
  hooks = next;
};

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const hasAccessToken = () => accessToken !== null;

export const getAccessToken = () => accessToken;

const url = (path: string, query?: Record<string, unknown>) => {
  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  const qs = params.toString();
  return `${API_BASE_URL}${path}${qs ? `?${qs}` : ""}`;
};

const toApiError = async (response: Response): Promise<ApiError> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const error = (body as { error?: Record<string, unknown> } | undefined)
    ?.error;
  const text = (key: string) =>
    typeof error?.[key] === "string" ? (error[key] as string) : undefined;
  return new ApiError({
    status: response.status,
    code: text("code") ?? `http_${response.status}`,
    message: text("message") ?? (response.statusText || "Request failed"),
    type: text("type"),
    param: text("param"),
    details: error,
  });
};

/** One refresh at a time: every request that needs it waits on the same one. */
export const refreshSession = (): Promise<Session | null> => {
  refreshing ??= (async () => {
    try {
      const response = await fetch(url("/auth/refresh"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) return null;
      const session = (await response.json()) as Session;
      accessToken = session.access_token;
      hooks.onSession?.(session);
      return session;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
};

const NEEDS_REFRESH = new Set(["token_expired", "not_signed_in"]);

export interface RequestOptions {
  query?: Record<string, unknown>;
  /** JSON-serialised unless it's FormData. */
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** `false` for the endpoints anyone may call (sign in, register…). */
  auth?: boolean;
  /** `blob` for file contents; JSON otherwise. */
  as?: "json" | "blob";
}

export const request = async <T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const {
    query,
    body,
    signal,
    headers = {},
    auth = true,
    as = "json",
  } = options;

  const send = () => {
    const isForm = body instanceof FormData;
    return fetch(url(path, query), {
      method,
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm
          ? { "Content-Type": "application/json" }
          : {}),
        ...(auth && accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
        ...headers,
      },
      body:
        body === undefined
          ? undefined
          : isForm
            ? (body as FormData)
            : JSON.stringify(body),
    });
  };

  let response: Response;
  try {
    // No token yet (e.g. after a reload): get one before asking. No session
    // to refresh means the person has to sign in again.
    if (auth && !accessToken && !(await refreshSession())) {
      hooks.onSignedOut?.();
      throw new ApiError({
        status: 401,
        code: "not_signed_in",
        message: "Your session has ended. Please sign in again.",
      });
    }
    response = await send();
    if (auth && response.status === 401) {
      const error = await toApiError(response.clone());
      if (NEEDS_REFRESH.has(error.code)) {
        const session = await refreshSession();
        if (!session) {
          hooks.onSignedOut?.();
          throw error;
        }
        response = await send();
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError({
      status: 0,
      code: "network",
      message:
        "Couldn't reach the server. Check your connection and try again.",
    });
  }

  if (!response.ok) throw await toApiError(response);
  if (as === "blob") return (await response.blob()) as T;
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
};

export const http = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};
