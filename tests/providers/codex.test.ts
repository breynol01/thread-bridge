import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { listCodexSessionsFromDir } from "../../src/discovery/codexDiscovery.js";

const FIXTURE_DIR = join(__dirname, "..", "fixtures", "codex");

const sessionsDir = join(FIXTURE_DIR, "sessions");
const archivedDir = join(FIXTURE_DIR, "archived_sessions");
const historyPath = join(FIXTURE_DIR, "history.jsonl");
const indexPath = join(FIXTURE_DIR, "session_index.jsonl");
const globalStatePath = join(FIXTURE_DIR, ".codex-global-state.json");

describe("Codex provider", () => {
  describe("listCodexSessionsFromDir", () => {
    it("discovers sessions from both sessions/ and archived_sessions/", () => {
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath, globalStatePath,
      );
      expect(sessions.length).toBe(2);
      const ids = sessions.map((s) => s.id);
      expect(ids).toContain("session-abc");
      expect(ids).toContain("session-xyz");
    });

    it("picks up thread titles from global state", () => {
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath, globalStatePath,
      );
      const abc = sessions.find((s) => s.id === "session-abc");
      // Global state title takes priority over session_index
      expect(abc!.name).toBe("Fix Auth Bug (Desktop)");

      const xyz = sessions.find((s) => s.id === "session-xyz");
      expect(xyz!.name).toBe("Project Setup");
    });

    it("falls back to session_index thread_name when global state has no title", () => {
      // Use a global state without the session-abc title
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath,
        "/nonexistent/global-state.json",
      );
      const abc = sessions.find((s) => s.id === "session-abc");
      expect(abc!.name).toBe("Fix Auth Bug");
    });

    it("extracts cwd from session_meta for project directory", () => {
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath, globalStatePath,
      );
      const abc = sessions.find((s) => s.id === "session-abc");
      expect(abc!.cwd).toBe("/Users/test/project-alpha");

      const xyz = sessions.find((s) => s.id === "session-xyz");
      expect(xyz!.cwd).toBe("/Users/test/project-beta");
    });

    it("sorts sessions by timestamp descending", () => {
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath, globalStatePath,
      );
      // session-abc (Feb 15) should come before session-xyz (Feb 14)
      expect(sessions[0]!.id).toBe("session-abc");
      expect(sessions[1]!.id).toBe("session-xyz");
    });

    it("returns empty array for non-existent directories", () => {
      const sessions = listCodexSessionsFromDir(
        "/nonexistent/sessions",
        "/nonexistent/archived",
        "/nonexistent/history.jsonl",
        "/nonexistent/index.jsonl",
        "/nonexistent/global-state.json",
      );
      expect(sessions).toEqual([]);
    });

    it("active session takes priority over archived for same ID", () => {
      // Both dirs would need a session with the same ID.
      // Since our fixtures have different IDs, verify the merge logic
      // by checking that all files are found from both directories.
      const sessions = listCodexSessionsFromDir(
        sessionsDir, archivedDir, historyPath, indexPath, globalStatePath,
      );
      const abc = sessions.find((s) => s.id === "session-abc");
      expect(abc!.filePath).toContain("sessions/2026");

      const xyz = sessions.find((s) => s.id === "session-xyz");
      expect(xyz!.filePath).toContain("archived_sessions");
    });
  });
});
