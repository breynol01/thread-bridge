import { readJsonlLines } from "../utils/jsonl.js";
import { mapToolNameCodexToClaude, remapArgsCodexToClaude, } from "../mappings/toolNameMap.js";
/**
 * Read a Codex CLI JSONL session file and convert to IR.
 */
export function readCodexSession(filePath) {
    const lines = readJsonlLines(filePath);
    let meta = { id: "unknown" };
    const messages = [];
    let currentAssistantBlocks = [];
    let currentAssistantTimestamp;
    let model;
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
        const line = raw;
        const timestamp = line.timestamp;
        const type = line.type;
        const payload = line.payload;
        if (!payload)
            continue;
        if (type === "session_meta") {
            meta = {
                id: payload.id,
                cwd: payload.cwd,
                model: line.model,
                timestamp: payload.timestamp,
            };
            continue;
        }
        if (type === "turn_context") {
            model = model ?? payload.model;
            continue;
        }
        if (type === "event_msg") {
            const eventType = payload.type;
            if (eventType === "user_message") {
                flushAssistant();
                const msgText = payload.message;
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
            const payloadType = payload.type;
            if (payloadType === "message") {
                const role = payload.role;
                // Skip developer/system messages
                if (role === "developer" || role === "system")
                    continue;
                if (role === "user") {
                    flushAssistant();
                    const content = payload.content;
                    const textParts = content
                        .filter((c) => c.text)
                        .map((c) => c.text)
                        .join("\n");
                    if (textParts) {
                        messages.push({
                            role: "user",
                            content: [{ type: "text", text: textParts }],
                            timestamp,
                        });
                    }
                }
                else if (role === "assistant") {
                    const content = payload.content;
                    const textParts = content
                        .filter((c) => c.text && c.type === "output_text")
                        .map((c) => c.text);
                    if (textParts.length > 0) {
                        if (!currentAssistantTimestamp)
                            currentAssistantTimestamp = timestamp;
                        currentAssistantBlocks.push({
                            type: "text",
                            text: textParts.join("\n"),
                        });
                    }
                }
            }
            else if (payloadType === "function_call") {
                if (!currentAssistantTimestamp)
                    currentAssistantTimestamp = timestamp;
                const name = payload.name;
                const args = payload.arguments;
                const callId = payload.call_id;
                currentAssistantBlocks.push({
                    type: "tool_call",
                    id: callId,
                    name: mapToolNameCodexToClaude(name),
                    arguments: remapArgsCodexToClaude(name, args),
                });
            }
            else if (payloadType === "function_call_output") {
                // Tool results end the assistant turn context and appear as user-side
                flushAssistant();
                const callId = payload.call_id;
                const output = payload.output;
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
            }
            else if (payloadType === "reasoning") {
                if (!currentAssistantTimestamp)
                    currentAssistantTimestamp = timestamp;
                const summary = payload.summary;
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
