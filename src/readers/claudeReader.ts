import { readJsonlLines } from "../utils/jsonl.js";
import {
  mapToolNameClaudeToCodex,
  remapArgsClaudeToCodex,
} from "../mappings/toolNameMap.js";
import type { IRSession, IRMessage, IRContentBlock } from "../schemas/common.js";

interface ParsedLine {
  type: string;
  uuid?: string;
  parentUuid?: string | null;
  timestamp?: string;
  sessionId?: string;
  cwd?: string;
  message?: Record<string, unknown>;
  data?: Record<string, unknown>;
  isSidechain?: boolean;
  [key: string]: unknown;
}

/**
 * Read a Claude Code JSONL session file and convert to IR.
 */
export function readClaudeSession(filePath: string): IRSession {
  const lines = readJsonlLines(filePath) as ParsedLine[];

  // Extract metadata from first user/assistant message
  let sessionId = "unknown";
  let cwd: string | undefined;
  let model: string | undefined;
  let gitBranch: string | undefined;
  let claudeVersion: string | undefined;
  let slug: string | undefined;

  // Collect assistant messages, dedup by message.id (streaming produces multiples)
  const assistantById = new Map<
    string,
    { line: ParsedLine; content: Array<Record<string, unknown>> }
  >();

  const userMessages: ParsedLine[] = [];
  const resultMessages: ParsedLine[] = [];

  for (const line of lines) {
    // Skip non-message types
    if (
      line.type === "file-history-snapshot" ||
      line.type === "progress"
    ) {
      continue;
    }

    if (line.sessionId) sessionId = line.sessionId;
    if (line.cwd) cwd = line.cwd;
    if (line.gitBranch && !gitBranch)
      gitBranch = line.gitBranch as string;
    if (line.version && !claudeVersion)
      claudeVersion = line.version as string;
    if (line.slug && !slug) slug = line.slug as string;

    if (line.type === "user") {
      userMessages.push(line);
    } else if (line.type === "assistant") {
      const msg = line.message;
      if (!msg) continue;

      const msgId = msg.id as string | undefined;
      if (!msgId) continue;

      // Extract model
      if (msg.model && !model) {
        model = msg.model as string;
      }

      const content = msg.content as Array<Record<string, unknown>> | undefined;
      if (!content) continue;

      // Dedup: keep most complete version (most content blocks)
      const existing = assistantById.get(msgId);
      if (!existing || content.length >= existing.content.length) {
        assistantById.set(msgId, { line, content });
      }
    } else if (line.type === "result") {
      resultMessages.push(line);
    }
  }

  // Build ordered messages by flattening the parentUuid chain
  const allLines: ParsedLine[] = [];
  // Collect all user lines and deduplicated assistant lines
  for (const line of userMessages) {
    allLines.push(line);
  }
  for (const { line } of assistantById.values()) {
    allLines.push(line);
  }
  for (const line of resultMessages) {
    allLines.push(line);
  }

  // Sort by timestamp
  allLines.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  // Convert to IR messages
  const messages: IRMessage[] = [];

  for (const line of allLines) {
    if (line.type === "user") {
      const msg = line.message;
      if (!msg) continue;

      const content = msg.content;
      const blocks: IRContentBlock[] = [];

      if (typeof content === "string") {
        blocks.push({ type: "text", text: content });
      } else if (Array.isArray(content)) {
        for (const block of content as Array<Record<string, unknown>>) {
          if (block.type === "text") {
            blocks.push({ type: "text", text: block.text as string });
          } else if (block.type === "tool_result") {
            const resultContent = block.content;
            let output: string;
            if (typeof resultContent === "string") {
              output = resultContent;
            } else if (Array.isArray(resultContent)) {
              output = (resultContent as Array<Record<string, unknown>>)
                .filter((c) => c.type === "text")
                .map((c) => c.text as string)
                .join("\n");
            } else {
              output = JSON.stringify(resultContent);
            }
            blocks.push({
              type: "tool_result",
              toolCallId: block.tool_use_id as string,
              output,
              isError: (block.is_error as boolean) || undefined,
            });
          }
        }
      }

      if (blocks.length > 0) {
        messages.push({
          role: "user",
          content: blocks,
          timestamp: line.timestamp,
        });
      }
    } else if (line.type === "assistant") {
      const entry = assistantById.get(line.message?.id as string);
      if (!entry) continue;

      const blocks: IRContentBlock[] = [];
      for (const block of entry.content) {
        if (block.type === "text") {
          const text = block.text as string;
          if (text.trim()) {
            blocks.push({ type: "text", text });
          }
        } else if (block.type === "thinking") {
          blocks.push({
            type: "thinking",
            text: block.thinking as string,
          });
        } else if (block.type === "tool_use") {
          const name = block.name as string;
          const input = block.input as unknown;
          const argsJson =
            typeof input === "string" ? input : JSON.stringify(input);
          blocks.push({
            type: "tool_call",
            id: block.id as string,
            name: mapToolNameClaudeToCodex(name),
            arguments: remapArgsClaudeToCodex(name, argsJson),
          });
        }
      }

      if (blocks.length > 0) {
        messages.push({
          role: "assistant",
          content: blocks,
          timestamp: line.timestamp,
        });
      }
    } else if (line.type === "result") {
      // Result messages contain tool results from subagents
      const msg = line.message;
      if (!msg) continue;

      const content = msg.content;
      if (typeof content === "string" && content.trim()) {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              toolCallId: (line.toolUseID as string) || "unknown",
              output: content,
            },
          ],
          timestamp: line.timestamp,
        });
      }
    }
  }

  return {
    id: sessionId,
    cwd,
    sourceFormat: "claude",
    sourceModel: model,
    messages,
    gitBranch,
    claudeVersion,
    slug,
  };
}
