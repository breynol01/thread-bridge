# Architecture Reference

## Overview
thread-bridge is a thin CLI/TUI orchestration layer built on Ink/Commander/TypeScript. Its goal is to normalize disparate session stores (Codex JSONL, Claude JSONL, OpenCode JSON blobs) into a single intermediate representation (IR) so the CLI commands, conversion utilities, and eventually the TUI/Beep-style proxy share the same decision surface.

## Entry Points
- `bin/thread-bridge.mjs` wires the application to the `thread-bridge` CLI binary in `package.json`.
- `src/cli.ts` registers Commander commands (`list`, `tui`, `convert`, etc.) and delegates to discovery, providers, or TUI components.
- `tsx bin/thread-bridge.ts` is used for `start`, `dev`, and `tui` scripts, ensuring the CLI runs under Node 20+/tsx.

## Provider Subsystem
- `Provider` interface (`src/providers/types.ts`) guarantees every provider exposes a `name`, `listSessions()`, and `readSession(filePath)` that returns an `IRSession`.
- Provider registry (`src/providers/registry.ts`) imports each provider (`codexProvider`, `claudeProvider`, `opencodeProvider`) and exposes helper utilities like `getProvider`, `getAllProviders`, and `listAllSessions` used by the CLI/TUI.
- Each provider implementation composes discovery and reader helpers so callers only care about high-level session summaries and IR data.

## Discovery & Resolution
- Codex discovery (`src/discovery/codexDiscovery.ts`) scans `codexSessionsDir()`, `archived_sessions/`, plus supplemental history/index/global-state files (via `src/utils/paths.ts` and `jsonl` helpers) to figure out IDs, metadata, and cwd.
- Claude discovery mirrors the JSONL structure of Claude Code sessions (`src/discovery/claudeDiscovery.ts`) and supports optional project filtering.
- Both discovery modules expose `list`, `find`, and `resolve` helpers used by CLI commands such as `list codex` and the `convert` subcommand.

## Intermediate Representation (IR)
- Shared schema defined in `src/schemas/common.ts` with `IRSession`, `IRMessage`, and discriminated `IRContentBlock` for `text`, `tool_call`, `tool_result`, and `thinking` blocks.
- Readers (e.g., `src/readers/codexReader.ts`, `claudeReader.ts`, and targets under `openCodeReader.ts`) convert provider-native formats into the IR before handing data off to the CLI or writers.
- Writers (`src/writers/codexWriter.ts`, `claudeWriter.ts`) mirror the reader intent, enabling conversions and future write-back flows.

## Unified Index & Aggregation
- `src/unified/index.ts` calls `listAllSessions` from the registry, normalizes `projectDir` via `src/utils/paths.ts`, and groups sessions by project for `list all` command grouping.
- `getSessionsForProject` and `getAllSessions` help future TUI views filter or sort by timestamp for dashboards.

## CLI & TUI Presentation
- CLI commands leverage discovery + providers to render succinct lists (badged per provider via `providerBadge`) and conversions (Codex ↔ Claude) show IR metadata like `messages.length`, `sourceModel`, and `cwd`.
- `list opencode` relies on `opencodeProvider.listSessions()` which currently reads JSON files from `~/.local/share/opencode/storage/` (watch for upcoming SQLite migration noted in `MEMORY.md`).
- `src/tui/index.ts` (the Ink-based UI) renders session content, metadata panels, search/filter controls, and a markdown renderer. The Ink stack reuses React-like components but requires a TTY; non-TTY environments exit early or fallback to CLI commands (Ink limitation documented in `MEMORY.md`).

## Data Flow
1. CLI command triggers discovery (via provider registry) or TUI launch (`launchTui`).
2. Discovery scans files/JSONL logs, deduplicates messages, and produces session summaries with `sessionId`, `timestamp`, `projectDir`.
3. Reader converts native data to the IR schema, capturing `role`, `content`, `tool_call` metadata, and supporting usage info (tokens, file path, git branch).
4. CLI/TUI renders the IR; convert commands call writer helpers to emit target format files. Future write-back flows will reuse the same IR path but push to provider-specific writers or APIs.

## Extensibility & Provider Expansion
- To add a provider (e.g., Cursor, Windsurf), implement the `Provider` interface in `src/providers`, register it in `src/providers/registry.ts`, and add discovery + reader helpers to `src/discovery`/`src/readers` to produce `IRSession` instances.
- Unified index and CLI/TUI automatically pick up new providers as long as they register with `listAllSessions` and `getAllProviders`.
- `src/mappings/toolNameMap.ts` centralizes tool name translations between providers, ensuring tool-call interoperability as provider surface grows.

## Storage & Persistence
- Codex persists sessions as JSONL under `~/.codex/worktrees/{hash}/{name}`; `codexSessionIndexPath()` and `codexHistoryPath()` provide supplemental metadata.
- Claude stores JSONL logs per session along with history entries (metadata includes `sessionId`, `cwd`, `model`). Discovery reads these for listing/resolution.
- OpenCode currently writes flat JSON files under `~/.local/share/opencode/storage/` but is migrating to SQLite post-v1.2.0, so readers should keep both access paths alive during the transition.

## Testing & Quality
- `vitest` powers the test suite (`tests/`) and ensures utilities behave (e.g., JSONL parsing, provider registry). Keep tests focused on normalization, discovery edge cases, and conversion correctness to avoid regressions.
- `tsconfig.json` enforces TypeScript strictness, and `package.json` scripts (`build`, `test`, `tui`) describe supported developer flows.

## Constraints & Known Issues
- Ink/TUI cannot render outside TTY sessions; prefer CLI commands in batch automation.
- OpenCode’s SQLite migration will require a new reader path once the `storage` location changes.
- The providers are read-only now; V2 must carefully authenticate/proxy to original tools before permitting write operations.

## Future Work & Adaptations
- Add a write-back proxy layer that can route responses to Codex, Claude, or OpenCode while preserving IR provenance (V2 “Beeper” plan mentioned in `MEMORY.md`).
- Expand provider list (Cursor, Windsurf, etc.) with minimal friction by reusing the provider registry + IR conversion pipeline.
- Polish TUI: search/filter, metadata sidebar, markdown rendering, and session stats panels to match CLI capabilities noted in the next-steps list in `MEMORY.md`.

## Maintenance Status

- The current architecture is frozen in maintenance mode until a new cross-tool memory pain emerges. Keep provider readers working but avoid expanding the CLI/TUI surface unless absolutely necessary.
