import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeClaudeSession } from "../../src/writers/claudeWriter.js";
import { readJsonlLines } from "../../src/utils/jsonl.js";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { IRSession } from "../../src/schemas/common.js";

// Mock child_process to avoid real git/claude calls in tests
vi.mock("node:child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("git rev-parse")) return "main\n";
    if (cmd.includes("claude --version")) return "2.1.37\n";
    return "";
  }),
}));

// Mock paths to use a temp dir so writes don't pollute real ~/.claude
let tempHome: string;
vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return {
    ...actual,
    homedir: () => tempHome,
  };
});

describe("claudeWriter", () => {
  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "thread-bridge-test-"));
  });

  afterEach(() => {
    if (tempHome) rmSync(tempHome, { recursive: true, force: true });
  });

  const testSession: IRSession = {
    id: "test-ir-002",
    sourceFormat: "codex",
    sourceModel: "gpt-5.2-codex",
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
          { type: "text", text: "I'll list the files." },
          {
            type: "tool_call",
            id: "call_001",
            name: "exec_command",
            arguments: '{"cmd":"ls -la"}',
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
    const result = writeClaudeSession(testSession, { dryRun: true });
    expect(result.sessionId).toBeDefined();
    expect(result.filePath).toContain(".claude/projects/");
    expect(result.filePath).toContain(result.sessionId);
  });

  it("includes session ID in file path", () => {
    const result = writeClaudeSession(testSession, { dryRun: true });
    expect(result.filePath).toContain(`${result.sessionId}.jsonl`);
  });

  describe("written output fidelity", () => {
    it("uses Anthropic-format message IDs (msg_01...)", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        expect(msg.id).toMatch(/^msg_01[A-Za-z0-9]{24}$/);
      }
    });

    it("uses Anthropic-format request IDs (req_01...)", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        expect(line.requestId).toMatch(/^req_01[A-Za-z0-9]{24}$/);
      }
    });

    it("uses default Claude model for non-Claude source models", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        // Should NOT be "converted" or the original codex model
        expect(msg.model).not.toBe("converted");
        expect(msg.model).not.toBe("gpt-5.2-codex");
        expect(msg.model).toMatch(/^claude-/);
      }
    });

    it("preserves valid Claude model from source", () => {
      const session: IRSession = {
        ...testSession,
        sourceFormat: "claude",
        sourceModel: "claude-opus-4-6",
      };
      const result = writeClaudeSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        expect(msg.model).toBe("claude-opus-4-6");
      }
    });

    it("sets stop_reason to null (not hardcoded end_turn)", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        expect(msg.stop_reason).toBeNull();
      }
    });

    it("omits usage when source has no usage data", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        expect(msg.usage).toBeUndefined();
      }
    });

    it("includes usage when source provides it", () => {
      const session: IRSession = {
        ...testSession,
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      const result = writeClaudeSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const assistantLines = lines.filter((l) => l.type === "assistant");

      for (const line of assistantLines) {
        const msg = line.message as Record<string, unknown>;
        expect(msg.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
      }
    });

    it("uses real version string (not thread-bridge-0.1.0)", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const userLines = lines.filter((l) => l.type === "user");

      for (const line of userLines) {
        expect(line.version).not.toBe("thread-bridge-0.1.0");
        // Should be a semver-like string
        expect(line.version).toMatch(/^\d+\.\d+\.\d+/);
      }
    });

    it("includes gitBranch on all message lines", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const messageLines = lines.filter(
        (l) => l.type === "user" || l.type === "assistant",
      );

      for (const line of messageLines) {
        expect(line.gitBranch).toBe("main");
      }
    });

    it("preserves gitBranch from IR session", () => {
      const session: IRSession = {
        ...testSession,
        gitBranch: "feature-branch",
      };
      const result = writeClaudeSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const messageLines = lines.filter(
        (l) => l.type === "user" || l.type === "assistant",
      );

      for (const line of messageLines) {
        expect(line.gitBranch).toBe("feature-branch");
      }
    });

    it("generates slug from first user message", () => {
      const result = writeClaudeSession(testSession);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const messageLines = lines.filter(
        (l) => l.type === "user" || l.type === "assistant",
      );

      for (const line of messageLines) {
        expect(line.slug).toBe("hello-list-files");
      }
    });

    it("preserves slug from IR session", () => {
      const session: IRSession = {
        ...testSession,
        slug: "my-custom-slug",
      };
      const result = writeClaudeSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const messageLines = lines.filter(
        (l) => l.type === "user" || l.type === "assistant",
      );

      for (const line of messageLines) {
        expect(line.slug).toBe("my-custom-slug");
      }
    });

    it("creates session-env directory", () => {
      const result = writeClaudeSession(testSession);
      const envDir = join(tempHome, ".claude", "session-env", result.sessionId);
      expect(existsSync(envDir)).toBe(true);
    });

    it("preserves claudeVersion from IR session", () => {
      const session: IRSession = {
        ...testSession,
        claudeVersion: "2.2.0",
      };
      const result = writeClaudeSession(session);
      const lines = readJsonlLines(result.filePath) as Record<string, unknown>[];
      const userLines = lines.filter((l) => l.type === "user");

      for (const line of userLines) {
        expect(line.version).toBe("2.2.0");
      }
    });
  });
});
