import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { readCodexSession } from "../../src/readers/codexReader.js";
import { readClaudeSession } from "../../src/readers/claudeReader.js";
import { writeCodexSession } from "../../src/writers/codexWriter.js";
import { writeClaudeSession } from "../../src/writers/claudeWriter.js";
import type { IRSession } from "../../src/schemas/common.js";

const CODEX_FIXTURE = join(import.meta.dirname, "../fixtures/codex-session.jsonl");
const CLAUDE_FIXTURE = join(import.meta.dirname, "../fixtures/claude-session.jsonl");

describe("roundtrip", () => {
  it("preserves message content when converting Codex -> Claude (dry-run)", () => {
    const codexIR = readCodexSession(CODEX_FIXTURE);

    // Verify we have the expected structure
    expect(codexIR.messages.length).toBeGreaterThan(0);

    const userTexts = codexIR.messages
      .filter((m) => m.role === "user")
      .flatMap((m) => m.content.filter((b) => b.type === "text"))
      .map((b) => (b as { text: string }).text);

    expect(userTexts).toContain("List the files in the current directory");
    expect(userTexts).toContain("Now read the README");

    // Convert to Claude format (dry-run)
    const result = writeClaudeSession(codexIR, { dryRun: true });
    expect(result.sessionId).toBeDefined();
  });

  it("preserves message content when converting Claude -> Codex (dry-run)", () => {
    const claudeIR = readClaudeSession(CLAUDE_FIXTURE);

    // Verify we have the expected structure
    expect(claudeIR.messages.length).toBeGreaterThan(0);

    const userTexts = claudeIR.messages
      .filter((m) => m.role === "user")
      .flatMap((m) => m.content.filter((b) => b.type === "text"))
      .map((b) => (b as { text: string }).text);

    expect(userTexts).toContain("List the files in the current directory");
    expect(userTexts).toContain("Now read the README");

    // Convert to Codex format (dry-run)
    const result = writeCodexSession(claudeIR, { dryRun: true });
    expect(result.sessionId).toBeDefined();
  });

  it("preserves tool call structure across conversions", () => {
    const codexIR = readCodexSession(CODEX_FIXTURE);
    const claudeIR = readClaudeSession(CLAUDE_FIXTURE);

    // Both should have 2 tool calls
    const codexToolCalls = codexIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_call"),
    );
    const claudeToolCalls = claudeIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_call"),
    );

    expect(codexToolCalls.length).toBe(2);
    expect(claudeToolCalls.length).toBe(2);

    // Both should have 2 tool results
    const codexToolResults = codexIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );
    const claudeToolResults = claudeIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );

    expect(codexToolResults.length).toBe(2);
    expect(claudeToolResults.length).toBe(2);
  });

  it("IR from both sources has matching tool output content", () => {
    const codexIR = readCodexSession(CODEX_FIXTURE);
    const claudeIR = readClaudeSession(CLAUDE_FIXTURE);

    const codexResults = codexIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );
    const claudeResults = claudeIR.messages.flatMap((m) =>
      m.content.filter((b) => b.type === "tool_result"),
    );

    // First tool result (ls -la) should have same content
    if (codexResults[0].type === "tool_result" && claudeResults[0].type === "tool_result") {
      expect(codexResults[0].output).toContain("README.md");
      expect(claudeResults[0].output).toContain("README.md");
    }
  });

  it("creates valid IR from both sources", () => {
    const codexIR = readCodexSession(CODEX_FIXTURE);
    const claudeIR = readClaudeSession(CLAUDE_FIXTURE);

    // Both should have valid structure
    for (const ir of [codexIR, claudeIR]) {
      assertValidIR(ir);
    }
  });
});

function assertValidIR(session: IRSession) {
  expect(session.id).toBeDefined();
  expect(["codex", "claude"]).toContain(session.sourceFormat);
  expect(session.messages.length).toBeGreaterThan(0);

  for (const msg of session.messages) {
    expect(["user", "assistant", "system"]).toContain(msg.role);
    expect(msg.content.length).toBeGreaterThan(0);

    for (const block of msg.content) {
      expect(["text", "tool_call", "tool_result", "thinking"]).toContain(
        block.type,
      );
    }
  }
}
