import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  listOpenCodeSessionsFromDir,
  readOpenCodeSession,
} from "../../src/providers/opencode.js";

const JSON_FIXTURE_DIR = join(__dirname, "..", "fixtures", "opencode", "storage");
const SQLITE_ONLY_ROOT = join(__dirname, "..", "fixtures", "opencode", "sqlite-only");
const MIXED_ROOT = join(__dirname, "..", "fixtures", "opencode", "mixed");

describe("OpenCode provider", () => {
  describe("listOpenCodeSessionsFromDir", () => {
    it("discovers sessions from fixture JSON storage", () => {
      const sessions = listOpenCodeSessionsFromDir(JSON_FIXTURE_DIR);
      expect(sessions.length).toBe(1);
      expect(sessions[0]!.id).toBe("ses_001");
      expect(sessions[0]!.provider).toBe("opencode");
      expect(sessions[0]!.title).toBe("Test session for thread-bridge");
      expect(sessions[0]!.projectDir).toBe("/Users/test/my-project");
    });

    it("returns empty array for non-existent dir", () => {
      const sessions = listOpenCodeSessionsFromDir("/nonexistent/path");
      expect(sessions).toEqual([]);
    });

    it("reads sqlite sessions when only sqlite storage exists", () => {
      const sessions = listOpenCodeSessionsFromDir(
        join(SQLITE_ONLY_ROOT, "storage"),
        { sqliteDbPath: join(SQLITE_ONLY_ROOT, "db.sqlite") },
      );

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe("ses_sql_001");
      expect(sessions[0]!.filePath.startsWith("sqlite:")).toBe(true);
    });

    it("prefers JSON source in mixed storage mode", () => {
      const sessions = listOpenCodeSessionsFromDir(
        join(MIXED_ROOT, "storage"),
        { sqliteDbPath: join(MIXED_ROOT, "db.sqlite") },
      );

      expect(sessions).toHaveLength(1);
      expect(sessions[0]!.id).toBe("ses_001");
      expect(sessions[0]!.filePath.endsWith("ses_001.json")).toBe(true);
    });

    it("fails soft when sqlite module cannot be loaded", () => {
      const sessions = listOpenCodeSessionsFromDir(
        join(SQLITE_ONLY_ROOT, "storage"),
        {
          sqliteDbPath: join(SQLITE_ONLY_ROOT, "db.sqlite"),
          loadSqliteModule: () => undefined,
        },
      );

      expect(sessions).toEqual([]);
    });
  });

  describe("readOpenCodeSession", () => {
    it("reads session with messages and parts from JSON storage", () => {
      const sessionFile = join(JSON_FIXTURE_DIR, "session", "abc123", "ses_001.json");
      const ir = readOpenCodeSession(sessionFile, JSON_FIXTURE_DIR);

      expect(ir.id).toBe("ses_001");
      expect(ir.sourceFormat).toBe("opencode");
      expect(ir.cwd).toBe("/Users/test/my-project");
      expect(ir.name).toBe("Test session for thread-bridge");
      expect(ir.sourceModel).toBe("openai/gpt-4");
      expect(ir.metadata?.opencodeSource).toBe("json");
    });

    it("parses user text message", () => {
      const sessionFile = join(JSON_FIXTURE_DIR, "session", "abc123", "ses_001.json");
      const ir = readOpenCodeSession(sessionFile, JSON_FIXTURE_DIR);

      const userMsg = ir.messages.find((m) => m.role === "user");
      expect(userMsg).toBeDefined();
      expect(userMsg!.content.length).toBe(1);
      expect(userMsg!.content[0]!.type).toBe("text");
      if (userMsg!.content[0]!.type === "text") {
        expect(userMsg!.content[0]!.text).toBe(
          "Hello, can you help me with a coding task?",
        );
      }
    });

    it("parses assistant text + tool call + tool result", () => {
      const sessionFile = join(JSON_FIXTURE_DIR, "session", "abc123", "ses_001.json");
      const ir = readOpenCodeSession(sessionFile, JSON_FIXTURE_DIR);

      const assistantMsg = ir.messages.find((m) => m.role === "assistant");
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.content.length).toBe(3);

      const text = assistantMsg!.content.find((b) => b.type === "text");
      expect(text).toBeDefined();

      const toolCall = assistantMsg!.content.find((b) => b.type === "tool_call");
      expect(toolCall).toBeDefined();
      if (toolCall?.type === "tool_call") {
        expect(toolCall.name).toBe("bash");
        expect(toolCall.id).toBe("call_abc");
      }

      const toolResult = assistantMsg!.content.find((b) => b.type === "tool_result");
      expect(toolResult).toBeDefined();
      if (toolResult?.type === "tool_result") {
        expect(toolResult.toolCallId).toBe("call_abc");
        expect(toolResult.output).toContain("total 8");
      }
    });

    it("returns empty session for non-existent file", () => {
      const ir = readOpenCodeSession("/nonexistent/session.json", JSON_FIXTURE_DIR);
      expect(ir.id).toBe("unknown");
      expect(ir.messages).toEqual([]);
    });

    it("sorts messages by timestamp", () => {
      const sessionFile = join(JSON_FIXTURE_DIR, "session", "abc123", "ses_001.json");
      const ir = readOpenCodeSession(sessionFile, JSON_FIXTURE_DIR);

      expect(ir.messages.length).toBe(2);
      expect(ir.messages[0]!.role).toBe("user");
      expect(ir.messages[1]!.role).toBe("assistant");
    });

    it("reads sqlite session from sqlite ref", () => {
      const dbPath = join(SQLITE_ONLY_ROOT, "db.sqlite");
      const ir = readOpenCodeSession(`sqlite:${dbPath}#ses_sql_001`);

      expect(ir.id).toBe("ses_sql_001");
      expect(ir.messages.length).toBe(2);
      expect(ir.sourceModel).toBe("openai/gpt-4.1");
      expect(ir.metadata?.opencodeSource).toBe("sqlite");

      const assistant = ir.messages.find((m) => m.role === "assistant");
      const toolCall = assistant?.content.find((c) => c.type === "tool_call");
      const toolResult = assistant?.content.find((c) => c.type === "tool_result");

      expect(toolCall && toolCall.type === "tool_call" && toolCall.id).toBe("call_sql_001");
      expect(toolResult && toolResult.type === "tool_result" && toolResult.toolCallId).toBe("call_sql_001");
    });
  });
});
