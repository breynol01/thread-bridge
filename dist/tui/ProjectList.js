import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import { ScrollableList } from "./ScrollableList.js";
export function ProjectList({ groups, isActive, selectedIndex, onSelectedChange, height, }) {
    const borderColor = isActive ? "yellow" : "gray";
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: borderColor, width: "100%", children: [_jsxs(Box, { children: [_jsx(Text, { bold: true, children: " Projects " }), _jsxs(Text, { dimColor: true, children: ["[", groups.length, "]"] })] }), _jsx(ScrollableList, { items: groups, height: height, isActive: isActive, selectedIndex: selectedIndex, onSelectedChange: onSelectedChange, renderItem: (group, _index, isSelected) => {
                    const dir = group.projectDir === "(no project)"
                        ? "(no project)"
                        : group.projectDir.replace(process.env.HOME ?? "", "~");
                    const count = group.sessions.length;
                    return (_jsxs(Text, { wrap: "truncate", children: [isSelected ? (_jsx(Text, { color: "yellow", bold: true, children: "> " })) : (_jsx(Text, { children: "  " })), _jsx(Text, { color: isSelected ? "yellow" : undefined, bold: isSelected, children: dir }), _jsxs(Text, { dimColor: true, children: [" (", count, ")"] })] }));
                } })] }));
}
