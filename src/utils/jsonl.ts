import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";

export function readJsonlLines(filePath: string): unknown[] {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf-8");
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export function writeJsonlFile(filePath: string, items: unknown[]): void {
  const content = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
  writeFileSync(filePath, content, "utf-8");
}

export function appendJsonlLine(filePath: string, item: unknown): void {
  appendFileSync(filePath, JSON.stringify(item) + "\n", "utf-8");
}
