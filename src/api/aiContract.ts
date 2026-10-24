/**
 * What the frontend needs back from the AI backend, whatever model sits
 * behind it. The mock in `./mock/aiServer` honours the same contract, so the
 * UI is built against the real shape before the real server exists.
 */

/**
 * Token usage for one AI call, as the provider reports it. Kept apart because
 * the quota policy is still open — counting output only, everything, or
 * everything with cached input discounted all need the split to decide.
 */
export interface AiUsage {
  /** Every prompt token sent, cached ones included. */
  input_tokens: number;
  output_tokens: number;
  /** The part of `input_tokens` served from the provider's prompt cache. */
  cached_input_tokens: number;
}

export const NO_USAGE: AiUsage = {
  input_tokens: 0,
  output_tokens: 0,
  cached_input_tokens: 0,
};

/** Input plus output: what a call consumed, for display. Not the quota charge. */
export const totalTokens = (usage: AiUsage) =>
  usage.input_tokens + usage.output_tokens;

/** The account's AI budget as the server holds it. */
export interface AiQuota {
  limit: number;
  used: number;
  /**
   * When `used` goes back to zero. Null while no reset policy exists — the
   * UI says nothing about resetting rather than inventing a date.
   */
  resets_at: Date | null;
}

/**
 * Where a drafted value came from. `none` is an answer too: the proposal had
 * nothing on it, so the value is the model's guess and should be checked.
 */
export type Provenance =
  | { source: "proposal"; section?: string; quote?: string }
  | { source: "none" };

/** Keyed by field path, e.g. "title" or "dataset[0].access". */
export type ProvenanceMap = Record<string, Provenance>;

export type AiErrorCode =
  | "invalid_input"
  | "quota_exceeded"
  | "rate_limited"
  | "model_error"
  | "invalid_output"
  | "network"
  | "aborted";

/**
 * A failed AI call, in a shape the UI can act on without parsing messages:
 * whether trying again could help, what to tell the person, and for a spent
 * quota, when it comes back (if the server knows).
 */
export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly retryable: boolean;
  /** Written for the researcher, not for a log. */
  readonly userMessage: string;
  readonly resets_at: Date | null;
  /** Tokens the server counted before failing — a stopped call still costs. */
  readonly usage: AiUsage;

  constructor(init: {
    code: AiErrorCode;
    retryable: boolean;
    userMessage: string;
    resets_at?: Date | null;
    usage?: AiUsage;
  }) {
    super(init.userMessage);
    this.name = "AiError";
    this.code = init.code;
    this.retryable = init.retryable;
    this.userMessage = init.userMessage;
    this.resets_at = init.resets_at ?? null;
    this.usage = init.usage ?? NO_USAGE;
  }
}

/** Anything thrown by an AI call, as an AiError. */
export const asAiError = (err: unknown): AiError =>
  err instanceof AiError
    ? err
    : new AiError({
        code: "network",
        retryable: true,
        userMessage: "Couldn't reach the AI service. Check your connection and try again.",
      });

export const isAborted = (err: unknown) =>
  err instanceof AiError && err.code === "aborted";

/** Options every AI call accepts. */
export interface AiCallOptions {
  /** Stops waiting for the reply. Tokens already processed still count. */
  signal?: AbortSignal;
}
