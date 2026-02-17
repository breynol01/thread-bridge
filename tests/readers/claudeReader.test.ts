import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readClaudeSession } from "../../src/readers/claudeReader.js";

const FIXTURE = join(import.meta.dirname, "../fixtures/claude-session.jsonl");

describe("claudeReader", () => {
  it("parses session metadata", () => {
    const session = readClaudeSession(FIXTURE);
    expect(session.id).toBe("test-claude-session-001");
    expect(session.cwd).toBe("/Users/test/project");
    expect(session.sourceFormat).toBe("claude");
    expect(session.sourceModel).toBe("claude-opus-4-6");
  });

  it("extracts user text messages", () => {
    const session = readClaudeSession(FIXTURE);
    const userTextMsgs = session.messages.filter(
      (m) =>
        m.role === "user" && m.content.some((b) => b.type === "text"),
    );
    expect(userTextMsgs.length).toBeGreaterThanOrEqual(2);
  });

  it("deduplicates streaming assistant messages", () => {
    const session = readClaudeSession(FIXTURE);
    // msg-001 appears 3 times in the fixture but should be deduped to 1
    const assistantMsgs = session.messages.filter(
      (m) => m.role === "assistant",
    );
    // Should have at most one entry per unique message id
    // msg-001 (with thinking + text + tool_use), msg-002, msg-003, msg-004
    expect(assistantMsgs.length).toBe(4);
  });

  it("extracts tool calls with mapped names", () => {
    const session = readClaudeSession(FIXTURE);
    const toolCalls = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_call"),
    );
    expect(toolCalls.length).toBe(2);

    // Bash -> exec_command
    const bashCall = toolCalls.find(
      (b) => b.type === "tool_call" && b.name === "exec_command",
    );
    expect(bashCall).toBeDefined();
    if (bashCall && bashCall.type === "tool_call") {
      const args = JSON.parse(bashCall.arguments);
      expect(args.cmd).toBe("ls -la");
    }

    // Read -> read_file
    const readCall = toolCalls.find(
      (b) => b.type === "tool_call" && b.name === "read_file",
    );
    expect(readCall).toBeDefined();
  });

  it("extracts tool results", () => {
    const session = readClaudeSession(FIXTURE);
    const toolResults = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );
    expect(toolResults.length).toBe(2);
  });

  it("extracts thinking blocks", () => {
    const session = readClaudeSession(FIXTURE);
    const thinking = session.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "thinking"),
    );
    expect(thinking.length).toBeGreaterThanOrEqual(1);
    if (thinking[0].type === "thinking") {
      expect(thinking[0].text).toContain("list files");
    }
  });

  it("extracts gitBranch from session lines", () => {
    const session = readClaudeSession(FIXTURE);
    expect(session.gitBranch).toBe("main");
  });

  it("extracts claudeVersion from session lines", () => {
    const session = readClaudeSession(FIXTURE);
    expect(session.claudeVersion).toBe("2.1.37");
  });

  it("extracts slug from session lines", () => {
    const session = readClaudeSession(FIXTURE);
    expect(session.slug).toBe("test-session");
  });

  it("skips file-history-snapshot and progress lines", () => {
    const session = readClaudeSession(FIXTURE);
    // No messages should contain snapshot data
    const all = session.messages.flatMap((m) =>
      m.content.filter(
        (b) => b.type === "text" && b.text.includes("trackedFileBackups"),
      ),
    );
    expect(all.length).toBe(0);
  });
});
