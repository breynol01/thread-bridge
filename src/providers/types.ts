import type { IRSession } from "../schemas/common.js";

export type ProviderName = "codex" | "claude" | "opencode";

export interface SessionSummary {
  id: string;
  provider: ProviderName;
  title?: string;
  projectDir?: string;
  timestamp: string; // ISO 8601
  model?: string;
  messageCount?: number;
  filePath: string;
}

export interface Provider {
  name: ProviderName;
  listSessions(): SessionSummary[];
  readSession(filePath: string): IRSession;
}
