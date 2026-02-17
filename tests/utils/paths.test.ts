import { describe, it, expect, vi } from "vitest";
import { generateAnthropicId, generateSlug, normalizeProjectDir } from "../../src/utils/paths.js";
import { homedir } from "node:os";
import { join } from "node:path";

describe("generateAnthropicId", () => {
  it("generates msg IDs with correct prefix and length", () => {
    const id = generateAnthropicId("msg");
    expect(id).toMatch(/^msg_01[A-Za-z0-9]{24}$/);
    expect(id.length).toBe(30); // "msg_01" (6) + 24 chars
  });

  it("generates req IDs with correct prefix and length", () => {
    const id = generateAnthropicId("req");
    expect(id).toMatch(/^req_01[A-Za-z0-9]{24}$/);
    expect(id.length).toBe(30); // "req_01" (6) + 24 chars
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateAnthropicId("msg")));
    expect(ids.size).toBe(100);
  });
});

describe("generateSlug", () => {
  it("converts text to kebab-case", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(generateSlug("Hello, World! How's it?")).toBe("hello-world-hows-it");
  });

  it("truncates to 50 characters", () => {
    const long = "a".repeat(100);
    expect(generateSlug(long).length).toBe(50);
  });

  it("collapses multiple dashes", () => {
    expect(generateSlug("hello   ---  world")).toBe("hello-world");
  });

  it("strips leading and trailing dashes", () => {
    expect(generateSlug("---hello---")).toBe("hello");
  });

  it("handles empty string", () => {
    expect(generateSlug("")).toBe("");
  });
});

describe("normalizeProjectDir", () => {
  const home = homedir();
  const codexWorktrees = join(home, ".codex", "worktrees");

  it("returns non-worktree paths unchanged", () => {
    const dir = join(home, "Documents", "Codex", "my-project");
    expect(normalizeProjectDir(dir)).toBe(dir);
  });

  it("returns regular absolute paths unchanged", () => {
    expect(normalizeProjectDir("/tmp/some/project")).toBe("/tmp/some/project");
  });

  it("resolves worktree path to real project if it exists on disk", () => {
    // thread-bridge itself exists at ~/Documents/Codex/thread-bridge
    const worktreePath = join(codexWorktrees, "abcd", "thread-bridge");
    const result = normalizeProjectDir(worktreePath);
    expect(result).toBe(join(home, "Documents", "Codex", "thread-bridge"));
  });

  it("returns just the project name when no real path exists on disk", () => {
    const worktreePath = join(codexWorktrees, "ff99", "nonexistent-project-xyz");
    const result = normalizeProjectDir(worktreePath);
    expect(result).toBe("nonexistent-project-xyz");
  });

  it("handles worktree paths with only a hash (no project name)", () => {
    const worktreePath = join(codexWorktrees, "abcd");
    // Not enough parts after worktrees/ to extract a name
    expect(normalizeProjectDir(worktreePath)).toBe(worktreePath);
  });
});
