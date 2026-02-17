import React from "react";
import { Box, Text } from "ink";
import { ScrollableList } from "./ScrollableList.js";
import type { SessionSummary, ProviderName } from "../providers/types.js";

function badge(provider: ProviderName): React.ReactNode {
  switch (provider) {
    case "codex":
      return <Text color="yellow">codex</Text>;
    case "claude":
      return <Text color="blue">claude</Text>;
    case "opencode":
      return <Text color="magenta">ocode</Text>;
  }
}

interface ThreadListProps {
  sessions: SessionSummary[];
  isActive: boolean;
  selectedIndex: number;
  onSelectedChange: (index: number) => void;
  onSelect: (session: SessionSummary) => void;
  height: number;
}

export function ThreadList({
  sessions,
  isActive,
  selectedIndex,
  onSelectedChange,
  onSelect,
  height,
}: ThreadListProps) {
  const borderColor = isActive ? "yellow" : "gray";

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      width="100%"
    >
      <Box>
        <Text bold> Threads </Text>
        <Text dimColor>[{sessions.length}]</Text>
      </Box>
      <ScrollableList
        items={sessions}
        height={height}
        isActive={isActive}
        selectedIndex={selectedIndex}
        onSelectedChange={onSelectedChange}
        onSelect={(s) => onSelect(s)}
        renderItem={(session, _index, isSelected) => {
          const title = (session.title ?? "(unnamed)").slice(0, 40);
          return (
            <Text wrap="truncate">
              {isSelected ? (
                <Text color="yellow" bold>{"> "}</Text>
              ) : (
                <Text>{"  "}</Text>
              )}
              {badge(session.provider)}
              <Text> </Text>
              <Text color={isSelected ? "yellow" : undefined} bold={isSelected}>
                {title}
              </Text>
            </Text>
          );
        }}
      />
    </Box>
  );
}
