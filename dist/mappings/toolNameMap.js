/**
 * Bidirectional tool-name and argument mapping between Codex CLI and Claude Code.
 */
const TOOL_MAPPINGS = [
    {
        codex: "exec_command",
        claude: "Bash",
        argsCodexToClaude: { cmd: "command", workdir: "cwd" },
        argsClaudeToCodex: { command: "cmd", cwd: "workdir" },
    },
    {
        codex: "read_file",
        claude: "Read",
        argsCodexToClaude: { path: "file_path" },
        argsClaudeToCodex: { file_path: "path" },
    },
    {
        codex: "write_file",
        claude: "Write",
        argsCodexToClaude: { path: "file_path" },
        argsClaudeToCodex: { file_path: "path" },
    },
    {
        codex: "apply_patch",
        claude: "Edit",
        // apply_patch uses a single `patch` arg; Edit uses old_string/new_string/file_path
        // These are structurally different, so we pass through as-is with a note
    },
    {
        codex: "list_directory",
        claude: "LS",
        claudeAliases: ["Glob"],
    },
    {
        codex: "search_files",
        claude: "Grep",
    },
];
const codexToClaudeMap = new Map();
const claudeToCodexMap = new Map();
for (const mapping of TOOL_MAPPINGS) {
    codexToClaudeMap.set(mapping.codex, mapping);
    claudeToCodexMap.set(mapping.claude, mapping);
    for (const alias of mapping.claudeAliases ?? []) {
        claudeToCodexMap.set(alias, mapping);
    }
}
export function mapToolNameCodexToClaude(codexName) {
    const mapping = codexToClaudeMap.get(codexName);
    return mapping?.claude ?? codexName;
}
export function mapToolNameClaudeToCodex(claudeName) {
    const mapping = claudeToCodexMap.get(claudeName);
    return mapping?.codex ?? claudeName;
}
/**
 * Remap tool arguments from Codex format to Claude format.
 * Returns a new JSON string with remapped argument keys.
 */
export function remapArgsCodexToClaude(codexToolName, argsJson) {
    const mapping = codexToClaudeMap.get(codexToolName);
    if (!mapping?.argsCodexToClaude)
        return argsJson;
    try {
        const args = JSON.parse(argsJson);
        const remapped = {};
        for (const [key, value] of Object.entries(args)) {
            const newKey = mapping.argsCodexToClaude[key] ?? key;
            remapped[newKey] = value;
        }
        return JSON.stringify(remapped);
    }
    catch {
        return argsJson;
    }
}
/**
 * Remap tool arguments from Claude format to Codex format.
 * Returns a new JSON string with remapped argument keys.
 */
export function remapArgsClaudeToCodex(claudeToolName, argsJson) {
    const mapping = claudeToCodexMap.get(claudeToolName);
    if (!mapping?.argsClaudeToCodex)
        return argsJson;
    try {
        const args = JSON.parse(argsJson);
        const remapped = {};
        for (const [key, value] of Object.entries(args)) {
            const newKey = mapping.argsClaudeToCodex[key] ?? key;
            remapped[newKey] = value;
        }
        return JSON.stringify(remapped);
    }
    catch {
        return argsJson;
    }
}
