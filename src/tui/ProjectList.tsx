import React from "react";
import { Box, Text } from "ink";
import { ScrollableList } from "./ScrollableList.js";
import type { ProjectGroup } from "../unified/index.js";

interface ProjectListProps {
  groups: ProjectGroup[];
  isActive: boolean;
  selectedIndex: number;
  onSelectedChange: (index: number) => void;
  height: number;
}

export function ProjectList({
  groups,
  isActive,
  selectedIndex,
  onSelectedChange,
  height,
}: ProjectListProps) {
  const borderColor = isActive ? "yellow" : "gray";

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      width="100%"
    >
      <Box>
        <Text bold> Projects </Text>
        <Text dimColor>[{groups.length}]</Text>
      </Box>
      <ScrollableList
        items={groups}
        height={height}
        isActive={isActive}
        selectedIndex={selectedIndex}
        onSelectedChange={onSelectedChange}
        renderItem={(group, _index, isSelected) => {
          const dir = group.projectDir === "(no project)"
            ? "(no project)"
            : group.projectDir.replace(process.env.HOME ?? "", "~");
          const count = group.sessions.length;
          return (
            <Text wrap="truncate">
              {isSelected ? (
                <Text color="yellow" bold>{"> "}</Text>
              ) : (
                <Text>{"  "}</Text>
              )}
              <Text color={isSelected ? "yellow" : undefined} bold={isSelected}>
                {dir}
              </Text>
              <Text dimColor> ({count})</Text>
            </Text>
          );
        }}
      />
    </Box>
  );
}
