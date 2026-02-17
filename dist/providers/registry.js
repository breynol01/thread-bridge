import { codexProvider } from "./codex.js";
import { claudeProvider } from "./claude.js";
import { opencodeProvider } from "./opencode.js";
const providers = [codexProvider, claudeProvider, opencodeProvider];
export function getProvider(name) {
    const p = providers.find((p) => p.name === name);
    if (!p)
        throw new Error(`Unknown provider: ${name}`);
    return p;
}
export function getAllProviders() {
    return providers;
}
export function listAllSessions() {
    const all = [];
    for (const provider of providers) {
        try {
            all.push(...provider.listSessions());
        }
        catch {
            // Skip providers that fail (e.g. tool not installed)
        }
    }
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return all;
}
