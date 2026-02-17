import { describe, it, expect } from "vitest";
import { filterProjectGroups, filterSessions } from "../../src/tui/utils/search.js";

const sampleSessions = [
  {
    id: "1",
    provider: "codex",
    model: "gpt-5",
    timestamp: new Date().toISOString(),
    filePath: "/tmp/1",
    title: "Alpha thread",
    projectDir: "/app/alpha",
  },
  {
    id: "2",
    provider: "claude",
    model: "claude-sonnet-4-5",
    timestamp: new Date().toISOString(),
    filePath: "/tmp/2",
    title: "Beta discussion",
    projectDir: "/app/beta",
  },
  {
    id: "3",
    provider: "opencode",
    model: "openai/gpt-4",
    timestamp: new Date().toISOString(),
    filePath: "/tmp/3",
    title: "Gamma log",
    projectDir: "/app/alpha",
  },
] as const;

const sampleGroups = [
  { projectDir: "/app/alpha", sessions: [sampleSessions[0], sampleSessions[2]] },
  { projectDir: "/app/beta", sessions: [sampleSessions[1]] },
];

describe("search utilities", () => {
  it("filters project groups by session title", () => {
    const filtered = filterProjectGroups(sampleGroups, "alpha");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessions).toHaveLength(2);
  });

  it("filters project groups by provider", () => {
    const filtered = filterProjectGroups(sampleGroups, "claude");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessions[0].provider).toBe("claude");
  });

  it("returns all sessions when query is empty", () => {
    const filtered = filterSessions(sampleGroups[0].sessions, "");
    expect(filtered).toEqual(sampleGroups[0].sessions);
  });

  it("filters sessions by project path", () => {
    const filtered = filterSessions(sampleGroups[0].sessions, "/app/alpha");
    expect(filtered).toHaveLength(2);
  });

  it("filters by provider token", () => {
    const filtered = filterProjectGroups(sampleGroups, "provider:opencode");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessions).toHaveLength(1);
    expect(filtered[0].sessions[0].provider).toBe("opencode");
  });

  it("filters by model token", () => {
    const filtered = filterProjectGroups(sampleGroups, "model:sonnet");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessions[0].provider).toBe("claude");
  });
});
