import { listClaudeSessions } from "../discovery/claudeDiscovery.js";
import { readClaudeSession } from "../readers/claudeReader.js";
import { decodeProjectPath } from "../utils/paths.js";
export const claudeProvider = {
    name: "claude",
    listSessions() {
        return listClaudeSessions().map((s) => ({
            id: s.sessionId,
            provider: "claude",
            title: s.display,
            projectDir: decodeProjectPath(s.project),
            timestamp: s.timestamp,
            filePath: s.filePath ?? "",
        })).filter((s) => s.filePath !== "");
    },
    readSession(filePath) {
        return readClaudeSession(filePath);
    },
};
