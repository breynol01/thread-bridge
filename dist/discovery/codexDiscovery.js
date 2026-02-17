import { existsSync, readFileSync } from "node:fs";
import { readJsonlLines } from "../utils/jsonl.js";
import { codexSessionIndexPath, codexSessionsDir, codexArchivedSessionsDir, codexGlobalStatePath, codexHistoryPath, } from "../utils/paths.js";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { unixMsToIso } from "../utils/timestamp.js";
/**
 * List Codex sessions by scanning session files on disk, then enriching
 * with metadata from history.jsonl, session_index.jsonl, and .codex-global-state.json.
 *
 * This discovers sessions from both the CLI and the Codex Desktop app.
 */
export function listCodexSessions() {
    return listCodexSessionsFromDir(codexSessionsDir(), codexArchivedSessionsDir(), codexHistoryPath(), codexSessionIndexPath(), codexGlobalStatePath());
}
/**
 * List Codex sessions from specific directories (for testing).
 */
export function listCodexSessionsFromDir(sessionsDir, archivedDir, historyPath, indexPath, globalStatePath) {
    // 1. Scan sessions/ and archived_sessions/ for all JSONL files
    const activeMap = buildFileMap(sessionsDir);
    const archivedMap = buildFileMap(archivedDir);
    // Merge: active sessions take priority over archived
    const allFiles = new Map();
    for (const [id, path] of archivedMap)
        allFiles.set(id, path);
    for (const [id, path] of activeMap)
        allFiles.set(id, path);
    if (allFiles.size === 0)
        return [];
    // 2. Read history.jsonl for timestamps (uses unix seconds)
    const historyTimestamps = buildHistoryTimestampMap(historyPath);
    // 3. Read .codex-global-state.json for thread titles
    const globalTitles = readGlobalStateTitles(globalStatePath);
    // 4. Read session_index.jsonl for thread names (fallback)
    const indexNames = buildIndexNameMap(indexPath);
    // 5. Build session list, extracting cwd from session_meta
    const sessions = [];
    for (const [id, filePath] of allFiles) {
        // Title priority: global-state > session_index > undefined
        const name = globalTitles.get(id) || indexNames.get(id) || undefined;
        // Extract cwd and timestamp from session_meta (first line of JSONL)
        const meta = readSessionMeta(filePath);
        // Timestamp priority: session_meta > history.jsonl > file mtime
        let updatedAt;
        if (meta?.timestamp) {
            updatedAt = meta.timestamp;
        }
        else if (historyTimestamps.has(id)) {
            updatedAt = unixMsToIso(historyTimestamps.get(id) * 1000);
        }
        else {
            // Fall back to file modification time
            try {
                const stat = statSync(filePath);
                updatedAt = stat.mtime.toISOString();
            }
            catch {
                updatedAt = new Date(0).toISOString();
            }
        }
        sessions.push({
            id,
            name,
            updatedAt,
            filePath,
            cwd: meta?.cwd,
        });
    }
    // Sort by updatedAt descending
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return sessions;
}
/**
 * Find a session file by session ID (exact or prefix match).
 */
export function findCodexSessionFile(sessionId) {
    const map = buildFileMap(codexSessionsDir());
    // Also check archived
    const archived = buildFileMap(codexArchivedSessionsDir());
    for (const [id, path] of archived) {
        if (!map.has(id))
            map.set(id, path);
    }
    // Exact match first
    const exact = map.get(sessionId);
    if (exact)
        return exact;
    // Prefix match
    for (const [id, path] of map) {
        if (id.startsWith(sessionId))
            return path;
    }
    return undefined;
}
/**
 * Resolve a session ID prefix to the full ID + file path, or undefined.
 */
export function resolveCodexSession(idPrefix) {
    const map = buildFileMap(codexSessionsDir());
    const archived = buildFileMap(codexArchivedSessionsDir());
    for (const [id, path] of archived) {
        if (!map.has(id))
            map.set(id, path);
    }
    // Exact match
    if (map.has(idPrefix)) {
        return { id: idPrefix, filePath: map.get(idPrefix) };
    }
    // Prefix match
    for (const [id, path] of map) {
        if (id.startsWith(idPrefix)) {
            return { id, filePath: path };
        }
    }
    return undefined;
}
/**
 * Read just the session_meta from the first line of a Codex JSONL file.
 */
function readSessionMeta(filePath) {
    try {
        const content = readFileSync(filePath, "utf-8");
        const firstNewline = content.indexOf("\n");
        const firstLine = firstNewline === -1 ? content : content.slice(0, firstNewline);
        if (!firstLine.trim())
            return undefined;
        const parsed = JSON.parse(firstLine);
        if (parsed.type !== "session_meta")
            return undefined;
        const payload = parsed.payload;
        return {
            cwd: payload?.cwd,
            timestamp: parsed.timestamp || payload?.timestamp || undefined,
        };
    }
    catch {
        return undefined;
    }
}
/**
 * Walk a directory tree and build a map of session ID -> file path
 * from Codex JSONL filenames (rollout-YYYY-MM-DDTHH-MM-SS-UUID.jsonl).
 */
function buildFileMap(dir) {
    const map = new Map();
    if (!existsSync(dir))
        return map;
    try {
        walkDir(dir, (filePath) => {
            if (!filePath.endsWith(".jsonl"))
                return;
            const basename = filePath.split("/").pop() ?? "";
            const match = basename.match(/rollout-\d{4}-\d{2}-\d{2}T[\d-]+-(.+)\.jsonl$/);
            if (match) {
                map.set(match[1], filePath);
            }
        });
    }
    catch {
        // Directory might not exist or be inaccessible
    }
    return map;
}
function buildHistoryTimestampMap(historyPath) {
    const map = new Map();
    if (!existsSync(historyPath))
        return map;
    const lines = readJsonlLines(historyPath);
    for (const entry of lines) {
        if (entry.session_id && entry.ts) {
            // Keep the latest timestamp for each session
            const existing = map.get(entry.session_id);
            if (!existing || entry.ts > existing) {
                map.set(entry.session_id, entry.ts);
            }
        }
    }
    return map;
}
function readGlobalStateTitles(globalStatePath) {
    const map = new Map();
    if (!existsSync(globalStatePath))
        return map;
    try {
        const data = JSON.parse(readFileSync(globalStatePath, "utf-8"));
        const threadTitles = data["thread-titles"];
        if (threadTitles?.titles) {
            for (const [id, title] of Object.entries(threadTitles.titles)) {
                if (title)
                    map.set(id, title);
            }
        }
    }
    catch {
        // Ignore parse errors
    }
    return map;
}
function buildIndexNameMap(indexPath) {
    const map = new Map();
    if (!existsSync(indexPath))
        return map;
    const lines = readJsonlLines(indexPath);
    for (const entry of lines) {
        if (entry.id && entry.thread_name) {
            map.set(entry.id, entry.thread_name);
        }
    }
    return map;
}
function walkDir(dir, callback) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        try {
            const stat = statSync(full);
            if (stat.isDirectory()) {
                walkDir(full, callback);
            }
            else {
                callback(full);
            }
        }
        catch {
            // Skip inaccessible entries
        }
    }
}
