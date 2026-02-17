import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { readJsonlLines } from "../utils/jsonl.js";
import {
  claudeHistoryPath,
  claudeProjectsDir,
  decodeProjectPath,
} from "../utils/paths.js";
import { unixMsToIso } from "../utils/timestamp.js";

export interface ClaudeSessionInfo {
  sessionId: string;
  display: string;
  project: string;
  timestamp: string;
  filePath?: string;
}

/**
 * List Claude Code sessions from history, grouped by sessionId.
 */
export function listClaudeSessions(
  projectFilter?: string,
): ClaudeSessionInfo[] {
  const histPath = claudeHistoryPath();
  if (!existsSync(histPath)) return [];

  const lines = readJsonlLines(histPath) as Array<{
    display: string;
    timestamp: number;
    project: string;
    sessionId: string;
  }>;

  // Group by sessionId, keep first display and latest timestamp
  const byId = new Map<
    string,
    { display: string; project: string; timestamp: number }
  >();
  for (const entry of lines) {
    if (projectFilter && entry.project !== projectFilter) continue;

    const existing = byId.get(entry.sessionId);
    if (!existing) {
      byId.set(entry.sessionId, {
        display: entry.display,
        project: entry.project,
        timestamp: entry.timestamp,
      });
    } else {
      // Keep the first display (user message) but latest timestamp
      if (entry.timestamp > existing.timestamp) {
        existing.timestamp = entry.timestamp;
      }
    }
  }

  const sessions: ClaudeSessionInfo[] = [];
  for (const [sessionId, info] of byId) {
    const session: ClaudeSessionInfo = {
      sessionId,
      display: info.display,
      project: info.project,
      timestamp: unixMsToIso(info.timestamp),
    };

    // Try to find file
    session.filePath = findClaudeSessionFile(sessionId, info.project);
    sessions.push(session);
  }

  // Sort by timestamp descending
  sessions.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return sessions;
}

/**
 * Find a Claude session file by session ID (exact or prefix match).
 */
export function findClaudeSessionFile(
  sessionId: string,
  project?: string,
): string | undefined {
  const resolved = resolveClaudeSession(sessionId, project);
  return resolved?.filePath;
}

/**
 * Resolve a session ID (exact or prefix) to full ID + file path, or undefined.
 */
export function resolveClaudeSession(
  idPrefix: string,
  project?: string,
): { id: string; filePath: string } | undefined {
  const projDir = claudeProjectsDir();
  if (!existsSync(projDir)) return undefined;

  // Collect all session files: id -> path
  const allSessions = new Map<string, string>();

  try {
    for (const dir of readdirSync(projDir)) {
      const full = join(projDir, dir);
      if (!statSync(full).isDirectory()) continue;
      if (project) {
        const encoded = project.replace(/\//g, "-");
        if (dir !== encoded) continue;
      }
      for (const file of readdirSync(full)) {
        if (!file.endsWith(".jsonl")) continue;
        const id = file.replace(/\.jsonl$/, "");
        allSessions.set(id, join(full, file));
      }
    }
  } catch {
    // Directory might not exist
  }

  // Exact match
  if (allSessions.has(idPrefix)) {
    return { id: idPrefix, filePath: allSessions.get(idPrefix)! };
  }
  // Prefix match
  for (const [id, path] of allSessions) {
    if (id.startsWith(idPrefix)) {
      return { id, filePath: path };
    }
  }
  return undefined;
}
