import { readJsonlLines } from "../utils/jsonl.js";
import {
  mapToolNameCodexToClaude,
  remapArgsCodexToClaude,
} from "../mappings/toolNameMap.js";
import type { IRSession, IRMessage, IRContentBlock } from "../schemas/common.js";

interface CodexMeta {
  id: string;
  cwd?: string;
  model?: string;
  timestamp?: string;
}

/**
 * Read a Codex CLI JSONL session file and convert to IR.
 */
export function readCodexSession(filePath: string): IRSession {
  const lines = readJsonlLines(filePath);

  let meta: CodexMeta = { id: "unknown" };
  const messages: IRMessage[] = [];
  let currentAssistantBlocks: IRContentBlock[] = [];
  let currentAssistantTimestamp: string | undefined;
  let model: string | undefined;

  function flushAssistant() {
    if (currentAssistantBlocks.length > 0) {
      messages.push({
        role: "assistant",
        content: currentAssistantBlocks,
        timestamp: currentAssistantTimestamp,
      });
      currentAssistantBlocks = [];
      currentAssistantTimestamp = undefined;
    }
  }

  for (const raw of lines) {
    const line = raw as Record<string, unknown>;
    const timestamp = line.timestamp as string | undefined;
    const type = line.type as string;
    const payload = line.payload as Record<string, unknown> | undefined;

    if (!payload) continue;

    if (type === "session_meta") {
      meta = {
        id: payload.id as string,
        cwd: payload.cwd as string | undefined,
        model: (line as Record<string, unknown>).model as string | undefined,
        timestamp: payload.timestamp as string | undefined,
      };
      continue;
    }

    if (type === "turn_context") {
      model = model ?? (payload.model as string | undefined);
      continue;
    }

    if (type === "event_msg") {
      const eventType = payload.type as string;
      if (eventType === "user_message") {
        flushAssistant();
        const msgText = payload.message as string;
        if (msgText) {
          messages.push({
            role: "user",
            content: [{ type: "text", text: msgText }],
            timestamp,
          });
        }
      }
      continue;
    }

    if (type === "response_item") {
      const payloadType = payload.type as string;

      if (payloadType === "message") {
        const role = payload.role as string;

        // Skip developer/system messages
        if (role === "developer" || role === "system") continue;

        if (role === "user") {
          flushAssistant();
          const content = payload.content as Array<{ type: string; text?: string }>;
          const textParts = content
            .filter((c) => c.text)
            .map((c) => c.text!)
            .join("\n");
          if (textParts) {
            messages.push({
              role: "user",
              content: [{ type: "text", text: textParts }],
              timestamp,
            });
          }
        } else if (role === "assistant") {
          const content = payload.content as Array<{ type: string; text?: string }>;
          const textParts = content
            .filter((c) => c.text && c.type === "output_text")
            .map((c) => c.text!);
          if (textParts.length > 0) {
            if (!currentAssistantTimestamp) currentAssistantTimestamp = timestamp;
            currentAssistantBlocks.push({
              type: "text",
              text: textParts.join("\n"),
            });
          }
        }
      } else if (payloadType === "function_call") {
        if (!currentAssistantTimestamp) currentAssistantTimestamp = timestamp;
        const name = payload.name as string;
        const args = payload.arguments as string;
        const callId = payload.call_id as string;
        currentAssistantBlocks.push({
          type: "tool_call",
          id: callId,
          name: mapToolNameCodexToClaude(name),
          arguments: remapArgsCodexToClaude(name, args),
        });
      } else if (payloadType === "function_call_output") {
        // Tool results end the assistant turn context and appear as user-side
        flushAssistant();
        const callId = payload.call_id as string;
        const output = payload.output as string;
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              toolCallId: callId,
              output,
            },
          ],
          timestamp,
        });
      } else if (payloadType === "reasoning") {
        if (!currentAssistantTimestamp) currentAssistantTimestamp = timestamp;
        const summary = payload.summary as Array<{ text: string }> | undefined;
        const text = summary?.map((s) => s.text).join("\n") || "[Codex reasoning block]";
        currentAssistantBlocks.push({ type: "thinking", text });
      }
    }
  }

  flushAssistant();

  return {
    id: meta.id,
    name: undefined,
    cwd: meta.cwd,
    sourceFormat: "codex",
    sourceModel: model,
    messages,
  };
}
