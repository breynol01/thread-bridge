import { listCodexSessions } from "../discovery/codexDiscovery.js";
import { readCodexSession } from "../readers/codexReader.js";
import type { Provider, SessionSummary } from "./types.js";
import type { IRSession } from "../schemas/common.js";

export const codexProvider: Provider = {
  name: "codex",

  listSessions(): SessionSummary[] {
    return listCodexSessions().map((s) => ({
      id: s.id,
      provider: "codex" as const,
      title: s.name,
      projectDir: s.cwd,
      timestamp: s.updatedAt,
      filePath: s.filePath ?? "",
    })).filter((s) => s.filePath !== "");
  },

  readSession(filePath: string): IRSession {
    return readCodexSession(filePath);
  },
};
