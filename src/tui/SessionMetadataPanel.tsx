import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { getProvider } from "../providers/registry.js";
import type { SessionSummary } from "../providers/types.js";

interface SessionMetadataPanelProps {
  session: SessionSummary | null;
  height: number;
  isActive: boolean;
}

interface ComputedMetadata {
  sessionId: string;
  provider: SessionSummary["provider"];
  title?: string;
  projectDir?: string;
  sourceModel?: string;
  sourceFormat?: string;
  messageCount: number;
  toolCalls: number;
  toolResults: number;
  inputTokens?: number;
  outputTokens?: number;
  lastTimestamp?: string;
  opencodeSource?: string;
}

export function SessionMetadataPanel({
  session,
  height,
  isActive,
}: SessionMetadataPanelProps) {
  const [metadata, setMetadata] = useState<ComputedMetadata | null>(null);
  const [metadataCache, setMetadataCache] = useState<Record<string, ComputedMetadata>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setMetadata(null);
      setError(null);
      return;
    }

    const cached = metadataCache[session.id];
    if (cached) {
      setMetadata(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const provider = getProvider(session.provider);
      const ir = provider.readSession(session.filePath);
      const toolCalls = ir.messages.reduce(
        (sum, msg) => sum + msg.content.filter((block) => block.type === "tool_call").length,
        0,
      );
      const toolResults = ir.messages.reduce(
        (sum, msg) => sum + msg.content.filter((block) => block.type === "tool_result").length,
        0,
      );
      const lastMessage = ir.messages[ir.messages.length - 1];
      const computed: ComputedMetadata = {
        sessionId: ir.id,
        provider: session.provider,
        title: session.title,
        projectDir: session.projectDir,
        sourceModel: ir.sourceModel,
        sourceFormat: ir.sourceFormat,
        messageCount: ir.messages.length,
        toolCalls,
        toolResults,
        inputTokens: ir.usage?.input_tokens,
        outputTokens: ir.usage?.output_tokens,
        lastTimestamp: lastMessage?.timestamp,
        opencodeSource:
          typeof ir.metadata?.opencodeSource === "string"
            ? ir.metadata.opencodeSource
            : undefined,
      };

      setMetadata(computed);
      setMetadataCache((prev) => ({ ...prev, [session.id]: computed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [metadataCache, session?.id, session?.filePath]);

  const borderColor = isActive ? "yellow" : "gray";

  const detailLines = metadata
    ? [
        ["Session ID", metadata.sessionId],
        ["Project", metadata.projectDir ?? "(no project)"],
        ["Provider", metadata.provider],
        ["Source", metadata.opencodeSource ?? metadata.sourceFormat ?? "unknown"],
        ["Model", metadata.sourceModel ?? "unknown"],
        ["Messages", metadata.messageCount.toString()],
        ["Tool calls", metadata.toolCalls.toString()],
        ["Tool results", metadata.toolResults.toString()],
        [
          "Usage",
          metadata.inputTokens || metadata.outputTokens
            ? `${metadata.inputTokens ?? 0} in / ${metadata.outputTokens ?? 0} out`
            : "n/a",
        ],
        [
          "Last update",
          metadata.lastTimestamp
            ? new Date(metadata.lastTimestamp).toLocaleString()
            : "n/a",
        ],
      ]
    : [];

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      width="100%"
      height={height + 3}
    >
      <Box>
        <Text bold> Details </Text>
      </Box>
      <Box flexDirection="column" height={height}>
        {!session && <Text dimColor>  Select a session to view metadata</Text>}
        {loading && <Text dimColor>  Loading metadata...</Text>}
        {!loading && error && (
          <Text color="red">  Error: {error}</Text>
        )}
        {!loading &&
          !error &&
          detailLines.map(([label, value]) => (
            <Text key={label} wrap="truncate">
              <Text bold>{`  ${label}: `}</Text>
              <Text dimColor>{value}</Text>
            </Text>
          ))}
      </Box>
    </Box>
  );
}
