import { z } from "zod";

export const IRTextBlock = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const IRToolCallBlock = z.object({
  type: z.literal("tool_call"),
  id: z.string(),
  name: z.string(),
  arguments: z.string(), // JSON string
});

export const IRToolResultBlock = z.object({
  type: z.literal("tool_result"),
  toolCallId: z.string(),
  output: z.string(),
  isError: z.boolean().optional(),
});

export const IRThinkingBlock = z.object({
  type: z.literal("thinking"),
  text: z.string(),
});

export const IRContentBlock = z.discriminatedUnion("type", [
  IRTextBlock,
  IRToolCallBlock,
  IRToolResultBlock,
  IRThinkingBlock,
]);

export const IRMessage = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.array(IRContentBlock),
  timestamp: z.string().optional(), // ISO 8601
});

export const IRSession = z.object({
  id: z.string(),
  name: z.string().optional(),
  cwd: z.string().optional(),
  sourceFormat: z.enum(["codex", "claude", "opencode"]),
  sourceModel: z.string().optional(),
  messages: z.array(IRMessage),
  metadata: z.record(z.unknown()).optional(),
  // Format-specific metadata for higher-fidelity conversion
  gitBranch: z.string().optional(),
  claudeVersion: z.string().optional(),
  slug: z.string().optional(),
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
    })
    .optional(),
});

export type IRTextBlock = z.infer<typeof IRTextBlock>;
export type IRToolCallBlock = z.infer<typeof IRToolCallBlock>;
export type IRToolResultBlock = z.infer<typeof IRToolResultBlock>;
export type IRThinkingBlock = z.infer<typeof IRThinkingBlock>;
export type IRContentBlock = z.infer<typeof IRContentBlock>;
export type IRMessage = z.infer<typeof IRMessage>;
export type IRSession = z.infer<typeof IRSession>;
