import { jsx as _jsx } from "react/jsx-runtime";
import { Text } from "ink";
const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
const bulletRegex = /^\s*[-*]\s+/;
const numberedRegex = /^\s*(\d+)\.\s+/;
const quoteRegex = /^\s*>+\s*/;
const fenceRegex = /^\s*```/;
export function parseInlineMarkdown(text) {
    const normalized = text ?? "";
    const segments = [];
    let lastIndex = 0;
    let match;
    while ((match = inlineRegex.exec(normalized)) !== null) {
        const token = match[0];
        const { index } = match;
        if (index > lastIndex) {
            segments.push({ text: normalized.slice(lastIndex, index) });
        }
        if (token.startsWith("**")) {
            segments.push({ text: token.slice(2, -2), bold: true });
        }
        else if (token.startsWith("`")) {
            segments.push({ text: token.slice(1, -1), inverse: true, dim: true });
        }
        else {
            segments.push({ text: token.slice(1, -1), italic: true });
        }
        lastIndex = index + token.length;
    }
    if (lastIndex < normalized.length) {
        segments.push({ text: normalized.slice(lastIndex) });
    }
    if (segments.length === 0) {
        segments.push({ text: "" });
    }
    return segments;
}
export function parseMarkdownLines(text) {
    const lines = text.split("\n");
    const parsed = [];
    let inFence = false;
    for (const line of lines) {
        if (fenceRegex.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            parsed.push({
                segments: [{ text: line, inverse: true, dim: true }],
            });
            continue;
        }
        if (!line.trim()) {
            parsed.push({ segments: [{ text: "" }] });
            continue;
        }
        let prefix = null;
        let cleaned = line;
        if (quoteRegex.test(line)) {
            cleaned = line.replace(quoteRegex, "");
            prefix = { text: "> ", dim: true, color: "cyan" };
        }
        else if (bulletRegex.test(line)) {
            cleaned = line.replace(bulletRegex, "");
            prefix = { text: "• ", dim: true };
        }
        else if (numberedRegex.test(line)) {
            const match = line.match(numberedRegex);
            if (match) {
                cleaned = line.replace(numberedRegex, "");
                prefix = { text: `${match[1]}. `, dim: true };
            }
        }
        const segments = parseInlineMarkdown(cleaned);
        if (prefix) {
            segments.unshift(prefix);
        }
        parsed.push({ segments });
    }
    return parsed;
}
export function renderMarkdown(text, keyPrefix = "md") {
    return parseMarkdownLines(text).map((line, idx) => (_jsx(Text, { wrap: "truncate", children: line.segments.map((segment, segIdx) => (_jsx(Text, { color: segment.color, dimColor: segment.dim, bold: segment.bold, italic: segment.italic, inverse: segment.inverse, backgroundColor: segment.backgroundColor, children: segment.text }, `${keyPrefix}-${idx}-${segIdx}`))) }, `${keyPrefix}-${idx}`)));
}
