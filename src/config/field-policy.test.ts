import { describe, expect, it } from "vitest";
import {
  canRegenerate,
  datasetFieldPolicy,
  dmpFieldPolicy,
  planListPolicy,
  regenerateMode,
} from "@/config/field-policy";

// Regenerate is for free text the AI writes. A choice, a date, a number or
// an identifier is right or wrong, not phrased well or badly.
describe("which fields get “Regenerate with AI”", () => {
  it.each([
    ["plan title", dmpFieldPolicy.title],
    ["plan description", dmpFieldPolicy.description],
    ["output title", datasetFieldPolicy.title],
    ["output description", datasetFieldPolicy.description],
  ])("%s — yes", (_name, policy) => {
    expect(canRegenerate(policy)).toBe(true);
  });

  it.each([
    ["language (choice)", dmpFieldPolicy.language],
    ["access (choice)", datasetFieldPolicy.access],
    ["protection level (choice)", datasetFieldPolicy.protection_level],
    [
      "security classification (choice)",
      datasetFieldPolicy.security_classification_level,
    ],
    ["personal data (choice)", datasetFieldPolicy.personal_data],
    ["begin date", dmpFieldPolicy.begin_date],
    ["end date", dmpFieldPolicy.end_date],
    ["alternate identifier", dmpFieldPolicy.alternate_identifier],
    ["ethics report link", dmpFieldPolicy.ethical_issues_report],
    ["keywords (list)", datasetFieldPolicy.keyword],
    ["costs (list)", planListPolicy.cost],
  ])("%s — no", (_name, policy) => {
    expect(canRegenerate(policy)).toBe(false);
  });

  // The researcher's own words: the AI may polish them, never write them in.
  it.each([
    ["ethical issues description", dmpFieldPolicy.ethical_issues_description],
    ["preservation statement", datasetFieldPolicy["preservation.statement"]],
    ["personal data plan", datasetFieldPolicy.personal_data_plan],
  ])("%s, human-owned prose: a suggestion to accept", (_name, policy) => {
    expect(policy.permission).toBe("human");
    expect(regenerateMode(policy)).toBe("suggest");
  });

  it("indigenous considerations: no AI at all, not even a polish", () => {
    const policy = dmpFieldPolicy.indigenous_considerations;
    expect(policy.kind).toBe("prose");
    expect(regenerateMode(policy)).toBeNull();
    expect(canRegenerate(policy)).toBe(false);
  });

  it.each([
    ["plan title", dmpFieldPolicy.title],
    ["output description", datasetFieldPolicy.description],
  ])("%s, AI-owned prose: written in directly", (_name, policy) => {
    expect(regenerateMode(policy)).toBe("apply");
  });

  it("a field with no policy (data type, cost amount) is never offered", () => {
    expect(datasetFieldPolicy.type).toBeUndefined();
    expect(canRegenerate(datasetFieldPolicy.type)).toBe(false);
    expect(canRegenerate(undefined)).toBe(false);
  });
});
