import React from "react";
import { Text } from "ink";

export interface MarkdownSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
  inverse?: boolean;
  color?: string;
  backgroundColor?: string;
}

export interface MarkdownLine {
  segments: MarkdownSegment[];
}

const inlineRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
const bulletRegex = /^\s*[-*]\s+/;
const numberedRegex = /^\s*(\d+)\.\s+/;
const quoteRegex = /^\s*>+\s*/;
const fenceRegex = /^\s*```/;

export function parseInlineMarkdown(text: string): MarkdownSegment[] {
  const normalized = text ?? "";
  const segments: MarkdownSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(normalized)) !== null) {
    const token = match[0];
    const { index } = match;
    if (index > lastIndex) {
      segments.push({ text: normalized.slice(lastIndex, index) });
    }
    if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith("`")) {
      segments.push({ text: token.slice(1, -1), inverse: true, dim: true });
    } else {
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

export function parseMarkdownLines(text: string): MarkdownLine[] {
  const lines = text.split("\n");
  const parsed: MarkdownLine[] = [];
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

    let prefix: MarkdownSegment | null = null;
    let cleaned = line;

    if (quoteRegex.test(line)) {
      cleaned = line.replace(quoteRegex, "");
      prefix = { text: "> ", dim: true, color: "cyan" };
    } else if (bulletRegex.test(line)) {
      cleaned = line.replace(bulletRegex, "");
      prefix = { text: "• ", dim: true };
    } else if (numberedRegex.test(line)) {
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

export function renderMarkdown(text: string, keyPrefix = "md") {
  return parseMarkdownLines(text).map((line, idx) => (
    <Text key={`${keyPrefix}-${idx}`} wrap="truncate">
      {line.segments.map((segment, segIdx) => (
        <Text
          key={`${keyPrefix}-${idx}-${segIdx}`}
          color={segment.color}
          dimColor={segment.dim}
          bold={segment.bold}
          italic={segment.italic}
          inverse={segment.inverse}
          backgroundColor={segment.backgroundColor}
        >
          {segment.text}
        </Text>
      ))}
    </Text>
  ));
}
