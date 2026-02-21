# Project Memory

## Decisions

- V1 is a read-only unified thread viewer across Codex, Claude Code, and OpenCode
- V2 (future) will be Beeper-style bidirectional: respond through thread-bridge, route back to originating tool
- TUI uses Ink (React for CLI) -- same stack as Claude Code itself
- Provider abstraction wraps existing discovery/reader modules; doesn't replace them

## Conventions

- Providers implement `Provider` interface from `src/providers/types.ts`
- OpenCode stores sessions as flat JSON files under `~/.local/share/opencode/storage/`
- OpenCode uses SHA-1 project hashes to organize sessions by worktree
- OpenCode IDs: `ses_` (session), `msg_` (message), `prt_` (part)
- IR schema supports 3 source formats: codex, claude, opencode

## Known Issues

- OpenCode is migrating to SQLite (post v1.2.0) -- will need a second reader path
- TUI cannot run in non-TTY environments (expected Ink limitation)

## Next Steps

- V2: Beeper-style write-back / proxy layer for bidirectional messaging
- Consider adding more providers (Cursor, Windsurf, etc.)
- TUI polish: search/filter, session metadata panel, markdown rendering

## Maintenance Notes

- As of 2026-02-21, thread-bridge is on maintenance: keep provider discovery & readers working, but do not act on Next Steps until a clear, new multi-tool memory pain appears.
