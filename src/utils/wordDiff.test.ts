import { describe, expect, it } from "vitest";
import { wordDiff } from "@/utils/wordDiff";

const join = (parts: ReturnType<typeof wordDiff>, keep: "before" | "after") =>
  parts
    .filter(
      (p) =>
        p.kind === "same" ||
        p.kind === (keep === "before" ? "removed" : "added"),
    )
    .map((p) => p.text)
    .join("");

describe("a word diff of a suggested rewrite", () => {
  it("marks only the words that changed", () => {
    expect(
      wordDiff("we don't record names", "We do not record names."),
    ).toEqual([
      { kind: "removed", text: "we don't " },
      { kind: "added", text: "We do not " },
      { kind: "same", text: "record " },
      { kind: "removed", text: "names" },
      { kind: "added", text: "names." },
    ]);
  });

  it.each([
    ["Raw reads from the field.", "Raw FASTQ reads, collected in the field."],
    ["", "A new description"],
    ["Something to remove", ""],
    ["  spaced   out  ", "spaced out"],
  ])("gives back both texts exactly: %j → %j", (before, after) => {
    const parts = wordDiff(before, after);
    expect(join(parts, "before")).toBe(before);
    expect(join(parts, "after")).toBe(after);
  });

  it("shows a very long rewrite whole instead of diffing it", () => {
    const long = Array.from({ length: 1500 }, (_, i) => `w${i}`).join(" ");
    expect(wordDiff(long, "short").map((p) => p.kind)).toEqual([
      "removed",
      "added",
    ]);
  });
});
