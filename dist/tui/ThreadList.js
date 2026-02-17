import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { ScrollableList } from "./ScrollableList.js";
function badge(provider) {
    switch (provider) {
        case "codex":
            return _jsx(Text, { color: "yellow", children: "codex" });
        case "claude":
            return _jsx(Text, { color: "blue", children: "claude" });
        case "opencode":
            return _jsx(Text, { color: "magenta", children: "ocode" });
    }
}
export function ThreadList({ sessions, isActive, selectedIndex, onSelectedChange, onSelect, height, }) {
    const borderColor = isActive ? "yellow" : "gray";
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: borderColor, width: "100%", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, children: " Threads " }), _jsxs(Text, { dimColor: true, children: ["[", sessions.length, "]"] })] }), _jsx(ScrollableList, { items: sessions, height: height, isActive: isActive, selectedIndex: selectedIndex, onSelectedChange: onSelectedChange, onSelect: (s) => onSelect(s), renderItem: (session, _index, isSelected) => {
                    const title = (session.title ?? "(unnamed)").slice(0, 40);
                    return (_jsxs(Text, { wrap: "truncate", children: [isSelected ? (_jsx(Text, { color: "yellow", bold: true, children: "> " })) : (_jsx(Text, { children: "  " })), badge(session.provider), _jsx(Text, { children: " " }), _jsx(Text, { color: isSelected ? "yellow" : undefined, bold: isSelected, children: title })] }));
                } })] }));
}
