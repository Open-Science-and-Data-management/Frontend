/**
 * Password hashing for the demo's browser-held accounts. A salted SHA-256 is
 * enough to keep plain-text passwords out of localStorage; it is not a
 * substitute for a server doing this properly (slow hashing, rate limits),
 * which is what a deployment needs.
 */

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const makeSalt = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
};

export const hashPassword = async (
  salt: string,
  password: string,
): Promise<string> => {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  return toHex(await crypto.subtle.digest("SHA-256", data));
};

/** Compares without stopping at the first differing character. */
export const sameHash = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
