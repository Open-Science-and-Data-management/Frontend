import { actingUserId } from "@/config/current-user";
import { useProjectStore } from "@/store/projectStore";
import {
  AiError,
  type AiQuota,
  type AiUsage,
  NO_USAGE,
} from "@/api/aiContract";

/**
 * Stands in for the AI backend's bookkeeping: it enforces the quota, charges
 * usage, and answers the quota endpoint. Account records (`ai_token_limit`,
 * `ai_token_used`) play the server's database, so the frontend reads the
 * numbers back the way it will from a real API, never adding them up itself.
 */

/**
 * What a call costs against the quota. The policy is an open question
 * (output only? cached input discounted?), so this counts everything for
 * now; `AiUsage` keeps the split so changing it is a one-line decision.
 */
export const chargeable = (usage: AiUsage) =>
  usage.input_tokens + usage.output_tokens;

const account = () =>
  useProjectStore.getState().users.find((u) => u.user_id === actingUserId());

const charge = (usage: AiUsage) => {
  const user = account();
  if (!user?.user_id) return;
  useProjectStore.getState().updateUser(user.user_id, {
    ai_token_used: (user.ai_token_used ?? 0) + chargeable(usage),
  });
};

/** No reset policy has been decided, so the server promises no date. */
const RESETS_AT: Date | null = null;

export const fetchQuota = async (): Promise<AiQuota> => {
  const user = account();
  if (!user)
    throw new AiError({
      code: "network",
      retryable: true,
      userMessage: "Couldn't load your AI budget.",
    });
  return {
    limit: user.ai_token_limit,
    used: user.ai_token_used ?? 0,
    resets_at: RESETS_AT,
  };
};

const aborted = (usage: AiUsage) =>
  new AiError({
    code: "aborted",
    retryable: true,
    userMessage: "Stopped. Tokens already used still count.",
    usage,
  });

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new Error("aborted"));
      },
      { once: true },
    );
  });

/**
 * One model call as the server would run it: refuse when the budget is
 * spent, charge the prompt as soon as it's processed, then the reply. A
 * client that stops waiting still pays for the prompt — the server already
 * did that work.
 */
export const serve = async (call: {
  input: number;
  output: number;
  cached?: number;
  ms: number;
  signal?: AbortSignal;
}): Promise<AiUsage> => {
  const user = account();
  if (user && (user.ai_token_used ?? 0) >= user.ai_token_limit)
    throw new AiError({
      code: "quota_exceeded",
      retryable: false,
      userMessage: "You've used your AI budget.",
      resets_at: RESETS_AT,
    });
  if (call.signal?.aborted) throw aborted(NO_USAGE);

  const prompt: AiUsage = {
    input_tokens: Math.ceil(call.input),
    output_tokens: 0,
    cached_input_tokens: Math.ceil(call.cached ?? 0),
  };
  charge(prompt);

  try {
    await wait(call.ms, call.signal);
  } catch {
    throw aborted(prompt);
  }

  const reply: AiUsage = { ...NO_USAGE, output_tokens: Math.ceil(call.output) };
  charge(reply);
  return { ...prompt, output_tokens: reply.output_tokens };
};
