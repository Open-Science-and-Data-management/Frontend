import { beforeEach, describe, expect, it } from "vitest";
import { clearPersistedState, jsonStorage, storageKey } from "@/store/persist";

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

  it("clears only its own namespace", () => {
    localStorage.setItem(storageKey("tasks"), "1");
    localStorage.setItem("theme", "dark");

    clearPersistedState();

    expect(localStorage.getItem(storageKey("tasks"))).toBeNull();
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
