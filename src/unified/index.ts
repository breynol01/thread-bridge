import { listAllSessions } from "../providers/registry.js";
import { normalizeProjectDir } from "../utils/paths.js";
import type { SessionSummary } from "../providers/types.js";

export interface ProjectGroup {
  projectDir: string;
  sessions: SessionSummary[];
}

/**
 * Get all sessions grouped by project directory, sorted by most recent activity.
 * Sessions without a project directory are grouped under "(no project)".
 *
 * Codex worktree paths (~/.codex/worktrees/{hash}/{name}) are normalized
 * to real project directories before grouping.
 */
export function getUnifiedIndex(): ProjectGroup[] {
  const sessions = listAllSessions();
  const groups = new Map<string, SessionSummary[]>();

  for (const session of sessions) {
    const raw = session.projectDir || "(no project)";
    const key = raw === "(no project)" ? raw : normalizeProjectDir(raw);
    const list = groups.get(key);
    if (list) {
      list.push(session);
    } else {
      groups.set(key, [session]);
    }
  }

  const result: ProjectGroup[] = [];
  for (const [projectDir, sessions] of groups) {
    result.push({ projectDir, sessions });
  }

  // Sort groups by most recent session timestamp
  result.sort((a, b) => {
    const ta = new Date(a.sessions[0]!.timestamp).getTime();
    const tb = new Date(b.sessions[0]!.timestamp).getTime();
    return tb - ta;
  });

  return result;
}

/**
 * Get all sessions for a specific project directory.
 * Normalizes both the query and session dirs for matching.
 */
export function getSessionsForProject(dir: string): SessionSummary[] {
  const normalizedQuery = normalizeProjectDir(dir);
  return listAllSessions().filter((s) => {
    const normalizedSession = s.projectDir ? normalizeProjectDir(s.projectDir) : "(no project)";
    return normalizedSession === normalizedQuery;
  });
}

/**
 * Get all sessions across all providers, sorted by timestamp descending.
 */
export function getAllSessions(): SessionSummary[] {
  return listAllSessions();
}
