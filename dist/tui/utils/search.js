function parseQuery(query) {
    const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
    const filters = { freeText: [] };
    for (const token of tokens) {
        if (token.startsWith("provider:")) {
            const provider = token.slice("provider:".length);
            if (provider === "codex" || provider === "claude" || provider === "opencode") {
                filters.provider = provider;
                continue;
            }
        }
        if (token.startsWith("model:")) {
            const model = token.slice("model:".length);
            if (model) {
                filters.model = model;
                continue;
            }
        }
        filters.freeText.push(token);
    }
    return filters;
}
function matchesSession(session, query) {
    if (!query)
        return true;
    const filters = parseQuery(query);
    if (filters.provider && session.provider !== filters.provider) {
        return false;
    }
    const model = (session.model ?? "").toLowerCase();
    if (filters.model && !model.includes(filters.model)) {
        return false;
    }
    if (filters.freeText.length === 0) {
        return true;
    }
    const target = `${session.title ?? ""} ${session.provider} ${session.projectDir ?? ""} ${session.model ?? ""}`
        .toLowerCase();
    return filters.freeText.every((token) => target.includes(token));
}
export function filterProjectGroups(groups, query) {
    if (!query)
        return groups;
    const normalized = query.toLowerCase();
    return groups
        .map((group) => {
        const filtered = group.sessions.filter((session) => matchesSession(session, normalized));
        return { ...group, sessions: filtered };
    })
        .filter((group) => group.sessions.length > 0);
}
export function filterSessions(sessions, query) {
    if (!query)
        return sessions;
    const normalized = query.toLowerCase();
    return sessions.filter((session) => matchesSession(session, normalized));
}
