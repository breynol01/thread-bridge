import { codexProvider } from "./codex.js";
import { claudeProvider } from "./claude.js";
import { opencodeProvider } from "./opencode.js";
import type { Provider, ProviderName, SessionSummary } from "./types.js";

const providers: Provider[] = [codexProvider, claudeProvider, opencodeProvider];

export function getProvider(name: ProviderName): Provider {
  const p = providers.find((p) => p.name === name);
  if (!p) throw new Error(`Unknown provider: ${name}`);
  return p;
}

export function getAllProviders(): Provider[] {
  return providers;
}

export function listAllSessions(): SessionSummary[] {
  const all: SessionSummary[] = [];
  for (const provider of providers) {
    try {
      all.push(...provider.listSessions());
    } catch {
      // Skip providers that fail (e.g. tool not installed)
    }
  }
  all.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return all;
}
