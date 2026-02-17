import { readJsonlLines } from "../utils/jsonl.js";
import { mapToolNameClaudeToCodex, remapArgsClaudeToCodex, } from "../mappings/toolNameMap.js";
/**
 * Read a Claude Code JSONL session file and convert to IR.
 */
export function readClaudeSession(filePath) {
    const lines = readJsonlLines(filePath);
    // Extract metadata from first user/assistant message
    let sessionId = "unknown";
    let cwd;
    let model;
    let gitBranch;
    let claudeVersion;
    let slug;
    // Collect assistant messages, dedup by message.id (streaming produces multiples)
    const assistantById = new Map();
    const userMessages = [];
    const resultMessages = [];
    for (const line of lines) {
        // Skip non-message types
        if (line.type === "file-history-snapshot" ||
            line.type === "progress") {
            continue;
        }
        if (line.sessionId)
            sessionId = line.sessionId;
        if (line.cwd)
            cwd = line.cwd;
        if (line.gitBranch && !gitBranch)
            gitBranch = line.gitBranch;
        if (line.version && !claudeVersion)
            claudeVersion = line.version;
        if (line.slug && !slug)
            slug = line.slug;
        if (line.type === "user") {
            userMessages.push(line);
        }
        else if (line.type === "assistant") {
            const msg = line.message;
            if (!msg)
                continue;
            const msgId = msg.id;
            if (!msgId)
                continue;
            // Extract model
            if (msg.model && !model) {
                model = msg.model;
            }
            const content = msg.content;
            if (!content)
                continue;
            // Dedup: keep most complete version (most content blocks)
            const existing = assistantById.get(msgId);
            if (!existing || content.length >= existing.content.length) {
                assistantById.set(msgId, { line, content });
            }
        }
        else if (line.type === "result") {
            resultMessages.push(line);
        }
    }
    // Build ordered messages by flattening the parentUuid chain
    const allLines = [];
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
    const messages = [];
    for (const line of allLines) {
        if (line.type === "user") {
            const msg = line.message;
            if (!msg)
                continue;
            const content = msg.content;
            const blocks = [];
            if (typeof content === "string") {
                blocks.push({ type: "text", text: content });
            }
            else if (Array.isArray(content)) {
                for (const block of content) {
                    if (block.type === "text") {
                        blocks.push({ type: "text", text: block.text });
                    }
                    else if (block.type === "tool_result") {
                        const resultContent = block.content;
                        let output;
                        if (typeof resultContent === "string") {
                            output = resultContent;
                        }
                        else if (Array.isArray(resultContent)) {
                            output = resultContent
                                .filter((c) => c.type === "text")
                                .map((c) => c.text)
                                .join("\n");
                        }
                        else {
                            output = JSON.stringify(resultContent);
                        }
                        blocks.push({
                            type: "tool_result",
                            toolCallId: block.tool_use_id,
                            output,
                            isError: block.is_error || undefined,
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
        }
        else if (line.type === "assistant") {
            const entry = assistantById.get(line.message?.id);
            if (!entry)
                continue;
            const blocks = [];
            for (const block of entry.content) {
                if (block.type === "text") {
                    const text = block.text;
                    if (text.trim()) {
                        blocks.push({ type: "text", text });
                    }
                }
                else if (block.type === "thinking") {
                    blocks.push({
                        type: "thinking",
                        text: block.thinking,
                    });
                }
                else if (block.type === "tool_use") {
                    const name = block.name;
                    const input = block.input;
                    const argsJson = typeof input === "string" ? input : JSON.stringify(input);
                    blocks.push({
                        type: "tool_call",
                        id: block.id,
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
        }
        else if (line.type === "result") {
            // Result messages contain tool results from subagents
            const msg = line.message;
            if (!msg)
                continue;
            const content = msg.content;
            if (typeof content === "string" && content.trim()) {
                messages.push({
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            toolCallId: line.toolUseID || "unknown",
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
