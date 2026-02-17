import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import {
  opencodeStorageDir,
  opencodeDbPath,
  opencodeStorageDbPath,
} from "../utils/paths.js";
import { unixMsToIso } from "../utils/timestamp.js";
import type { Provider, SessionSummary } from "./types.js";
import type { IRSession, IRMessage, IRContentBlock } from "../schemas/common.js";

const require = createRequire(import.meta.url);

// --- Raw JSON shapes from OpenCode's flat-file storage ---

interface OcProject {
  id: string;
  worktree: string;
  time: { created: number; updated: number };
}

interface OcSession {
  id: string;
  slug?: string;
  version?: string;
  projectID: string;
  directory?: string;
  parentID?: string;
  title?: string;
  time: { created: number; updated: number };
}

interface OcMessage {
  id: string;
  sessionID: string;
  role: "user" | "assistant";
  time: { created: number; completed?: number };
  modelID?: string;
  providerID?: string;
  parentID?: string;
}

interface OcPartText {
  type: "text";
  id: string;
  sessionID: string;
  messageID: string;
  text: string;
}

interface OcPartReasoning {
  type: "reasoning";
  id: string;
  sessionID: string;
  messageID: string;
  text: string;
}

interface OcPartTool {
  type: "tool";
  id: string;
  sessionID: string;
  messageID: string;
  callID: string;
  tool: string;
  state: {
    status: string;
    input: Record<string, unknown>;
    output?: string;
    title?: string;
    metadata?: Record<string, unknown>;
  };
}

interface OcPartStepStart {
  type: "step-start";
  id: string;
}

interface OcPartStepFinish {
  type: "step-finish";
  id: string;
  reason?: string;
}

type OcPart = OcPartText | OcPartReasoning | OcPartTool | OcPartStepStart | OcPartStepFinish;

type PreferredSource = "auto" | "json" | "sqlite";
type OpenCodeSource = "json" | "sqlite" | "empty";

type SqliteModule = {
  DatabaseSync: new (path: string, options?: { readonly?: boolean }) => {
    prepare(sql: string): {
      all(...params: unknown[]): Record<string, unknown>[];
      get(...params: unknown[]): Record<string, unknown> | undefined;
    };
    close(): void;
  };
};

interface OpenCodeReadOptions {
  sqliteDbPath?: string;
  preferSource?: PreferredSource;
  loadSqliteModule?: () => SqliteModule | undefined;
}

interface OpenCodeStorageContext {
  source: OpenCodeSource;
  storageDir: string;
  sqliteDbPath?: string;
}

interface SqlSessionRecord {
  id: string;
  title?: string;
  slug?: string;
  directory?: string;
  projectID?: string;
  updatedMs: number;
}

interface SqlMessageRecord {
  id: string;
  role: "user" | "assistant";
  createdMs: number;
  modelID?: string;
  providerID?: string;
}

// --- Helpers ---

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return undefined;
  }
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

function buildProjectMap(storageDir: string): Map<string, OcProject> {
  const map = new Map<string, OcProject>();
  const projDir = join(storageDir, "project");
  for (const file of listJsonFiles(projDir)) {
    const proj = readJson<OcProject>(file);
    if (proj?.id) map.set(proj.id, proj);
  }
  return map;
}

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function hasJsonStorage(storageDir: string): boolean {
  return ["session", "message", "part"].every((segment) =>
    existsSync(join(storageDir, segment))
  );
}

function parseMs(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return parseMs(obj.updated) ?? parseMs(obj.created) ?? parseMs(obj.time);
  }
  return undefined;
}

function getField(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in row) return row[key];
  }
  return undefined;
}

function getStringField(row: Record<string, unknown>, keys: string[]): string | undefined {
  const value = getField(row, keys);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getUpdatedMs(row: Record<string, unknown>): number {
  return (
    parseMs(getField(row, ["updatedMs", "updated_ms"])) ??
    parseMs(getField(row, ["updatedAt", "updated_at"])) ??
    parseMs(getField(row, ["time"])) ??
    Date.now()
  );
}

function getCreatedMs(row: Record<string, unknown>): number {
  return (
    parseMs(getField(row, ["createdMs", "created_ms"])) ??
    parseMs(getField(row, ["createdAt", "created_at"])) ??
    parseMs(getField(row, ["time"])) ??
    Date.now()
  );
}

function defaultSqliteLoader(): SqliteModule | undefined {
  try {
    return require("node:sqlite") as SqliteModule;
  } catch {
    return undefined;
  }
}

function parseJsonString(value: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // noop
  }
  return undefined;
}

function buildSqliteCandidates(storageDir: string, sqliteDbPath?: string): string[] {
  const candidates: string[] = [];
  if (sqliteDbPath) candidates.push(sqliteDbPath);

  const dataDir = dirname(storageDir);
  const localDb = join(dataDir, "db.sqlite");
  const localStorageDb = join(dataDir, "storage.sqlite");
  candidates.push(localDb, localStorageDb);

  if (storageDir === opencodeStorageDir()) {
    candidates.push(opencodeDbPath(), opencodeStorageDbPath());
  }

  return [...new Set(candidates)];
}

function resolveStorageContext(
  storageDir: string,
  opts?: OpenCodeReadOptions,
): OpenCodeStorageContext {
  const preferSource = opts?.preferSource ?? "auto";
  const jsonAvailable = hasJsonStorage(storageDir);

  const sqliteCandidates = buildSqliteCandidates(storageDir, opts?.sqliteDbPath);
  const sqliteAvailablePath = sqliteCandidates.find((path) => existsSync(path));

  if (preferSource === "json") {
    return {
      source: jsonAvailable ? "json" : sqliteAvailablePath ? "sqlite" : "empty",
      storageDir,
      sqliteDbPath: sqliteAvailablePath,
    };
  }

  if (preferSource === "sqlite") {
    return {
      source: sqliteAvailablePath ? "sqlite" : jsonAvailable ? "json" : "empty",
      storageDir,
      sqliteDbPath: sqliteAvailablePath,
    };
  }

  if (jsonAvailable) {
    return { source: "json", storageDir, sqliteDbPath: sqliteAvailablePath };
  }

  if (sqliteAvailablePath) {
    return { source: "sqlite", storageDir, sqliteDbPath: sqliteAvailablePath };
  }

  return { source: "empty", storageDir };
}

function toSqliteSessionRef(dbPath: string, sessionId: string): string {
  return `sqlite:${dbPath}#${sessionId}`;
}

function parseSqliteSessionRef(ref: string): { dbPath: string; sessionId: string } | undefined {
  if (!ref.startsWith("sqlite:")) return undefined;
  const body = ref.slice("sqlite:".length);
  const hash = body.lastIndexOf("#");
  if (hash < 1 || hash === body.length - 1) return undefined;
  return {
    dbPath: body.slice(0, hash),
    sessionId: body.slice(hash + 1),
  };
}

function listSessionsFromJson(storageDir: string): SessionSummary[] {
  if (!existsSync(storageDir)) return [];

  const projectMap = buildProjectMap(storageDir);
  const sessionDir = join(storageDir, "session");
  if (!existsSync(sessionDir)) return [];

  const results: SessionSummary[] = [];

  for (const projHash of safeReaddir(sessionDir)) {
    const projSessionDir = join(sessionDir, projHash);
    const project = projectMap.get(projHash);
    const projectDir = project?.worktree;

    for (const file of listJsonFiles(projSessionDir)) {
      const session = readJson<OcSession>(file);
      if (!session?.id) continue;

      results.push({
        id: session.id,
        provider: "opencode",
        title: session.title || session.slug,
        projectDir: session.directory || projectDir,
        timestamp: unixMsToIso(session.time.updated),
        filePath: file,
      });
    }
  }

  results.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return results;
}

function listSessionsFromSqlite(dbPath: string, loader: () => SqliteModule | undefined): SessionSummary[] {
  const mod = loader();
  if (!mod) return [];

  try {
    const db = new mod.DatabaseSync(dbPath, { readonly: true });
    try {
      const rows = db.prepare(
        "SELECT s.*, p.worktree AS projectWorktree FROM session s LEFT JOIN project p ON p.id = s.projectID",
      ).all();

      const sessions: SessionSummary[] = [];
      for (const row of rows) {
        const id = getStringField(row, ["id"]);
        if (!id) continue;
        const updatedMs = getUpdatedMs(row);
        const title = getStringField(row, ["title", "slug"]);
        const projectDir = getStringField(row, ["directory", "projectWorktree", "worktree"]);

        sessions.push({
          id,
          provider: "opencode",
          title,
          projectDir,
          timestamp: unixMsToIso(updatedMs),
          filePath: toSqliteSessionRef(dbPath, id),
        });
      }

      sessions.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      return sessions;
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

function parseSessionFromSqliteRow(row: Record<string, unknown>): SqlSessionRecord | undefined {
  const id = getStringField(row, ["id"]);
  if (!id) return undefined;

  return {
    id,
    title: getStringField(row, ["title"]),
    slug: getStringField(row, ["slug"]),
    directory: getStringField(row, ["directory"]),
    projectID: getStringField(row, ["projectID", "projectId"]),
    updatedMs: getUpdatedMs(row),
  };
}

function readSessionFromJson(
  sessionFilePath: string,
  storageDir: string,
): IRSession {
  const session = readJson<OcSession>(sessionFilePath);
  if (!session) {
    return {
      id: "unknown",
      sourceFormat: "opencode",
      messages: [],
      metadata: {
        opencodeSource: "json",
      },
    };
  }

  const messageDir = join(storageDir, "message", session.id);
  const partBaseDir = join(storageDir, "part");

  // Read all messages for this session
  const rawMessages: OcMessage[] = [];
  for (const file of listJsonFiles(messageDir)) {
    const msg = readJson<OcMessage>(file);
    if (msg?.id) rawMessages.push(msg);
  }

  // Sort messages by creation time
  rawMessages.sort((a, b) => a.time.created - b.time.created);

  // Convert each message + its parts to IR
  let model: string | undefined;
  const messages: IRMessage[] = [];

  for (const msg of rawMessages) {
    if (msg.modelID && !model) {
      model = msg.providerID ? `${msg.providerID}/${msg.modelID}` : msg.modelID;
    }

    const partDir = join(partBaseDir, msg.id);
    const rawParts: OcPart[] = [];
    for (const file of listJsonFiles(partDir)) {
      const part = readJson<OcPart>(file);
      if (part) rawParts.push(part);
    }

    // Sort parts by ID (they use descending ULID-like encoding, so lexical sort works)
    rawParts.sort((a, b) => a.id.localeCompare(b.id));

    const blocks: IRContentBlock[] = [];

    for (const part of rawParts) {
      switch (part.type) {
        case "text":
          if (part.text.trim()) {
            blocks.push({ type: "text", text: part.text });
          }
          break;
        case "reasoning":
          if (part.text.trim()) {
            blocks.push({ type: "thinking", text: part.text });
          }
          break;
        case "tool": {
          blocks.push({
            type: "tool_call",
            id: part.callID,
            name: part.tool,
            arguments: JSON.stringify(part.state.input ?? {}),
          });
          if (part.state.status === "completed" && part.state.output != null) {
            blocks.push({
              type: "tool_result",
              toolCallId: part.callID,
              output: part.state.output,
            });
          } else if (part.state.status === "error") {
            blocks.push({
              type: "tool_result",
              toolCallId: part.callID,
              output: part.state.output ?? "error",
              isError: true,
            });
          }
          break;
        }
        case "step-start":
        case "step-finish":
          break;
      }
    }

    if (blocks.length > 0) {
      messages.push({
        role: msg.role,
        content: blocks,
        timestamp: unixMsToIso(msg.time.created),
      });
    }
  }

  return {
    id: session.id,
    name: session.title || session.slug,
    cwd: session.directory,
    sourceFormat: "opencode",
    sourceModel: model,
    messages,
    metadata: {
      opencodeSource: "json",
    },
  };
}

function readSessionFromSqlite(
  dbPath: string,
  sessionId: string,
  loader: () => SqliteModule | undefined,
): IRSession {
  const mod = loader();
  if (!mod) {
    return {
      id: sessionId,
      sourceFormat: "opencode",
      messages: [],
      metadata: {
        opencodeSource: "sqlite",
      },
    };
  }

  try {
    const db = new mod.DatabaseSync(dbPath, { readonly: true });
    try {
      const sessionRow = db.prepare("SELECT * FROM session WHERE id = ?").get(sessionId);
      const session = sessionRow ? parseSessionFromSqliteRow(sessionRow) : undefined;
      if (!session) {
        return {
          id: sessionId,
          sourceFormat: "opencode",
          messages: [],
          metadata: {
            opencodeSource: "sqlite",
          },
        };
      }

      const rawMessages = db.prepare("SELECT * FROM message WHERE sessionID = ?").all(session.id);
      const messagesData: SqlMessageRecord[] = [];
      for (const row of rawMessages) {
        const id = getStringField(row, ["id"]);
        const roleValue = getStringField(row, ["role"]);
        if (!id || (roleValue !== "user" && roleValue !== "assistant")) {
          continue;
        }

        messagesData.push({
          id,
          role: roleValue,
          createdMs: getCreatedMs(row),
          modelID: getStringField(row, ["modelID", "modelId"]),
          providerID: getStringField(row, ["providerID", "providerId"]),
        });
      }
      messagesData.sort((a, b) => a.createdMs - b.createdMs);

      let model: string | undefined;
      const messages: IRMessage[] = [];

      for (const msg of messagesData) {
        if (!model && msg.modelID) {
          model = msg.providerID ? `${msg.providerID}/${msg.modelID}` : msg.modelID;
        }

        const rawParts = db.prepare("SELECT * FROM part WHERE messageID = ?").all(msg.id);
        rawParts.sort((a, b) => {
          const idA = getStringField(a, ["id"]) ?? "";
          const idB = getStringField(b, ["id"]) ?? "";
          return idA.localeCompare(idB);
        });

        const blocks: IRContentBlock[] = [];
        for (const part of rawParts) {
          const partType = getStringField(part, ["type"]);
          if (!partType) continue;

          if (partType === "text") {
            const text = getStringField(part, ["text"]);
            if (text && text.trim()) {
              blocks.push({ type: "text", text });
            }
            continue;
          }

          if (partType === "reasoning") {
            const text = getStringField(part, ["text"]);
            if (text && text.trim()) {
              blocks.push({ type: "thinking", text });
            }
            continue;
          }

          if (partType === "tool") {
            const callId = getStringField(part, ["callID", "callId"]);
            const tool = getStringField(part, ["tool"]);
            const stateValue = getField(part, ["state"]);
            const state =
              stateValue && typeof stateValue === "string"
                ? (parseJsonString(stateValue) ?? {})
                : (stateValue as Record<string, unknown> | undefined) ?? {};
            if (!callId || !tool) continue;

            const input = state.input as Record<string, unknown> | undefined;
            blocks.push({
              type: "tool_call",
              id: callId,
              name: tool,
              arguments: JSON.stringify(input ?? {}),
            });

            const status = typeof state.status === "string" ? state.status : "";
            const output = typeof state.output === "string" ? state.output : undefined;

            if (status === "completed" && output != null) {
              blocks.push({
                type: "tool_result",
                toolCallId: callId,
                output,
              });
            } else if (status === "error") {
              blocks.push({
                type: "tool_result",
                toolCallId: callId,
                output: output ?? "error",
                isError: true,
              });
            }
            continue;
          }
        }

        if (blocks.length > 0) {
          messages.push({
            role: msg.role,
            content: blocks,
            timestamp: unixMsToIso(msg.createdMs),
          });
        }
      }

      return {
        id: session.id,
        name: session.title || session.slug,
        cwd: session.directory,
        sourceFormat: "opencode",
        sourceModel: model,
        messages,
        metadata: {
          opencodeSource: "sqlite",
        },
      };
    } finally {
      db.close();
    }
  } catch {
    return {
      id: sessionId,
      sourceFormat: "opencode",
      messages: [],
      metadata: {
        opencodeSource: "sqlite",
      },
    };
  }
}

// --- Provider ---

export const opencodeProvider: Provider = {
  name: "opencode",

  listSessions(): SessionSummary[] {
    const storageDir = opencodeStorageDir();
    const context = resolveStorageContext(storageDir);

    if (context.source === "json") {
      return listSessionsFromJson(context.storageDir);
    }

    if (context.source === "sqlite" && context.sqliteDbPath) {
      return listSessionsFromSqlite(context.sqliteDbPath, defaultSqliteLoader);
    }

    return [];
  },

  readSession(filePath: string): IRSession {
    return readOpenCodeSession(filePath);
  },
};

/**
 * List OpenCode sessions from a specific storage directory (for testing).
 */
export function listOpenCodeSessionsFromDir(
  storageDir: string,
  opts?: OpenCodeReadOptions,
): SessionSummary[] {
  const context = resolveStorageContext(storageDir, opts);
  if (context.source === "json") {
    return listSessionsFromJson(context.storageDir);
  }
  if (context.source === "sqlite" && context.sqliteDbPath) {
    return listSessionsFromSqlite(
      context.sqliteDbPath,
      opts?.loadSqliteModule ?? defaultSqliteLoader,
    );
  }
  return [];
}

/**
 * Read an OpenCode session from either JSON storage or SQLite.
 *
 * @param storageDirOverride - override storage dir (for JSON tests)
 */
export function readOpenCodeSession(
  sessionFilePath: string,
  storageDirOverride?: string,
  opts?: OpenCodeReadOptions,
): IRSession {
  const sqliteRef = parseSqliteSessionRef(sessionFilePath);
  if (sqliteRef) {
    return readSessionFromSqlite(
      sqliteRef.dbPath,
      sqliteRef.sessionId,
      opts?.loadSqliteModule ?? defaultSqliteLoader,
    );
  }

  const storageDir = storageDirOverride ?? opencodeStorageDir();
  const context = resolveStorageContext(storageDir, opts);

  if (context.source === "json") {
    return readSessionFromJson(sessionFilePath, context.storageDir);
  }

  if (context.source === "sqlite" && context.sqliteDbPath) {
    // In sqlite mode, callers can pass either sqlite:<db>#<id> or a raw session ID.
    const sessionId = sessionFilePath.includes("/")
      ? sessionFilePath.split("/").at(-1)?.replace(/\.json$/, "") || "unknown"
      : sessionFilePath;

    return readSessionFromSqlite(
      context.sqliteDbPath,
      sessionId,
      opts?.loadSqliteModule ?? defaultSqliteLoader,
    );
  }

  return {
    id: "unknown",
    sourceFormat: "opencode",
    messages: [],
  };
}
