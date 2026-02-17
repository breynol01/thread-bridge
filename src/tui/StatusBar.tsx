import React from "react";
import { Box, Text } from "ink";
import type { PanelId } from "./hooks/useKeyNav.js";
import type { SessionSummary } from "../providers/types.js";

interface StatusBarProps {
  activePanel: PanelId;
  searchActive: boolean;
  searchQuery: string;
  selectedSession?: SessionSummary | null;
}

export function StatusBar({
  activePanel,
  searchActive,
  searchQuery,
  selectedSession,
}: StatusBarProps) {
  const isMessages = activePanel === "messages";

  return (
    <Box>
      <Text dimColor>
        {" "}
        <Text bold color="yellow">Tab</Text> switch
        {"  "}
        <Text bold color="yellow">j/k</Text> {isMessages ? "scroll" : "navigate"}
        {"  "}
        {isMessages && (
          <>
            <Text bold color="yellow">d/u</Text> page
            {"  "}
          </>
        )}
        <Text bold color="yellow">h/l</Text> panels
        {"  "}
        {!isMessages && (
          <>
            <Text bold color="yellow">Enter</Text> select
            {"  "}
          </>
        )}
        <Text bold color="yellow">/</Text> search
        {"  "}
        <Text bold color="yellow">q</Text> quit
        {"  "}
        <Text dimColor>[{activePanel}]</Text>
        {selectedSession && (
          <Text dimColor>
            {"  "}
            {selectedSession.provider}
          </Text>
        )}
        {searchActive && (
          <Text dimColor>
            {"  "}
            <Text color="cyan">search</Text> /{searchQuery}
          </Text>
        )}
      </Text>
    </Box>
  );
}
