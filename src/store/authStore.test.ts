import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_PASSWORD, useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import { actingUserId, CURRENT_USER_ID } from "@/config/current-user";
import { registrationSchema, type Registration } from "@/schemas/user";

const auth = () => useAuthStore.getState();

const form = (patch: Partial<Record<string, unknown>> = {}): Registration =>
  registrationSchema.parse({
    account_type: "institutional",
    title: "Dr.",
    name: "Somchai",
    surname: "Prasert",
    email: "somchai@example.ac.th",
    organization: "KMITL",
    username: "Somchai.P",
    password: "rice2026",
    confirm_password: "rice2026",
    accept: true,
    ...patch,
  });

const initialUsers = useProjectStore.getState().users;
const initialCredentials = useAuthStore.getState().credentials;

beforeEach(() => {
  localStorage.clear();
  useProjectStore.setState({ users: initialUsers });
  useAuthStore.setState({ userId: null, credentials: initialCredentials });
});

describe("signing in", () => {
  it("lets a demo account in with its password", async () => {
    expect(await auth().signIn("aran", DEMO_PASSWORD)).toEqual({ ok: true });
    expect(auth().userId).toBe(CURRENT_USER_ID);
  });

  it("ignores the case of the username", async () => {
    expect((await auth().signIn("MALI", DEMO_PASSWORD)).ok).toBe(true);
    expect(auth().userId).toBe("user-2");
  });

  it("refuses a wrong password, and says the same for an unknown user", async () => {
    const wrong = await auth().signIn("aran", "nope12345");
    const unknown = await auth().signIn("nobody", DEMO_PASSWORD);
    expect(wrong).toMatchObject({ ok: false });
    expect(unknown).toEqual(wrong);
    expect(auth().userId).toBeNull();
  });

  it("makes the signed-in user the one records are attributed to", async () => {
    await auth().signIn("mali", DEMO_PASSWORD);
    expect(actingUserId()).toBe("user-2");
    auth().logout();
    expect(actingUserId()).toBe(CURRENT_USER_ID);
  });
});

describe("signing up", () => {
  it("creates a researcher, signs them in, and never stores the password", async () => {
    expect(await auth().register(form())).toEqual({ ok: true });

    const user = useProjectStore
      .getState()
      .users.find((u) => u.username === "somchai.p");
    expect(user).toMatchObject({
      role: "researcher",
      account_type: "institutional",
      affiliation: { organization: "KMITL" },
    });
    expect(auth().userId).toBe(user?.user_id);
    expect(JSON.stringify(auth().credentials)).not.toContain("rice2026");
  });

  it("can sign back in with the new password", async () => {
    await auth().register(form());
    auth().logout();
    expect((await auth().signIn("somchai.p", "rice2026")).ok).toBe(true);
  });

  it("keeps a citizen researcher unaffiliated", async () => {
    await auth().register(
      form({
        account_type: "citizen",
        organization: "",
        address: "Nan",
      }),
    );
    const user = useProjectStore
      .getState()
      .users.find((u) => u.username === "somchai.p");
    expect(user?.affiliation).toBeUndefined();
    expect(user?.address).toBe("Nan");
  });

  it("refuses a username or email that's already in use", async () => {
    expect(await auth().register(form({ username: "aran" }))).toMatchObject({
      ok: false,
      field: "username",
    });
    expect(
      await auth().register(form({ email: "MALI@example.edu" })),
    ).toMatchObject({ ok: false, field: "email" });
  });

  it("stores an affiliation as the form collects it — no address", async () => {
    await auth().register(
      form({ department: "Science", position: "Lecturer" }),
    );
    const user = useProjectStore
      .getState()
      .users.find((u) => u.username === "somchai.p");
    expect(user?.affiliation).toEqual({
      organization: "KMITL",
      department: "Science",
      position: "Lecturer",
    });
  });

  it("files a new account's projects under that account", async () => {
    await auth().register(form());
    const project = useProjectStore
      .getState()
      .createProject({ project_name: "Rice blast survey" });
    const member = useProjectStore
      .getState()
      .members.find((m) => m.project_id === project.project_id);
    expect(member?.user_id).toBe(auth().userId);
  });
});

describe("the sign-up form's rules", () => {
  const issues = (patch: Partial<Record<string, unknown>>) => {
    const result = registrationSchema.safeParse({
      ...form(),
      confirm_password: "rice2026",
      accept: true,
      ...patch,
    });
    return result.success
      ? []
      : result.error.issues.map((i) => String(i.path[0]));
  };

  it("needs an organisation when affiliated, and nothing else of it", () => {
    expect(issues({ organization: " " })).toEqual(["organization"]);
    expect(issues({ department: "", position: "" })).toEqual([]);
  });

  it("doesn't ask a citizen researcher for an organisation", () => {
    expect(
      issues({
        account_type: "citizen",
        organization: "",
      }),
    ).toEqual([]);
  });

  it("catches a password that doesn't match, or is too weak", () => {
    expect(issues({ confirm_password: "rice2027" })).toContain(
      "confirm_password",
    );
    expect(
      issues({ password: "short1", confirm_password: "short1" }),
    ).toContain("password");
    expect(
      issues({ password: "lettersonly", confirm_password: "lettersonly" }),
    ).toContain("password");
  });

  it("requires the prototype notice to be accepted", () => {
    expect(issues({ accept: false })).toContain("accept");
  });

  it("checks ORCID and phone only when given", () => {
    expect(issues({ orcid: "1234" })).toContain("orcid");
    expect(issues({ orcid: "0000-0002-1825-0097", phone: "" })).toEqual([]);
  });
});

describe("one account per email", () => {
  const projects = () => useProjectStore.getState();

  it("matches emails the way contributors are matched: case and spaces aside", () => {
    expect(projects().isEmailTaken("  Aran@Example.edu ")).toBe(true);
    expect(projects().isEmailTaken("someone@example.edu")).toBe(false);
  });

  it("doesn't count an account's own email against it", () => {
    expect(projects().isEmailTaken("aran@example.edu", CURRENT_USER_ID)).toBe(
      false,
    );
    expect(projects().isEmailTaken("mali@example.edu", CURRENT_USER_ID)).toBe(
      true,
    );
  });
});
