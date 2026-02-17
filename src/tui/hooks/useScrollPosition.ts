import { useState, useCallback } from "react";

export interface ScrollState {
  offset: number;
  selectedIndex: number;
}

export function useScrollPosition(itemCount: number, viewportHeight: number) {
  const [state, setState] = useState<ScrollState>({
    offset: 0,
    selectedIndex: 0,
  });

  const moveUp = useCallback(() => {
    setState((prev) => {
      const newIndex = Math.max(0, prev.selectedIndex - 1);
      let newOffset = prev.offset;
      if (newIndex < newOffset) {
        newOffset = newIndex;
      }
      return { offset: newOffset, selectedIndex: newIndex };
    });
  }, []);

  const moveDown = useCallback(() => {
    setState((prev) => {
      const newIndex = Math.min(itemCount - 1, prev.selectedIndex + 1);
      let newOffset = prev.offset;
      if (newIndex >= newOffset + viewportHeight) {
        newOffset = newIndex - viewportHeight + 1;
      }
      return { offset: newOffset, selectedIndex: newIndex };
    });
  }, [itemCount, viewportHeight]);

  const resetSelection = useCallback(() => {
    setState({ offset: 0, selectedIndex: 0 });
  }, []);

  const visibleRange = {
    start: state.offset,
    end: Math.min(state.offset + viewportHeight, itemCount),
  };

  return {
    selectedIndex: state.selectedIndex,
    offset: state.offset,
    visibleRange,
    moveUp,
    moveDown,
    resetSelection,
  };
}
