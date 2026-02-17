import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { writeJsonlFile, appendJsonlLine } from "../utils/jsonl.js";
import { claudeSessionFilePath, claudeHistoryPath, claudeSessionEnvDir, detectClaudeVersion, detectGitBranch, generateAnthropicId, generateSlug, } from "../utils/paths.js";
import { generateUUID } from "../utils/uuid.js";
import { nowIso } from "../utils/timestamp.js";
import { mapToolNameCodexToClaude, remapArgsCodexToClaude, } from "../mappings/toolNameMap.js";
/** Known Claude model IDs that are valid for the model field. */
const CLAUDE_MODELS = new Set([
    "claude-opus-4-6",
    "claude-sonnet-4-5-20250929",
    "claude-haiku-4-5-20251001",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "claude-3-opus-20240229",
    "claude-3-sonnet-20240229",
    "claude-3-haiku-20240307",
]);
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
/**
 * Resolve the model to use in the output.
 * If the source model is already a valid Claude model, keep it.
 * Otherwise use a sensible default.
 */
function resolveModel(session) {
    if (session.sourceModel && CLAUDE_MODELS.has(session.sourceModel)) {
        return session.sourceModel;
    }
    return DEFAULT_MODEL;
}
/**
 * Write an IR session to Claude Code JSONL format.
 */
export function writeClaudeSession(session, options) {
    const sessionId = generateUUID();
    const cwd = options?.cwd ?? session.cwd ?? process.cwd();
    const filePath = claudeSessionFilePath(cwd, sessionId);
    const timestamp = nowIso();
    const version = session.claudeVersion ?? detectClaudeVersion();
    const model = resolveModel(session);
    const gitBranch = session.gitBranch ?? detectGitBranch(cwd);
    // Derive slug from session name or first user message
    let slug = session.slug;
    if (!slug) {
        const firstUserMsg = session.messages.find((m) => m.role === "user");
        const text = session.name ??
            firstUserMsg?.content
                .filter((b) => b.type === "text")
                .map((b) => b.text)
                .join(" ");
        if (text)
            slug = generateSlug(text);
    }
    const lines = [];
    let prevUuid = null;
    // 1. File history snapshot (required first line)
    const snapshotMsgId = generateUUID();
    lines.push({
        type: "file-history-snapshot",
        messageId: snapshotMsgId,
        snapshot: {
            messageId: snapshotMsgId,
            trackedFileBackups: {},
            timestamp,
        },
        isSnapshotUpdate: false,
    });
    // 2. Convert messages with parentUuid chain
    for (const msg of session.messages) {
        const ts = msg.timestamp ?? timestamp;
        if (msg.role === "user") {
            const textBlocks = msg.content.filter((b) => b.type === "text");
            const toolResults = msg.content.filter((b) => b.type === "tool_result");
            // Emit user text message
            if (textBlocks.length > 0) {
                const uuid = generateUUID();
                const text = textBlocks
                    .map((b) => b.text)
                    .join("\n");
                lines.push({
                    parentUuid: prevUuid,
                    isSidechain: false,
                    userType: "external",
                    cwd,
                    sessionId,
                    version,
                    type: "user",
                    message: {
                        role: "user",
                        content: text,
                    },
                    uuid,
                    timestamp: ts,
                    ...(gitBranch ? { gitBranch } : {}),
                    ...(slug ? { slug } : {}),
                });
                prevUuid = uuid;
            }
            // Emit tool results as user messages (Claude convention)
            if (toolResults.length > 0) {
                const uuid = generateUUID();
                const content = toolResults
                    .filter((b) => b.type === "tool_result")
                    .map((b) => {
                    if (b.type !== "tool_result")
                        throw new Error("unreachable");
                    return {
                        type: "tool_result",
                        tool_use_id: b.toolCallId,
                        content: b.output,
                        is_error: b.isError ?? false,
                    };
                });
                lines.push({
                    parentUuid: prevUuid,
                    isSidechain: false,
                    userType: "external",
                    cwd,
                    sessionId,
                    version,
                    type: "user",
                    message: {
                        role: "user",
                        content,
                    },
                    uuid,
                    timestamp: ts,
                    ...(gitBranch ? { gitBranch } : {}),
                    ...(slug ? { slug } : {}),
                });
                prevUuid = uuid;
            }
        }
        else if (msg.role === "assistant") {
            const uuid = generateUUID();
            const msgId = generateAnthropicId("msg");
            const content = [];
            for (const block of msg.content) {
                if (block.type === "text") {
                    content.push({ type: "text", text: block.text });
                }
                else if (block.type === "thinking") {
                    content.push({
                        type: "thinking",
                        thinking: block.text,
                    });
                }
                else if (block.type === "tool_call") {
                    const claudeName = mapToolNameCodexToClaude(block.name);
                    let input;
                    try {
                        input = JSON.parse(remapArgsCodexToClaude(block.name, block.arguments));
                    }
                    catch {
                        input = block.arguments;
                    }
                    content.push({
                        type: "tool_use",
                        id: block.id,
                        name: claudeName,
                        input,
                    });
                }
            }
            const assistantLine = {
                parentUuid: prevUuid,
                isSidechain: false,
                userType: "external",
                cwd,
                sessionId,
                version,
                message: {
                    model,
                    id: msgId,
                    type: "message",
                    role: "assistant",
                    content,
                    stop_reason: null,
                    stop_sequence: null,
                },
                requestId: generateAnthropicId("req"),
                type: "assistant",
                uuid,
                timestamp: ts,
            };
            // Only include usage if the source session carried real usage data
            if (session.usage) {
                assistantLine.message.usage =
                    session.usage;
            }
            if (gitBranch)
                assistantLine.gitBranch = gitBranch;
            if (slug)
                assistantLine.slug = slug;
            lines.push(assistantLine);
            prevUuid = uuid;
        }
    }
    if (options?.dryRun) {
        return { sessionId, filePath };
    }
    // Write session file
    mkdirSync(dirname(filePath), { recursive: true });
    writeJsonlFile(filePath, lines);
    // Create session-env directory
    mkdirSync(claudeSessionEnvDir(sessionId), { recursive: true });
    // Update Claude history
    const firstUserMsg = session.messages.find((m) => m.role === "user");
    const displayText = firstUserMsg
        ? firstUserMsg.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n")
        : `[Converted from ${session.sourceFormat}]`;
    appendJsonlLine(claudeHistoryPath(), {
        display: displayText,
        pastedContents: {},
        timestamp: Date.now(),
        project: cwd,
        sessionId,
    });
    return { sessionId, filePath };
}
