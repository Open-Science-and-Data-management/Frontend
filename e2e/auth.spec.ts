import { expect, test } from "@playwright/test";
import { requireAccounts, signIn } from "./support";

test.describe("signing in", () => {
  test.beforeEach(() => requireAccounts("researcher"));

  test("a wrong password is refused and says so", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByLabel("Username")
      .fill(process.env.E2E_RESEARCHER_USERNAME!);
    await page.locator("#login-password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the session survives a reload and ends on sign out", async ({
    page,
  }) => {
    await signIn(page, "researcher");
    const account = page.getByRole("button", { name: /^Account:/ });
    await expect(account).toBeVisible();

    // The access token lives in memory only; a reload restores it from the
    // refresh cookie.
    await page.reload();
    await expect(account).toBeVisible();

    await account.click();
    await page.getByText("Sign out").click();
    // Back on the public landing page.
    await expect(account).toBeHidden();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

    // Signed out means signed out: the app sends you back to the login page.
    await page.goto("/dmps");
    await expect(page).toHaveURL(/\/login/);
  });
});
