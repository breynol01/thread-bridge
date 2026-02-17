# Product Requirements Document

## Summary
thread-bridge is a CLI/TUI utility that gives power users one place to read their workspace threads across Codex, Claude Code, and OpenCode. V1 is read-only; V2 will add Beeper-style write-back so commands or replies can flow back through the originating tool.

## Problem Statement & User Value
- Users currently juggle multiple isolated thread viewers (Codex CLI, Claude Code, OpenCode) and lose context when switching tools. thread-bridge should surface a unified, project-aware timeline so they can review a complete conversation history without switching environments.
- Operators want confidence that they can inspect once and, eventually, respond once. V2 will let them reply through thread-bridge and route that reply to the original provider, which keeps provenance intact while reducing workflow friction.

## Audience
- CLI-first engineers who keep working directories across several AI copilots.
- Teams auditing assistant outputs and tool calls across multiple session stores.
- Future TUI adopters who want richer navigation + metadata without leaving the terminal.

## Goals
1. Aggregate Codex, Claude, and OpenCode sessions into a consistent IR so users can list and inspect conversations side-by-side.
2. Provide high-fidelity session metadata (cwd, project, timestamps, tool calls) so operators can understand context quickly.
3. Launch a lightweight TUI (Ink + React) that lets users browse, search, and render markdown content from these sessions.
4. Prepare the codebase for V2 by defining provider abstractions, conversion utilities, and extension hooks so write-back is pluggable.

## Success Criteria
- `thread-bridge list all` surfaces sessions grouped by normalized project directories with badges for provider/type/date.
- `thread-bridge tui` launches without crashing on TTY terminals and renders messages in IR order with source badges, markdown rendering, and metadata panel (pending UX polish tasks noted in MEMORY.md).
- IR schema covers the cross-tool data (text, thinking, tool calls/results) and is re-used by readers/writers.
- Providers discover sessions via documented paths (`~/.codex/worktrees`, Claude JSONL indexes, OpenCode JSON storage) and expose session summaries for CLI/TUI consumption.
- `convert` commands (Codex→Claude and vice versa) produce sanitized IR while honoring `--dry-run` and `--cwd` during conversions.
- README or docs highlight open issues (OpenCode SQLite migration, TUI non-TTY limit) and next steps from MEMORY.md.[^1]

## Requirements
### V1 – Unified Read-Only Viewer
- Discover Codex sessions by scanning rollout JSONL, history logs, global state, etc.
- Discover Claude sessions via JSONL message logs, including `project` filtering when passed.
- Read OpenCode sessions from the JSON files stored under `~/.local/share/opencode/storage/` (and expect future migration to SQLite as noted in MEMORY.md).
- Normalize to the IR schema defined in `src/schemas/common.ts` before presenting data to the CLI/TUI.
- Provide conversion commands and `writer` modules for eventual replay.
- Document limitations (non-TTY, search/filter TODOs, provider expansion) in canonical docs.

### V2 – Bidirectional Beeper-style Bridge
- Route replies typed in thread-bridge back to the originating provider (Codex, Claude, or OpenCode) and write them to the provider’s session store or API.
- Track message provenance so replies map to `tool_call`/`tool_result` blocks when relevant.
- Allow configuration of default response behaviors, including which provider acts as the canonical output channel.
- Ensure the provider abstraction can push writes and updated metadata back into the unified index.

## Constraints
- Runs in Node 20+ with TypeScript, uses Ink for TUI rendering, and is shipped via `tsx bin/thread-bridge.ts` entrypoint.
- TUI depends on a TTY; Ink does not support headless sessions (known issue from MEMORY.md).
- Providers rely on existing discovery modules; new providers must implement `Provider` and register themselves in `providers/registry.ts`.
- OpenCode storage path or format may change once SQLite migration completes, so readers must support fallback paths.

## Non-Goals
- Replace the native tooling (Codex CLI, Claude Code GUI, OpenCode) in V1; the CLI/TUI only inspects and converts.
- Become a distributed messaging bus; routing is limited to local session stores until V2’s proxy layer exists.

## Assumptions
- Session storage locations do not change frequently; discovery logic can rely on static directory paths and existing index files.
- Users are willing to install Ink-compatible terminals and run the CLI from a shell with access to model logs.
- OpenCode will at some point add SQLite-backed session storage, but JSON files remain available for backward compatibility (per MEMORY.md note).

## Risks & Mitigations
1. **OpenCode migration to SQLite** – risk: reader breaks when JSON files disappear. Mitigation: detect SQLite flag (future path) and keep JSON reader around until migration completes; treat new driver as optional provider until we can fully switch. (MEMORY.md warns about this.)
2. **TUI not running in headless contexts** – Mitigation: detect `process.stdout.isTTY` and exit with a helpful message; keep CLI commands for automation.
3. **Provider interface drifts** – Mitigation: centralize `Provider` interface in `src/providers/types.ts` and use `providers/registry.ts` to keep discovery/read/write plumbing consistent.

## Milestones
1. Document current state (this PRD + ARCHITECTURE) and capture README/MEMORY gaps. ✅
2. Polish V1 CLI/TUI (search/filter, metadata, markdown) and record in MEMORY. 🛠️
3. Add OpenCode SQLite reader stub and confirm both stores are supported. 🧪
4. Implement V2 write-back proxy + provider adapters. 🔁
