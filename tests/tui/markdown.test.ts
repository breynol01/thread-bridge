import { describe, it, expect } from "vitest";
import { parseInlineMarkdown, parseMarkdownLines } from "../../src/tui/MarkdownRenderer.js";

describe("MarkdownRenderer", () => {
  it("parses inline bold, italic, and code markers", () => {
    const segments = parseInlineMarkdown("Hello **world** *from* `code`");
    expect(segments).toHaveLength(6);
    expect(segments[1]).toMatchObject({ text: "world", bold: true });
    expect(segments[3]).toMatchObject({ text: "from", italic: true });
    expect(segments[5]).toMatchObject({ text: "code", inverse: true });
  });

  it("recognizes blockquotes and lists", () => {
    const lines = parseMarkdownLines("> quote line\n- bullet item\n1. numbered entry\nplain text");
    expect(lines[0].segments[0].text).toBe("> ");
    expect(lines[0].segments[1].text).toBe("quote line");
    expect(lines[1].segments[0].text).toBe("• ");
    expect(lines[2].segments[0].text).toBe("1. ");
    expect(lines[3].segments[0].text).toBe("plain text");
  });

  it("renders fenced code blocks as literal lines", () => {
    const lines = parseMarkdownLines("before\n```ts\nconst x = 1;\n```\nafter");
    expect(lines).toHaveLength(3);
    expect(lines[0].segments[0].text).toBe("before");
    expect(lines[1].segments[0]).toMatchObject({
      text: "const x = 1;",
      inverse: true,
      dim: true,
    });
    expect(lines[2].segments[0].text).toBe("after");
  });
});
