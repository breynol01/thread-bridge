import { listCodexSessions } from "../discovery/codexDiscovery.js";
import { readCodexSession } from "../readers/codexReader.js";
export const codexProvider = {
    name: "codex",
    listSessions() {
        return listCodexSessions().map((s) => ({
            id: s.id,
            provider: "codex",
            title: s.name,
            projectDir: s.cwd,
            timestamp: s.updatedAt,
            filePath: s.filePath ?? "",
        })).filter((s) => s.filePath !== "");
    },
    readSession(filePath) {
        return readCodexSession(filePath);
    },
};
