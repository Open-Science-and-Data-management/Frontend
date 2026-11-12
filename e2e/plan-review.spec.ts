import {
  expect,
  test,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import draft from "./fixtures/complete-draft.json" with { type: "json" };
import { apiAs, goTo, requireAccounts, signIn, unique } from "./support";

/**
 * A plan's way through review, in the UI: the researcher submits, the
 * committee decides, the researcher sees the outcome. The plan's content is
 * written through the API first; filling every field by hand is the editor's
 * business, not this test's.
 */
const preparePlan = async (request: APIRequestContext, title: string) => {
  const api = await apiAs(request, "researcher");
  const project = await api.post("/projects", {
    project_name: unique("E2E project"),
    description: "Created by the end-to-end tests",
  });
  const plan = await api.post("/dmps", { project_id: project.project_id });
  await api.put(`/dmps/${plan.dmp_id}/draft`, {
    draft_revision: plan.draft_revision ?? 0,
    draft: { ...draft, title },
  });
  return plan.dmp_id as string;
};

const openPlan = async (page: Page, title: string) => {
  await goTo(page, "/dmps");
  await page.getByText(title).first().click();
};

const submitForApproval = async (page: Page, title: string) => {
  await signIn(page, "researcher");
  await openPlan(page, title);
  await goTo(page, "/dmp/review");
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit for approval" })
    .click();
  await expect(page).toHaveURL(/\/dmp\/status/);
};

const decide = async (
  page: Page,
  title: string,
  decision: "Approve" | "Send back",
  note?: string,
) => {
  await signIn(page, "committee");
  await goTo(page, "/review");
  await page.getByText(title).first().click();
  // The plan's content loads before a decision can be made.
  await expect(page.getByText("Sequence reads").first()).toBeVisible();
  await page.locator("#review-position").fill("Committee member");
  if (note) await page.locator("#review-note").fill(note);
  await page
    .getByRole("button", {
      name: decision === "Approve" ? /^Approve version 1/ : "Send back",
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: decision, exact: true })
    .click();
};

test.describe("plan review", () => {
  test.beforeEach(() => requireAccounts("researcher", "committee"));

  test("an approved plan comes back in force with its tasks", async ({
    page,
    request,
    browser,
  }) => {
    const title = unique("E2E approved plan");
    await preparePlan(request, title);
    await submitForApproval(page, title);

    const committee = await browser.newPage();
    await decide(committee, title, "Approve");
    await expect(committee.getByText(/approved/i).first()).toBeVisible();
    await committee.close();

    const researcher = await browser.newPage();
    await signIn(researcher, "researcher");
    await openPlan(researcher, title);
    await goTo(researcher, "/dmp/status");
    await expect(
      researcher.getByRole("heading", { name: "Approved" }),
    ).toBeVisible();
    // The server opens the first tasks when a plan is approved.
    await goTo(researcher, "/tasks");
    await expect(researcher.getByText(/Sequence reads/).first()).toBeVisible();
    await researcher.close();
  });

  test("a plan sent back shows the committee's note", async ({
    page,
    request,
    browser,
  }) => {
    const title = unique("E2E returned plan");
    const note = "Add a data sharing agreement first.";
    await preparePlan(request, title);
    await submitForApproval(page, title);

    const committee = await browser.newPage();
    await decide(committee, title, "Send back", note);
    await committee.close();

    const researcher = await browser.newPage();
    await signIn(researcher, "researcher");
    await openPlan(researcher, title);
    await goTo(researcher, "/dmp/status");
    await expect(
      researcher.getByRole("heading", { name: "Sent back for changes" }),
    ).toBeVisible();
    await expect(researcher.getByText(note)).toBeVisible();

    // The backend takes a plan's first submission once, so the app says so
    // instead of offering a submit that would fail. Update this when the
    // backend allows resubmitting a returned plan.
    await goTo(researcher, "/dmp/review");
    await expect(
      researcher.getByText("This plan can't be resubmitted yet"),
    ).toBeVisible();
    await researcher.close();
  });
});
