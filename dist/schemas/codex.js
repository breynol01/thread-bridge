import { z } from "zod";
// --- Codex JSONL event types ---
export const CodexSessionMeta = z.object({
    timestamp: z.string(),
    type: z.literal("session_meta"),
    payload: z.object({
        id: z.string(),
        timestamp: z.string(),
        cwd: z.string().optional(),
        originator: z.string().optional(),
        cli_version: z.string().optional(),
        source: z.string().optional(),
        model_provider: z.string().optional(),
        base_instructions: z.object({ text: z.string() }).optional(),
        git: z
            .object({
            commit_hash: z.string().optional(),
            repository_url: z.string().optional(),
        })
            .optional(),
    }),
});
const CodexMessageContent = z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
}));
export const CodexResponseItemMessage = z.object({
    timestamp: z.string(),
    type: z.literal("response_item"),
    payload: z.object({
        type: z.literal("message"),
        role: z.string(),
        content: CodexMessageContent,
    }),
});
export const CodexResponseItemFunctionCall = z.object({
    timestamp: z.string(),
    type: z.literal("response_item"),
    payload: z.object({
        type: z.literal("function_call"),
        name: z.string(),
        arguments: z.string(),
        call_id: z.string(),
    }),
});
export const CodexResponseItemFunctionCallOutput = z.object({
    timestamp: z.string(),
    type: z.literal("response_item"),
    payload: z.object({
        type: z.literal("function_call_output"),
        call_id: z.string(),
        output: z.string(),
    }),
});
export const CodexResponseItemReasoning = z.object({
    timestamp: z.string(),
    type: z.literal("response_item"),
    payload: z.object({
        type: z.literal("reasoning"),
        id: z.string().optional(),
        summary: z.array(z.object({ type: z.string(), text: z.string() })).optional(),
        encrypted_content: z.string().optional(),
    }),
});
export const CodexResponseItem = z.union([
    CodexResponseItemMessage,
    CodexResponseItemFunctionCall,
    CodexResponseItemFunctionCallOutput,
    CodexResponseItemReasoning,
]);
export const CodexEventMsg = z.object({
    timestamp: z.string(),
    type: z.literal("event_msg"),
    payload: z.object({
        type: z.string(),
        message: z.string().optional(),
        images: z.array(z.unknown()).optional(),
        info: z.unknown().optional(),
        rate_limits: z.unknown().optional(),
    }),
});
export const CodexTurnContext = z.object({
    timestamp: z.string(),
    type: z.literal("turn_context"),
    payload: z.record(z.unknown()),
});
export const CodexEvent = z.discriminatedUnion("type", [
    CodexSessionMeta,
    z.object({
        timestamp: z.string(),
        type: z.literal("response_item"),
        payload: z.record(z.unknown()),
    }),
    CodexEventMsg,
    CodexTurnContext,
]);
// --- Index / History entries ---
export const CodexIndexEntry = z.object({
    id: z.string(),
    thread_name: z.string().optional(),
    updated_at: z.string(),
});
export const CodexHistoryEntry = z.object({
    session_id: z.string(),
    ts: z.number(),
    text: z.string(),
});
