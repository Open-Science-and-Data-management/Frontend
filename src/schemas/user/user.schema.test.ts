import { describe, expect, it } from "vitest";
import { userProfileSchema } from "@/schemas/user";

const valid = { title: "Dr.", name: "Aran", surname: "S", email: "a@b.edu" };

describe("userProfileSchema", () => {
  it("accepts a complete profile and trims whitespace", () => {
    const out = userProfileSchema.parse({ ...valid, name: "  Aran  " });
    expect(out.name).toBe("Aran");
  });

  it("treats the title as optional", () => {
    expect(userProfileSchema.safeParse({ ...valid, title: "" }).success).toBe(
      true,
    );
  });

  it("rejects a blank name and a malformed email", () => {
    const result = userProfileSchema.safeParse({
      ...valid,
      name: " ",
      email: "nope",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0]).sort()).toEqual([
        "email",
        "name",
      ]);
    }
  });

  it("does not let role or quota be edited through the profile", () => {
    const out = userProfileSchema.parse({
      ...valid,
      role: "admin",
      ai_token_limit: 1,
    });
    expect(out).not.toHaveProperty("role");
    expect(out).not.toHaveProperty("ai_token_limit");
  });
});
