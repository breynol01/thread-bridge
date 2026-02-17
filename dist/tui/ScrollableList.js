import { jsx as _jsx } from "react/jsx-runtime";
import { Box, Text, useInput } from "ink";
import { useScrollPosition } from "./hooks/useScrollPosition.js";
export function ScrollableList({ items, height, isActive, renderItem, onSelect, selectedIndex: controlledIndex, onSelectedChange, }) {
    const scroll = useScrollPosition(items.length, height);
    // Use controlled index if provided
    const selectedIndex = controlledIndex ?? scroll.selectedIndex;
    useInput((input, key) => {
        if (!isActive)
            return;
        if (input === "j" || key.downArrow) {
            if (controlledIndex !== undefined && onSelectedChange) {
                const next = Math.min(items.length - 1, controlledIndex + 1);
                onSelectedChange(next);
            }
            else {
                scroll.moveDown();
            }
        }
        if (input === "k" || key.upArrow) {
            if (controlledIndex !== undefined && onSelectedChange) {
                const next = Math.max(0, controlledIndex - 1);
                onSelectedChange(next);
            }
            else {
                scroll.moveUp();
            }
        }
        if (key.return && onSelect && items[selectedIndex]) {
            onSelect(items[selectedIndex], selectedIndex);
        }
    }, { isActive });
    if (items.length === 0) {
        return (_jsx(Box, { height: height, children: _jsx(Text, { dimColor: true, children: "  (empty)" }) }));
    }
    // Calculate visible window
    let offset = scroll.offset;
    if (controlledIndex !== undefined) {
        // Adjust offset based on controlled index
        if (controlledIndex < offset) {
            offset = controlledIndex;
        }
        else if (controlledIndex >= offset + height) {
            offset = controlledIndex - height + 1;
        }
    }
    const visible = items.slice(offset, offset + height);
    return (_jsx(Box, { flexDirection: "column", height: height, children: visible.map((item, i) => {
            const realIndex = offset + i;
            return (_jsx(Box, { children: renderItem(item, realIndex, realIndex === selectedIndex) }, `item-${realIndex}`));
        }) }));
}
