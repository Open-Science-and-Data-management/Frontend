import { beforeEach, describe, expect, it } from "vitest";
import { jsonStorage, storageKey } from "@/store/persist";

beforeEach(() => localStorage.clear());

describe("persisted storage", () => {
  it("namespaces its keys", () => {
    expect(storageKey("tasks")).toBe("dmp-researcher/tasks");
  });

  it("revives timestamps as Dates", () => {
    const when = new Date("2025-05-20T10:30:00.000Z");
    jsonStorage!.setItem("k", { state: { when }, version: 1 });

    const read = jsonStorage!.getItem("k") as { state: { when: Date } };
    expect(read.state.when).toBeInstanceOf(Date);
    expect(read.state.when.getTime()).toBe(when.getTime());
  });

  it("leaves date-shaped strings alone", () => {
    // Form values like an <input type="date"> are strings and must stay strings.
    jsonStorage!.setItem("k", {
      state: { plain: "2025-05-20", notADate: "hello" },
      version: 1,
    });

    const read = jsonStorage!.getItem("k") as {
      state: { plain: unknown; notADate: unknown };
    };
    expect(read.state.plain).toBe("2025-05-20");
    expect(read.state.notADate).toBe("hello");
  });
});

describe("a pasted DOI is not proof of a deposit", () => {
  it("never classifies pasted evidence as a repository record", async () => {
    const { classifyPastedEvidence, looksLikeDoi } =
      await import("@/config/task-evidence");

    // A journal article DOI looks exactly like a dataset deposit DOI.
    const article = classifyPastedEvidence("https://doi.org/10.1038/s41586-1");
    expect(looksLikeDoi("https://doi.org/10.1038/s41586-1")).toBe(true);
    expect(article.type).toBe("url");
    expect(article.label).toBe("10.1038/s41586-1");

    expect(classifyPastedEvidence("https://example.org/out.csv").type).toBe(
      "url",
    );
  });

  it("flags system-verified work as still awaiting the repository", async () => {
    const { awaitingVerification } = await import("@/config/task-evidence");

    const task = {
      dataset_id: "d1",
      lifecycle_stage: "share",
      evidence: { type: "url", ref: "https://doi.org/10.1038/x" },
    };

    expect(awaitingVerification(task as never)).toBe(true);
  });

  it("tolerates a row stored before evidence existed", async () => {
    const { evidenceSatisfies } = await import("@/config/task-evidence");

    const legacy = { dataset_id: "d1", lifecycle_stage: "process" };
    expect(evidenceSatisfies(legacy as never)).toBe(false);

    const general = { lifecycle_stage: "collect" };
    expect(evidenceSatisfies(general as never)).toBe(true);
  });
});
