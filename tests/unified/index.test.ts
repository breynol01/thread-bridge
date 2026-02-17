import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionSummary } from "../../src/providers/types.js";

// Mock the registry to avoid reading real session files
vi.mock("../../src/providers/registry.js", () => ({
  listAllSessions: vi.fn(),
}));

// Mock normalizeProjectDir to control worktree resolution in tests
vi.mock("../../src/utils/paths.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils/paths.js")>("../../src/utils/paths.js");
  return {
    ...actual,
    normalizeProjectDir: vi.fn((dir: string) => {
      // Simulate: worktree paths resolve to their project name portion
      const worktreeMatch = dir.match(/\/\.codex\/worktrees\/[^/]+\/(.+)$/);
      if (worktreeMatch) {
        return `/Users/test/${worktreeMatch[1]}`;
      }
      return dir;
    }),
  };
});

import { listAllSessions } from "../../src/providers/registry.js";
import { getUnifiedIndex, getSessionsForProject, getAllSessions } from "../../src/unified/index.js";

const mockSessions: SessionSummary[] = [
  {
    id: "s1",
    provider: "claude",
    title: "Claude session 1",
    projectDir: "/Users/test/project-a",
    timestamp: "2026-02-12T10:00:00.000Z",
    filePath: "/path/to/s1.jsonl",
  },
  {
    id: "s2",
    provider: "codex",
    title: "Codex session 1",
    projectDir: "/Users/test/project-a",
    timestamp: "2026-02-11T10:00:00.000Z",
    filePath: "/path/to/s2.jsonl",
  },
  {
    id: "s3",
    provider: "opencode",
    title: "OpenCode session 1",
    projectDir: "/Users/test/project-b",
    timestamp: "2026-02-13T10:00:00.000Z",
    filePath: "/path/to/s3.json",
  },
  {
    id: "s4",
    provider: "claude",
    title: "No project session",
    projectDir: undefined,
    timestamp: "2026-02-10T10:00:00.000Z",
    filePath: "/path/to/s4.jsonl",
  },
];

beforeEach(() => {
  // Return sessions sorted by timestamp desc, matching real listAllSessions behavior
  const sorted = [...mockSessions].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  vi.mocked(listAllSessions).mockReturnValue(sorted);
});

describe("unified index", () => {
  describe("getUnifiedIndex", () => {
    it("groups sessions by project directory", () => {
      const groups = getUnifiedIndex();
      expect(groups.length).toBe(3);
    });

    it("sorts groups by most recent session", () => {
      const groups = getUnifiedIndex();
      // project-b has the most recent session (Feb 13)
      expect(groups[0]!.projectDir).toBe("/Users/test/project-b");
      // project-a has Feb 12
      expect(groups[1]!.projectDir).toBe("/Users/test/project-a");
      // no project has Feb 10
      expect(groups[2]!.projectDir).toBe("(no project)");
    });

    it("places sessions without projectDir under '(no project)'", () => {
      const groups = getUnifiedIndex();
      const noProject = groups.find((g) => g.projectDir === "(no project)");
      expect(noProject).toBeDefined();
      expect(noProject!.sessions.length).toBe(1);
      expect(noProject!.sessions[0]!.id).toBe("s4");
    });

    it("preserves session order within groups", () => {
      const groups = getUnifiedIndex();
      const projectA = groups.find((g) => g.projectDir === "/Users/test/project-a");
      expect(projectA!.sessions.length).toBe(2);
      // s1 (Feb 12) should come before s2 (Feb 11) since they're sorted desc
      expect(projectA!.sessions[0]!.id).toBe("s1");
      expect(projectA!.sessions[1]!.id).toBe("s2");
    });
  });

  describe("getSessionsForProject", () => {
    it("returns sessions for a specific project", () => {
      const sessions = getSessionsForProject("/Users/test/project-a");
      expect(sessions.length).toBe(2);
      expect(sessions.every((s) => s.projectDir === "/Users/test/project-a")).toBe(true);
    });

    it("returns empty array for unknown project", () => {
      const sessions = getSessionsForProject("/nonexistent");
      expect(sessions).toEqual([]);
    });
  });

  describe("getAllSessions", () => {
    it("returns all sessions sorted by timestamp", () => {
      const sessions = getAllSessions();
      expect(sessions.length).toBe(4);
      // Most recent first
      expect(sessions[0]!.id).toBe("s3"); // Feb 13
      expect(sessions[3]!.id).toBe("s4"); // Feb 10
    });
  });

  describe("worktree normalization", () => {
    it("merges worktree sessions with real project sessions", () => {
      const withWorktree: SessionSummary[] = [
        {
          id: "s1",
          provider: "claude",
          title: "Real path session",
          projectDir: "/Users/test/my-project",
          timestamp: "2026-02-12T10:00:00.000Z",
          filePath: "/path/to/s1.jsonl",
        },
        {
          id: "s5",
          provider: "codex",
          title: "Worktree session 1",
          projectDir: "/Users/test/.codex/worktrees/abcd/my-project",
          timestamp: "2026-02-14T10:00:00.000Z",
          filePath: "/path/to/s5.jsonl",
        },
        {
          id: "s6",
          provider: "codex",
          title: "Worktree session 2",
          projectDir: "/Users/test/.codex/worktrees/ef01/my-project",
          timestamp: "2026-02-13T10:00:00.000Z",
          filePath: "/path/to/s6.jsonl",
        },
      ];

      const sorted = [...withWorktree].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      vi.mocked(listAllSessions).mockReturnValue(sorted);

      const groups = getUnifiedIndex();
      // All 3 sessions should merge into 1 group
      expect(groups.length).toBe(1);
      expect(groups[0]!.projectDir).toBe("/Users/test/my-project");
      expect(groups[0]!.sessions.length).toBe(3);
    });

    it("getSessionsForProject finds worktree sessions via normalized query", () => {
      const withWorktree: SessionSummary[] = [
        {
          id: "s1",
          provider: "codex",
          title: "Worktree session",
          projectDir: "/Users/test/.codex/worktrees/abcd/my-project",
          timestamp: "2026-02-14T10:00:00.000Z",
          filePath: "/path/to/s1.jsonl",
        },
      ];

      vi.mocked(listAllSessions).mockReturnValue(withWorktree);

      // Query by real path should find the worktree session
      const sessions = getSessionsForProject("/Users/test/my-project");
      expect(sessions.length).toBe(1);
      expect(sessions[0]!.id).toBe("s1");
    });
  });
});
