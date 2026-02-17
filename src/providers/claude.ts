import { listClaudeSessions } from "../discovery/claudeDiscovery.js";
import { readClaudeSession } from "../readers/claudeReader.js";
import { decodeProjectPath } from "../utils/paths.js";
import type { Provider, SessionSummary } from "./types.js";
import type { IRSession } from "../schemas/common.js";

export const claudeProvider: Provider = {
  name: "claude",

  listSessions(): SessionSummary[] {
    return listClaudeSessions().map((s) => ({
      id: s.sessionId,
      provider: "claude" as const,
      title: s.display,
      projectDir: decodeProjectPath(s.project),
      timestamp: s.timestamp,
      filePath: s.filePath ?? "",
    })).filter((s) => s.filePath !== "");
  },

  readSession(filePath: string): IRSession {
    return readClaudeSession(filePath);
  },
};
