import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { writeJsonlFile, appendJsonlLine } from "../utils/jsonl.js";
import { codexSessionFilePath, codexSessionIndexPath, codexHistoryPath, } from "../utils/paths.js";
import { generateUUID } from "../utils/uuid.js";
import { nowIso } from "../utils/timestamp.js";
import { mapToolNameClaudeToCodex, remapArgsClaudeToCodex, } from "../mappings/toolNameMap.js";
/**
 * Write an IR session to Codex CLI JSONL format.
 */
export function writeCodexSession(session, options) {
    const sessionId = generateUUID();
    const now = new Date();
    const filePath = codexSessionFilePath(sessionId, now);
    const timestamp = nowIso();
    const cwd = options?.cwd ?? session.cwd ?? process.cwd();
    const name = options?.name ??
        (session.name ? `${session.name} [from ${session.sourceFormat}]` : undefined);
    const events = [];
    // 1. Session meta
    events.push({
        timestamp,
        type: "session_meta",
        payload: {
            id: sessionId,
            timestamp,
            cwd,
            originator: `thread-bridge (converted from ${session.sourceFormat})`,
            cli_version: "thread-bridge-0.1.0",
            source: "thread-bridge",
        },
    });
    // 2. Emit turn_context with model info before first assistant message
    const modelForContext = session.sourceModel ?? "unknown";
    let turnContextEmitted = false;
    // 3. Convert messages
    for (const msg of session.messages) {
        const ts = msg.timestamp ?? timestamp;
        if (msg.role === "user") {
            // Check for tool results
            const toolResults = msg.content.filter((b) => b.type === "tool_result");
            const textBlocks = msg.content.filter((b) => b.type === "text");
            // Emit text as user message event
            if (textBlocks.length > 0) {
                const text = textBlocks.map((b) => b.text).join("\n");
                events.push({
                    timestamp: ts,
                    type: "event_msg",
                    payload: {
                        type: "user_message",
                        message: text,
                        images: [],
                        local_images: [],
                        text_elements: [],
                    },
                });
                // Also emit as response_item user message
                events.push({
                    timestamp: ts,
                    type: "response_item",
                    payload: {
                        type: "message",
                        role: "user",
                        content: [{ type: "input_text", text }],
                    },
                });
            }
            // Emit tool results as function_call_output
            for (const block of toolResults) {
                if (block.type !== "tool_result")
                    continue;
                events.push({
                    timestamp: ts,
                    type: "response_item",
                    payload: {
                        type: "function_call_output",
                        call_id: block.toolCallId,
                        output: block.output,
                    },
                });
            }
        }
        else if (msg.role === "assistant") {
            // Emit turn_context before first assistant content
            if (!turnContextEmitted) {
                events.push({
                    timestamp: ts,
                    type: "turn_context",
                    payload: {
                        model: modelForContext,
                    },
                });
                turnContextEmitted = true;
            }
            for (const block of msg.content) {
                if (block.type === "text") {
                    events.push({
                        timestamp: ts,
                        type: "response_item",
                        payload: {
                            type: "message",
                            role: "assistant",
                            content: [{ type: "output_text", text: block.text }],
                        },
                    });
                }
                else if (block.type === "tool_call") {
                    const codexName = mapToolNameClaudeToCodex(block.name);
                    events.push({
                        timestamp: ts,
                        type: "response_item",
                        payload: {
                            type: "function_call",
                            name: codexName,
                            arguments: remapArgsClaudeToCodex(block.name, block.arguments),
                            call_id: block.id,
                        },
                    });
                }
                else if (block.type === "thinking") {
                    events.push({
                        timestamp: ts,
                        type: "response_item",
                        payload: {
                            type: "reasoning",
                            id: `reasoning_${generateUUID()}`,
                            summary: [{ type: "summary_text", text: block.text }],
                        },
                    });
                }
            }
        }
    }
    if (options?.dryRun) {
        return { sessionId, filePath };
    }
    // Write session file
    mkdirSync(dirname(filePath), { recursive: true });
    writeJsonlFile(filePath, events);
    // Update session index
    appendJsonlLine(codexSessionIndexPath(), {
        id: sessionId,
        thread_name: name,
        updated_at: timestamp,
    });
    // Update history with first user message
    const firstUserMsg = session.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
        const text = firstUserMsg.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");
        if (text) {
            appendJsonlLine(codexHistoryPath(), {
                session_id: sessionId,
                ts: Math.floor(Date.now() / 1000),
                text,
            });
        }
    }
    return { sessionId, filePath };
}
