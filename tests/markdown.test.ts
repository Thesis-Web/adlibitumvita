import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/markdown.js";

describe("markdown sanitizer", () => {
  it("renders plain markdown to HTML", () => {
    expect(renderMarkdown("# Hello\n\nSome *text*.")).toContain("<h1>Hello</h1>");
  });

  it("strips inline script tags", () => {
    const html = renderMarkdown('# Title\n\n<script>alert("xss")</script>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert(");
  });

  it("strips event handler attributes on allowed tags", () => {
    const html = renderMarkdown('<img src="x.jpg" onerror="alert(1)" alt="x">');
    expect(html).not.toContain("onerror");
  });

  it("strips javascript: URLs in links", () => {
    const html = renderMarkdown("[click me](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("keeps safe formatting tags", () => {
    const html = renderMarkdown("**bold** and _em_ text with a [link](https://example.com)");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com"');
  });
});
