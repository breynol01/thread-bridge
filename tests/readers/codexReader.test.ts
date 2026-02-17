import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readCodexSession } from "../../src/readers/codexReader.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/codex-session.jsonl");

describe("codexReader", () => {
  it("parses session metadata", () => {
    const session = readCodexSession(FIXTURE);
    expect(session.id).toBe("test-codex-session-001");
    expect(session.cwd).toBe("/Users/test/project");
    expect(session.sourceFormat).toBe("codex");
    expect(session.sourceModel).toBe("gpt-5.2-codex");
  });

  it("extracts user messages", () => {
    const session = readCodexSession(FIXTURE);
    const userMsgs = session.messages.filter((m) => m.role === "user");
    // Two user text messages + two tool results
    const textMsgs = userMsgs.filter((m) =>
      m.content.some((b) => b.type === "text"),
    );
    expect(textMsgs.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts assistant text messages", () => {
    const session = readCodexSession(FIXTURE);
    const assistantMsgs = session.messages.filter((m) => m.role === "assistant");
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);

    // Check that assistant messages have text content
    const hasText = assistantMsgs.some((m) =>
      m.content.some((b) => b.type === "text"),
    );
    expect(hasText).toBe(true);
  });

  it("extracts tool calls with mapped names", () => {
    const session = readCodexSession(FIXTURE);
    const toolCalls = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_call"),
    );
    expect(toolCalls.length).toBe(2);

    // exec_command -> Bash
    const bashCall = toolCalls.find(
      (b) => b.type === "tool_call" && b.name === "Bash",
    );
    expect(bashCall).toBeDefined();
    if (bashCall && bashCall.type === "tool_call") {
      const args = JSON.parse(bashCall.arguments);
      expect(args.command).toBe("ls -la");
    }

    // read_file -> Read
    const readCall = toolCalls.find(
      (b) => b.type === "tool_call" && b.name === "Read",
    );
    expect(readCall).toBeDefined();
    if (readCall && readCall.type === "tool_call") {
      const args = JSON.parse(readCall.arguments);
      expect(args.file_path).toBe("/Users/test/project/README.md");
    }
  });

  it("extracts tool results", () => {
    const session = readCodexSession(FIXTURE);
    const toolResults = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );
    expect(toolResults.length).toBe(2);
    expect(toolResults[0].type === "tool_result" && toolResults[0].toolCallId).toBe(
      "call_test001",
    );
  });

  it("extracts thinking/reasoning blocks", () => {
    const session = readCodexSession(FIXTURE);
    const thinking = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "thinking"),
    );
    expect(thinking.length).toBe(1);
    if (thinking[0].type === "thinking") {
      expect(thinking[0].text).toContain("directory contents");
    }
  });

  it("skips developer messages", () => {
    const session = readCodexSession(FIXTURE);
    // Developer messages should not appear in IR
    const allContent = session.messages.flatMap((m) =>
      m.content.filter(
        (b) => b.type === "text" && b.text.includes("System instructions"),
      ),
    );
    expect(allContent.length).toBe(0);
  });
});
