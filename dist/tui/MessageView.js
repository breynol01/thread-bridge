import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import { getProvider } from "../providers/registry.js";
import { parseMarkdownLines } from "./MarkdownRenderer.js";
function sessionToLines(ir) {
    const lines = [];
    lines.push({ segments: [{ text: `Session: ${ir.id}`, bold: true }] });
    lines.push({
        segments: [
            {
                text: `Source: ${ir.sourceFormat}  Model: ${ir.sourceModel ?? "unknown"}`,
                dim: true,
            },
        ],
    });
    lines.push({
        segments: [{ text: `CWD: ${ir.cwd ?? "unknown"}`, dim: true }],
    });
    lines.push({
        segments: [{ text: `Messages: ${ir.messages.length}`, dim: true }],
    });
    lines.push({ segments: [{ text: "" }] });
    for (const msg of ir.messages) {
        const ts = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "";
        const headerColor = msg.role === "assistant"
            ? "green"
            : msg.role === "user"
                ? "blue"
                : undefined;
        lines.push({
            segments: [
                {
                    text: `[${msg.role}] ${ts}`,
                    color: headerColor,
                    bold: true,
                },
            ],
        });
        for (const block of msg.content) {
            if (block.type === "text") {
                const parsed = parseMarkdownLines(block.text);
                for (const paragraph of parsed) {
                    lines.push({ segments: paragraph.segments });
                }
            }
            else if (block.type === "tool_call") {
                const argsPreview = block.arguments.length > 60
                    ? `${block.arguments.slice(0, 60)}...`
                    : block.arguments;
                lines.push({
                    segments: [
                        { text: "  tool:", dim: true },
                        { text: ` ${block.name}`, bold: true, color: "yellow" },
                        { text: `(${argsPreview})`, dim: true },
                    ],
                });
            }
            else if (block.type === "tool_result") {
                const isError = block.isError ?? false;
                const parsed = parseMarkdownLines(block.output);
                const previewLines = parsed.slice(0, 3);
                const truncated = parsed.length > previewLines.length;
                lines.push({
                    segments: [
                        { text: "  result:", dim: true },
                        { text: isError ? " error" : " ok", color: isError ? "red" : "magenta", dim: true },
                    ],
                });
                for (const paragraph of previewLines) {
                    lines.push({
                        segments: [
                            { text: "    ", dim: true },
                            ...paragraph.segments.map((segment) => ({
                                ...segment,
                                color: segment.color ?? (isError ? "red" : "magenta"),
                                dim: segment.dim ?? true,
                            })),
                        ],
                    });
                }
                if (truncated) {
                    lines.push({
                        segments: [{ text: "    ...", dim: true }],
                    });
                }
            }
            else if (block.type === "thinking") {
                const parsed = parseMarkdownLines(block.text);
                for (const paragraph of parsed) {
                    lines.push({
                        segments: paragraph.segments.map((segment) => ({
                            ...segment,
                            italic: true,
                        })),
                    });
                }
            }
        }
        lines.push({ segments: [{ text: "" }] });
    }
    return lines;
}
export function MessageView({ session, isActive, height }) {
    const [lines, setLines] = useState([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [loading, setLoading] = useState(false);
    const { stdout } = useStdout();
    useEffect(() => {
        if (!stdout || !stdout.isTTY)
            return;
        // Enable mouse reporting + SGR mode
        stdout.write("\u001b[?1000h\u001b[?1006h");
        return () => {
            stdout.write("\u001b[?1000l\u001b[?1006l");
        };
    }, [stdout]);
    useEffect(() => {
        if (!session) {
            setLines([]);
            setScrollOffset(0);
            return;
        }
        setLoading(true);
        try {
            const provider = getProvider(session.provider);
            const ir = provider.readSession(session.filePath);
            setLines(sessionToLines(ir));
            setScrollOffset(0);
        }
        catch (e) {
            setLines([{
                    segments: [{ text: `Error reading session: ${e}`, color: "red" }],
                }]);
        }
        setLoading(false);
    }, [session?.id, session?.filePath]);
    useInput((input, key) => {
        if (!isActive)
            return;
        const maxOffset = Math.max(0, lines.length - height);
        const clampOffset = (value) => Math.min(Math.max(0, value), maxOffset);
        const wheelStep = Math.max(1, Math.min(5, Math.floor(height / 3)));
        // Handle mouse wheel via SGR escape sequences
        if (input?.startsWith("\u001b[<")) {
            const wheelMatch = input.match(/^\u001b\[<(\d+);(\d+);(\d+)([Mm])$/);
            if (wheelMatch) {
                const code = Number(wheelMatch[1]);
                if (code === 64) {
                    setScrollOffset((prev) => clampOffset(prev - wheelStep));
                    return;
                }
                if (code === 65) {
                    setScrollOffset((prev) => clampOffset(prev + wheelStep));
                    return;
                }
            }
        }
        if (input === "j" || key.downArrow) {
            setScrollOffset((prev) => clampOffset(prev + 1));
        }
        if (input === "k" || key.upArrow) {
            setScrollOffset((prev) => clampOffset(prev - 1));
        }
        // Page down/up
        if (input === "d") {
            setScrollOffset((prev) => clampOffset(prev + Math.floor(height / 2)));
        }
        if (input === "u") {
            setScrollOffset((prev) => clampOffset(prev - Math.floor(height / 2)));
        }
    }, { isActive });
    const borderColor = isActive ? "yellow" : "gray";
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "single", borderColor: borderColor, width: "100%", height: height + 3, children: [_jsxs(Box, { children: [session && scrollOffset > 0 ? (_jsx(Text, { color: "yellow", children: " \u25B2" })) : (_jsx(Text, { children: "  " })), _jsx(Text, { bold: true, children: " Messages " }), session && (_jsxs(Text, { dimColor: true, children: ["[", scrollOffset + 1, "/", lines.length, "]"] })), session && scrollOffset + height < lines.length ? (_jsx(Text, { color: "yellow", children: " \u25BC" })) : (_jsx(Text, { children: "  " }))] }), _jsxs(Box, { flexDirection: "column", height: height, children: [!session && (_jsx(Text, { dimColor: true, children: "  Select a thread to view messages" })), loading && _jsx(Text, { dimColor: true, children: "  Loading..." }), !loading &&
                        lines.slice(scrollOffset, scrollOffset + height).map((line, i) => (_jsx(Text, { wrap: "truncate", children: line.segments.map((segment, idx) => (_jsx(Text, { color: segment.color, dimColor: segment.dim, bold: segment.bold, italic: segment.italic, inverse: segment.inverse, backgroundColor: segment.backgroundColor, children: segment.text || " " }, `segment-${idx}`))) }, `line-${scrollOffset + i}`)))] })] }));
}
