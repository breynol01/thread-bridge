import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
export function readJsonlLines(filePath) {
    if (!existsSync(filePath))
        return [];
    const text = readFileSync(filePath, "utf-8");
    return text
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
export function writeJsonlFile(filePath, items) {
    const content = items.map((item) => JSON.stringify(item)).join("\n") + "\n";
    writeFileSync(filePath, content, "utf-8");
}
export function appendJsonlLine(filePath, item) {
    appendFileSync(filePath, JSON.stringify(item) + "\n", "utf-8");
}
