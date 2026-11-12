import { API_BASE_URL } from "@/config/api-mode";
import {
  ApiError,
  hasAccessToken,
  refreshSession,
  getAccessToken,
} from "@/api/http";
import { AiError, type AiUsage } from "@/api/aiContract";

/**
 * AI actions on the backend stream their result as server-sent events in the
 * response to a POST: `status`, `tool`, `delta`, `proposal`, then exactly one
 * `done` or `error`. It's read with `fetch`, not `EventSource`, because the
 * access token travels in the Authorization header. Unknown events are
 * ignored, as the backend asks.
 *
 * Every run carries an Idempotency-Key, so a retried run is charged once.
 */

export interface StreamResult {
  /** The reply's text, from the `delta` events. */
  text: string;
  /** Each `proposal` event's payload, in order. */
  proposals: unknown[];
  /** The assistant entry the run wrote to the thread. */
  entryId?: string;
  /** The plan the run created or worked on (analyze-proposal). */
  dmpId?: string;
  usage: AiUsage;
}

const ZERO: AiUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cached_input_tokens: 0,
};

const usageOf = (raw: unknown): AiUsage => {
  const u = (raw ?? {}) as Partial<AiUsage>;
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cached_input_tokens: u.cached_input_tokens ?? 0,
  };
};

const RETRYABLE = new Set([
  "ai_rate_limited",
  "ai_provider_error",
  "ai_network_error",
]);

/** The backend's AI codes, in the app's terms. */
const aiErrorOf = (event: Record<string, unknown>): AiError => {
  const code = String(event.code ?? "model_error");
  const mapped =
    code === "quota_exceeded"
      ? "quota_exceeded"
      : code === "ai_rate_limited"
        ? "rate_limited"
        : code === "ai_aborted"
          ? "aborted"
          : code === "ai_network_error"
            ? "network"
            : code === "ai_invalid_request"
              ? "invalid_input"
              : "model_error";
  return new AiError({
    code: mapped,
    retryable:
      typeof event.retryable === "boolean"
        ? event.retryable
        : RETRYABLE.has(code),
    userMessage: String(event.message ?? "The AI service failed."),
    usage: usageOf(event.usage),
    resets_at:
      typeof event.resets_at === "string" ? new Date(event.resets_at) : null,
  });
};

const newKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const streamAiAction = async (
  path: string,
  body: Record<string, unknown>,
  opts: {
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
    /** Reuse when retrying the same run, so it's charged once. */
    idempotencyKey?: string;
  } = {},
): Promise<StreamResult> => {
  if (!hasAccessToken()) await refreshSession();
  const key = opts.idempotencyKey ?? newKey();

  const send = () =>
    fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      signal: opts.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Idempotency-Key": key,
        ...(getAccessToken()
          ? { Authorization: `Bearer ${getAccessToken()}` }
          : {}),
      },
      body: JSON.stringify(body),
    });

  let response: Response;
  try {
    response = await send();
    if (response.status === 401 && (await refreshSession()))
      response = await send();
  } catch (err) {
    if ((err as Error)?.name === "AbortError")
      throw new AiError({
        code: "aborted",
        retryable: true,
        userMessage: "Stopped. Tokens already used still count.",
      });
    throw new AiError({
      code: "network",
      retryable: true,
      userMessage: "Couldn't reach the AI service. Try again.",
    });
  }

  // Refused before the stream started: the normal error envelope.
  if (!response.ok) {
    let error: Record<string, unknown> = {};
    try {
      error = ((await response.json()) as { error?: Record<string, unknown> })
        .error ?? {};
    } catch {
      /* not JSON */
    }
    if (error.code === "quota_exceeded") throw aiErrorOf(error);
    throw new ApiError({
      status: response.status,
      code: String(error.code ?? `http_${response.status}`),
      message: String(error.message ?? "The AI request was refused."),
      details: error,
    });
  }

  const result: StreamResult = { text: "", proposals: [], usage: ZERO };
  const reader = response.body?.getReader();
  if (!reader) return result;
  const decoder = new TextDecoder();
  let buffer = "";

  const handle = (frame: string) => {
    const data = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(data);
    } catch {
      return;
    }
    switch (event.event) {
      case "delta":
        result.text += String(event.text ?? "");
        opts.onDelta?.(result.text);
        return;
      case "proposal":
        result.proposals.push(event.proposal);
        return;
      case "done":
        result.entryId =
          typeof event.entry_id === "string" ? event.entry_id : undefined;
        result.dmpId =
          typeof event.dmp_id === "string" ? event.dmp_id : undefined;
        result.usage = usageOf(event.usage);
        return;
      case "error":
        throw aiErrorOf(event);
      default:
        return; // status, tool, and anything newer
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let cut: number;
      while ((cut = buffer.indexOf("\n\n")) >= 0) {
        handle(buffer.slice(0, cut));
        buffer = buffer.slice(cut + 2);
      }
    }
    if (buffer.trim()) handle(buffer);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error)?.name === "AbortError")
      throw new AiError({
        code: "aborted",
        retryable: true,
        userMessage: "Stopped. Tokens already used still count.",
      });
    throw new AiError({
      code: "network",
      retryable: true,
      userMessage: "The connection dropped. Try again.",
    });
  }
  return result;
};

/** `POST /dmps/:scope/ai/:action` */
export const runAiAction = (
  scope: string,
  action: "chat" | "suggest" | "regenerate-field" | "generate-tasks" | "checklist",
  body: Record<string, unknown>,
  opts?: Parameters<typeof streamAiAction>[2],
) => streamAiAction(`/dmps/${scope}/ai/${action}`, body, opts);

/** `POST /ai/analyze-proposal`: creates the plan only if the run succeeds. */
export const analyzeProposalStream = (
  body: { project_id: string; file_id: string; dmp_id?: string; direction?: string },
  opts?: Parameters<typeof streamAiAction>[2],
) => streamAiAction("/ai/analyze-proposal", body, opts);
