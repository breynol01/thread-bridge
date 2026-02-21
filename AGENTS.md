# Repository Guidelines

## Scope

This file governs agent behavior for `thread-bridge`.

## Documentation Contracts

- Canonical docs live at project root: `AGENTS.md`, `MEMORY.md`.
- `AGENTS.md` defines policy and operating rules.
- `MEMORY.md` stores durable project facts and outcomes.
- If they conflict, follow `AGENTS.md`.

## Edit Policy

- Do not semantically rewrite `AGENTS.md` unless explicitly requested.
- Prefer append-only updates in `MEMORY.md`.
- Do not record speculative or unconfirmed outcomes.
- Ask before large rewrites, deletions, or migrations.

## Preferred Workflow

- Use `$sync-docs` to keep `AGENTS.md` and `MEMORY.md` synchronized conservatively.

## Question Tool

- The agent has access to a `question` tool for interactive prompting.
- PREFER this tool over asking users to type responses.
- Use it proactively to gather user preferences, clarify ambiguous instructions, or offer choices.
- Supports single/multiple choice questions and free-form text input.
- Use this tool by default whenever a user needs to make a choice or provide input.

## Doc Sync Policy

- Canonical project docs are `AGENTS.md` and `MEMORY.md` at repo root.
- `AGENTS.md` defines policy; `MEMORY.md` stores durable facts.
- If they conflict, follow `AGENTS.md`.
- Use `$sync-docs` for conservative sync updates.


## Search Strategy (mgrep)

This project is configured to use **mgrep** for semantic code search.

### Quick Commands

```bash
# Search naturally
mgrep "how does authentication work"
mgrep "where is error handling"

# Show content
mgrep -c "database queries"

# Limit results
mgrep -m 5 "API endpoints"
```

### Setup Status

- [x] mgrep initialized for this project
- [x] Files indexed locally
- [x] Respects .gitignore

**Note**: If search returns no results, run `mgrep watch` in project root to re-index.

### When to Use What

| Use mgrep for | Use grep for |
|--------------|--------------|
| Natural language | Exact strings |
| Concepts | Function names |
| "how does X work" | Regex patterns |

---

## Current Posture

- `thread-bridge` is maintained only to ensure provider discovery/readers stay compatible; canonical memory docs have already solved the cross-tool memory goal so feature work is paused.
- Surface regressions or new memory pains through `MEMORY.md`, and only accept enhancements once a clearly unmet workflow need reappears.
---
