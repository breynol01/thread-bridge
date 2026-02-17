import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

export function codexHome(): string {
  return join(homedir(), ".codex");
}

export function opencodeDataDir(): string {
  return process.env.XDG_DATA_HOME
    ? join(process.env.XDG_DATA_HOME, "opencode")
    : join(homedir(), ".local", "share", "opencode");
}

export function opencodeStorageDir(): string {
  return join(opencodeDataDir(), "storage");
}

export function opencodeDbPath(): string {
  return join(opencodeDataDir(), "db.sqlite");
}

export function opencodeStorageDbPath(): string {
  return join(opencodeDataDir(), "storage.sqlite");
}

export function claudeHome(): string {
  return join(homedir(), ".claude");
}

export function codexSessionsDir(): string {
  return join(codexHome(), "sessions");
}

export function codexArchivedSessionsDir(): string {
  return join(codexHome(), "archived_sessions");
}

export function codexGlobalStatePath(): string {
  return join(codexHome(), ".codex-global-state.json");
}

export function codexSessionIndexPath(): string {
  return join(codexHome(), "session_index.jsonl");
}

export function codexHistoryPath(): string {
  return join(codexHome(), "history.jsonl");
}

export function claudeHistoryPath(): string {
  return join(claudeHome(), "history.jsonl");
}

export function claudeProjectsDir(): string {
  return join(claudeHome(), "projects");
}

/**
 * Encode a filesystem path the way Claude Code does for project directories.
 * `/Users/foo/bar` -> `-Users-foo-bar`
 */
export function encodeProjectPath(absPath: string): string {
  return absPath.replace(/\//g, "-");
}

/**
 * Decode a Claude Code project directory name back to a path.
 * `-Users-foo-bar` -> `/Users/foo/bar`
 */
export function decodeProjectPath(encoded: string): string {
  // The first char is `-` which represents the leading `/`
  return encoded.replace(/-/g, "/");
}

/**
 * Build the session file path for a new Codex session.
 */
export function codexSessionFilePath(sessionId: string, date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const ts = date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return join(
    codexSessionsDir(),
    String(yyyy),
    mm,
    dd,
    `rollout-${ts}-${sessionId}.jsonl`,
  );
}

/**
 * Build the session file path for a Claude Code session.
 */
export function claudeSessionFilePath(
  projectPath: string,
  sessionId: string,
): string {
  const encoded = encodeProjectPath(projectPath);
  return join(claudeProjectsDir(), encoded, `${sessionId}.jsonl`);
}

/**
 * Path to Claude Code session-env directory for a given session.
 */
export function claudeSessionEnvDir(sessionId: string): string {
  return join(claudeHome(), "session-env", sessionId);
}

const ANTHROPIC_ID_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate an ID matching Anthropic's format.
 * msg_01 + 24 alphanumeric chars, or req_01 + 24 alphanumeric chars.
 */
export function generateAnthropicId(prefix: "msg" | "req"): string {
  const bytes = randomBytes(24);
  let suffix = "";
  for (let i = 0; i < 24; i++) {
    suffix += ANTHROPIC_ID_CHARS[bytes[i]! % ANTHROPIC_ID_CHARS.length];
  }
  return `${prefix}_01${suffix}`;
}

/**
 * Detect installed Claude Code version from statsig_metadata.json
 * or fall back to a recent known version.
 */
export function detectClaudeVersion(): string {
  const DEFAULT_VERSION = "2.1.37";
  try {
    const metaPath = join(claudeHome(), "statsig_metadata.json");
    if (existsSync(metaPath)) {
      const data = JSON.parse(readFileSync(metaPath, "utf-8"));
      if (typeof data.version === "string" && data.version.length > 0) {
        return data.version;
      }
    }
  } catch {
    // fall through
  }
  try {
    const out = execSync("claude --version 2>/dev/null", {
      encoding: "utf-8",
      timeout: 3000,
    }).trim();
    // Output like "claude 2.1.37" or just "2.1.37"
    const match = out.match(/(\d+\.\d+\.\d+)/);
    if (match) return match[1]!;
  } catch {
    // fall through
  }
  return DEFAULT_VERSION;
}

/**
 * Detect the current git branch for a given directory.
 */
export function detectGitBranch(cwd: string): string | undefined {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Normalize Codex worktree paths to real project directories.
 * ~/.codex/worktrees/{hash}/{name} -> resolve to real path or use {name}
 *
 * The Codex desktop app creates isolated worktrees for each session under
 * ~/.codex/worktrees/{hash}/{project-name}. This function resolves those
 * back to the real project directory so sessions group correctly.
 */
export function normalizeProjectDir(dir: string): string {
  const home = codexHome();
  const worktreePrefix = join(home, "worktrees") + "/";

  if (!dir.startsWith(worktreePrefix)) return dir;

  // Extract {hash}/{name} from the path after worktrees/
  const rest = dir.slice(worktreePrefix.length);
  const parts = rest.split("/");
  if (parts.length < 2) return dir;

  // parts[0] = hash, parts[1..] = project name (could have nested path)
  const projectName = parts.slice(1).join("/");

  // Check common project parent directories for a real match
  const home_ = homedir();
  const candidates = [
    join(home_, "Documents", "Codex", projectName),
    join(home_, "Documents", "Obsidian", projectName),
    join(home_, "Documents", projectName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // No real path found on disk — return just the project name
  return projectName;
}

/**
 * Generate a slug from a session name or text.
 * Kebab-case, truncated to 50 chars.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
