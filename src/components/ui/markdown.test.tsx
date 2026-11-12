import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./markdown";

const html = (text: string) => renderToStaticMarkup(<Markdown>{text}</Markdown>);

describe("Markdown", () => {
  it("renders emphasis and lists instead of showing the markers", () => {
    const out = html("Use **open** access:\n\n* one\n* two");
    expect(out).toContain('<strong class="font-semibold">open</strong>');
    expect(out).toContain("<ul");
    expect(out).not.toContain("**");
  });

  it("shows raw HTML in a reply as text, never as markup", () => {
    const out = html('<script>alert(1)</script><b onclick="x()">hi</b>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<b ");
  });

  it("drops images, so a reply can't load anything", () => {
    expect(html("![x](https://example.com/t.png)")).not.toContain("<img");
  });

  it("opens links in a new tab without handing over the page", () => {
    const out = html("[guide](https://example.com)");
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});
