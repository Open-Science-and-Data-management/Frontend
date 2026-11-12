import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

export type Who = "researcher" | "committee";

const ENV = {
  researcher: ["E2E_RESEARCHER_USERNAME", "E2E_RESEARCHER_PASSWORD"],
  committee: ["E2E_COMMITTEE_USERNAME", "E2E_COMMITTEE_PASSWORD"],
} as const;

const account = (who: Who) => {
  const [user, pass] = ENV[who];
  return { username: process.env[user], password: process.env[pass] };
};

/** Skips the calling test when an account it needs isn't configured. */
export const requireAccounts = (...who: Who[]) => {
  const missing = who.flatMap((w) =>
    ENV[w].filter((name) => !process.env[name]),
  );
  test.skip(
    missing.length > 0,
    `Set ${missing.join(", ")} to run this test (see e2e/README.md)`,
  );
};

/** Signs in through the login form, as a person would. */
export const signIn = async (page: Page, who: Who) => {
  const { username, password } = account(who);
  await page.goto("/login");
  await page.getByLabel("Username").fill(username!);
  await page.locator("#login-password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
};

/**
 * Moves within the app without a full page load. The backend currently
 * revokes a session on its second refresh (see e2e/README.md), so tests keep
 * full reloads to the one test that checks session restore.
 */
export const goTo = async (page: Page, path: string) => {
  await page.evaluate((p) => {
    history.pushState({}, "", p);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[/]/g, "\\/")}$`));
};

/** The API as `who`, through the same `/api` path the app uses. */
export const apiAs = async (request: APIRequestContext, who: Who) => {
  const res = await request.post("/api/auth/sessions", { data: account(who) });
  expect(res.ok(), `sign-in as ${who}`).toBeTruthy();
  const { access_token } = await res.json();
  const headers = { authorization: `Bearer ${access_token}` };
  const call = async (
    method: "get" | "post" | "put",
    path: string,
    data?: unknown,
  ) => {
    const r = await request[method](`/api${path}`, { headers, data });
    expect(
      r.ok(),
      `${method.toUpperCase()} ${path}: ${r.status()} ${await r.text()}`,
    ).toBeTruthy();
    return r.json();
  };
  return {
    get: (path: string) => call("get", path),
    post: (path: string, data?: unknown) => call("post", path, data ?? {}),
    put: (path: string, data: unknown) => call("put", path, data),
  };
};

/** A name no earlier run has used, so tests never pick up old data. */
export const unique = (label: string) => `${label} ${Date.now().toString(36)}`;
