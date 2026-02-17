import { z } from "zod";
// --- Claude Code content blocks ---
const ClaudeTextContent = z.object({
    type: z.literal("text"),
    text: z.string(),
});
const ClaudeThinkingContent = z.object({
    type: z.literal("thinking"),
    thinking: z.string(),
    signature: z.string().optional(),
});
const ClaudeToolUseContent = z.object({
    type: z.literal("tool_use"),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
});
const ClaudeToolResultContent = z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string(),
    content: z.unknown(), // string or array of content blocks
    is_error: z.boolean().optional(),
});
export const ClaudeContentBlock = z.discriminatedUnion("type", [
    ClaudeTextContent,
    ClaudeThinkingContent,
    ClaudeToolUseContent,
    ClaudeToolResultContent,
]);
// --- Claude message wrapper (inner API message) ---
const ClaudeApiMessage = z.object({
    model: z.string().optional(),
    id: z.string().optional(),
    type: z.literal("message").optional(),
    role: z.enum(["user", "assistant"]),
    content: z.array(z.record(z.unknown())),
    stop_reason: z.string().nullable().optional(),
    stop_sequence: z.string().nullable().optional(),
    usage: z.record(z.unknown()).optional(),
});
// --- Claude JSONL line types ---
export const ClaudeFileHistorySnapshot = z.object({
    type: z.literal("file-history-snapshot"),
    messageId: z.string(),
    snapshot: z.record(z.unknown()),
    isSnapshotUpdate: z.boolean().optional(),
});
const BaseClaudeMessage = z.object({
    parentUuid: z.string().nullable(),
    isSidechain: z.boolean().optional(),
    userType: z.string().optional(),
    cwd: z.string().optional(),
    sessionId: z.string(),
    version: z.string().optional(),
    gitBranch: z.string().optional(),
    slug: z.string().optional(),
    uuid: z.string(),
    timestamp: z.string(),
});
export const ClaudeUserMessage = BaseClaudeMessage.extend({
    type: z.literal("user"),
    message: z.object({
        role: z.literal("user"),
        content: z.union([z.string(), z.array(z.record(z.unknown()))]),
    }),
    thinkingMetadata: z.record(z.unknown()).optional(),
    todos: z.array(z.unknown()).optional(),
    permissionMode: z.string().optional(),
});
export const ClaudeAssistantMessage = BaseClaudeMessage.extend({
    type: z.literal("assistant"),
    message: ClaudeApiMessage,
    requestId: z.string().optional(),
});
export const ClaudeProgressMessage = BaseClaudeMessage.extend({
    type: z.literal("progress"),
    data: z.record(z.unknown()),
    toolUseID: z.string().optional(),
    parentToolUseID: z.string().optional(),
});
export const ClaudeResultMessage = BaseClaudeMessage.extend({
    type: z.literal("result"),
    message: z.record(z.unknown()),
    toolUseID: z.string().optional(),
    parentToolUseID: z.string().optional(),
});
export const ClaudeLine = z.union([
    ClaudeFileHistorySnapshot,
    ClaudeUserMessage,
    ClaudeAssistantMessage,
    ClaudeProgressMessage,
    ClaudeResultMessage,
]);
// --- Claude history entry ---
export const ClaudeHistoryEntry = z.object({
    display: z.string(),
    pastedContents: z.record(z.unknown()).optional(),
    timestamp: z.number(),
    project: z.string(),
    sessionId: z.string(),
});
