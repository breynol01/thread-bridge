import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeCodexSession } from "../../src/writers/codexWriter.js";
import { readJsonlLines } from "../../src/utils/jsonl.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IRSession } from "../../src/schemas/common.js";

// Mock paths to use a temp dir
let tempHome: string;
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => tempHome,
  };
});

describe("codexWriter", () => {
  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "thread-bridge-test-"));
  });

  afterEach(() => {
    if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  });

  const testSession: IRSession = {
    id: "test-ir-001",
    sourceFormat: "claude",
    sourceModel: "claude-opus-4-6",
    cwd: "/Users/test/project",
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "Hello, list files" }],
        timestamp: "2026-02-08T19:00:00.000Z",
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", text: "User wants files listed" },
          { type: "text", text: "I'll list the files." },
          {
            type: "tool_call",
            id: "call_001",
            name: "Bash",
            arguments: '{"command":"ls -la"}',
          },
        ],
        timestamp: "2026-02-08T19:00:01.000Z",
      },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            toolCallId: "call_001",
            output: "file1.ts\nfile2.ts",
          },
        ],
        timestamp: "2026-02-08T19:00:02.000Z",
      },
      {
        role: "assistant",
        content: [{ type: "text", text: "Found: file1.ts and file2.ts" }],
        timestamp: "2026-02-08T19:00:03.000Z",
      },
    ],
  };

  it("generates output with dry-run", () => {
    const result = writeCodexSession(testSession, { dryRun: true });
    expect(result.sessionId).toBeDefined();
    expect(result.filePath).toContain(".codex/sessions/");
    expect(result.filePath).toContain("rollout-");
    expect(result.filePath).toContain(result.sessionId);
  });

  it("includes session ID in file path", () => {
    const result = writeCodexSession(testSession, { dryRun: true });
    expect(result.filePath).toContain(result.sessionId);
  });

  it("maps Claude tool names back to Codex names", () => {
    const result = writeCodexSession(testSession);
    const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
    const funcCalls = lines.filter(
      (l) =>
        l.type === "response_item" &&
        (l.payload as Record<string, unknown>)?.type === "function_call",
    );

    for (const line of funcCalls) {
      const payload = line.payload as Record<string, unknown>;
      expect(payload.name).toBe("exec_command");
    }
  });

  describe("turn_context emission", () => {
    it("emits turn_context before first assistant content", () => {
      const result = writeCodexSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];

      const turnContextLines = lines.filter((l) => l.type === "turn_context");
      expect(turnContextLines.length).toBe(1);

      const tc = turnContextLines[0]!;
      const payload = tc.payload as Record<string, unknown>;
      expect(payload.model).toBe("claude-opus-4-6");
    });

    it("emits turn_context before any response_item assistant message", () => {
      const result = writeCodexSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];

      const turnContextIdx = lines.findIndex((l) => l.type === "turn_context");
      const firstAssistantIdx = lines.findIndex(
        (l) =>
          l.type === "response_item" &&
          ((l.payload as Record<string, unknown>)?.role === "assistant" ||
            (l.payload as Record<string, unknown>)?.type === "reasoning" ||
            (l.payload as Record<string, unknown>)?.type === "function_call"),
      );

      expect(turnContextIdx).toBeGreaterThan(-1);
      expect(firstAssistantIdx).toBeGreaterThan(-1);
      expect(turnContextIdx).toBeLessThan(firstAssistantIdx);
    });

    it("uses 'unknown' model when sourceModel is not set", () => {
      const session: IRSession = {
        ...testSession,
        sourceModel: undefined,
      };
      const result = writeCodexSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];

      const turnContextLines = lines.filter((l) => l.type === "turn_context");
      expect(turnContextLines.length).toBe(1);

      const payload = turnContextLines[0]!.payload as Record<string, unknown>;
      expect(payload.model).toBe("unknown");
    });
  });
});
