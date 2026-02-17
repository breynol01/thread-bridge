import React from "react";
import { Box, Text, useInput } from "ink";
import { useScrollPosition } from "./hooks/useScrollPosition.js";

interface ScrollableListProps<T> {
  items: T[];
  height: number;
  isActive: boolean;
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  onSelect?: (item: T, index: number) => void;
  selectedIndex?: number;
  onSelectedChange?: (index: number) => void;
}

export function ScrollableList<T>({
  items,
  height,
  isActive,
  renderItem,
  onSelect,
  selectedIndex: controlledIndex,
  onSelectedChange,
}: ScrollableListProps<T>) {
  const scroll = useScrollPosition(items.length, height);

  // Use controlled index if provided
  const selectedIndex = controlledIndex ?? scroll.selectedIndex;

  useInput(
    (input, key) => {
      if (!isActive) return;

      if (input === "j" || key.downArrow) {
        if (controlledIndex !== undefined && onSelectedChange) {
          const next = Math.min(items.length - 1, controlledIndex + 1);
          onSelectedChange(next);
        } else {
          scroll.moveDown();
        }
      }
      if (input === "k" || key.upArrow) {
        if (controlledIndex !== undefined && onSelectedChange) {
          const next = Math.max(0, controlledIndex - 1);
          onSelectedChange(next);
        } else {
          scroll.moveUp();
        }
      }
      if (key.return && onSelect && items[selectedIndex]) {
        onSelect(items[selectedIndex], selectedIndex);
      }
    },
    { isActive },
  );

  if (items.length === 0) {
    return (
      <Box height={height}>
        <Text dimColor>  (empty)</Text>
      </Box>
    );
  }

  // Calculate visible window
  let offset = scroll.offset;
  if (controlledIndex !== undefined) {
    // Adjust offset based on controlled index
    if (controlledIndex < offset) {
      offset = controlledIndex;
    } else if (controlledIndex >= offset + height) {
      offset = controlledIndex - height + 1;
    }
  }

  const visible = items.slice(offset, offset + height);

  return (
    <Box flexDirection="column" height={height}>
      {visible.map((item, i) => {
        const realIndex = offset + i;
        return (
          <Box key={`item-${realIndex}`}>
            {renderItem(item, realIndex, realIndex === selectedIndex)}
          </Box>
        );
      })}
    </Box>
  );
}
