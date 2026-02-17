import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { IRSession } from "../../src/schemas/common.js";
import { readCodexSession } from "../../src/readers/codexReader.js";
import { readClaudeSession } from "../../src/readers/claudeReader.js";
import { readOpenCodeSession } from "../../src/providers/opencode.js";

describe("IR schema validation", () => {
  it("validates codex reader output", () => {
    const file = join(
      __dirname,
      "..",
      "fixtures",
      "codex",
      "sessions",
      "2026",
      "02",
      "15",
      "rollout-2026-02-15T10-00-00-session-abc.jsonl",
    );

    const session = readCodexSession(file);
    expect(() => IRSession.parse(session)).not.toThrow();
  });

  it("validates claude reader output", () => {
    const file = join(__dirname, "..", "fixtures", "claude-session.jsonl");
    const session = readClaudeSession(file);
    expect(() => IRSession.parse(session)).not.toThrow();
  });

  it("validates opencode reader output", () => {
    const storage = join(__dirname, "..", "fixtures", "opencode", "storage");
    const file = join(storage, "session", "abc123", "ses_001.json");

    const session = readOpenCodeSession(file, storage);
    expect(() => IRSession.parse(session)).not.toThrow();
  });

  it("rejects malformed tool_call arguments type", () => {
    const invalid = {
      id: "bad-1",
      sourceFormat: "codex",
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_call",
              id: "call_1",
              name: "exec_command",
              arguments: { cmd: "ls" },
            },
          ],
        },
      ],
    };

    expect(() => IRSession.parse(invalid)).toThrow();
  });

  it("rejects malformed tool_result output type", () => {
    const invalid = {
      id: "bad-2",
      sourceFormat: "claude",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              toolCallId: "call_1",
              output: { value: 1 },
            },
          ],
        },
      ],
    };

    expect(() => IRSession.parse(invalid)).toThrow();
  });

  it("ensures tool_result references existing tool_call ids in fixtures", () => {
    const codexFile = join(
      __dirname,
      "..",
      "fixtures",
      "codex",
      "sessions",
      "2026",
      "02",
      "15",
      "rollout-2026-02-15T10-00-00-session-abc.jsonl",
    );
    const claudeFile = join(__dirname, "..", "fixtures", "claude-session.jsonl");
    const opencodeStorage = join(__dirname, "..", "fixtures", "opencode", "storage");
    const opencodeFile = join(opencodeStorage, "session", "abc123", "ses_001.json");

    const sessions = [
      readCodexSession(codexFile),
      readClaudeSession(claudeFile),
      readOpenCodeSession(opencodeFile, opencodeStorage),
    ];

    for (const session of sessions) {
      const callIds = new Set(
        session.messages.flatMap((m) =>
          m.content
            .filter((block) => block.type === "tool_call")
            .map((block) => (block.type === "tool_call" ? block.id : ""))
            .filter(Boolean),
        ),
      );

      const resultIds = session.messages.flatMap((m) =>
        m.content
          .filter((block) => block.type === "tool_result")
          .map((block) => (block.type === "tool_result" ? block.toolCallId : ""))
          .filter(Boolean),
      );

      for (const toolCallId of resultIds) {
        expect(callIds.has(toolCallId)).toBe(true);
      }
    }
  });

  it("ensures fixture tool_call arguments are valid JSON strings", () => {
    const claudeFile = join(__dirname, "..", "fixtures", "claude-session.jsonl");
    const session = readClaudeSession(claudeFile);

    const toolCalls = session.messages.flatMap((m) =>
      m.content.filter((block) => block.type === "tool_call"),
    );

    for (const toolCall of toolCalls) {
      if (toolCall.type !== "tool_call") continue;
      expect(() => JSON.parse(toolCall.arguments)).not.toThrow();
    }
  });
});
