import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Box, useStdout, useInput } from "ink";
import { useKeyNav } from "./hooks/useKeyNav.js";
import { ProjectList } from "./ProjectList.js";
import { ThreadList } from "./ThreadList.js";
import { MessageView } from "./MessageView.js";
import { SessionMetadataPanel } from "./SessionMetadataPanel.js";
import { StatusBar } from "./StatusBar.js";
import { getUnifiedIndex } from "../unified/index.js";
import { filterProjectGroups, filterSessions } from "./utils/search.js";
export function App({ onQuit }) {
    const { stdout } = useStdout();
    const rows = stdout?.rows ?? 24;
    const cols = stdout?.columns ?? 80;
    const groups = useMemo(() => getUnifiedIndex(), []);
    const [projectIndex, setProjectIndex] = useState(0);
    const [threadIndex, setThreadIndex] = useState(0);
    const [selectedSession, setSelectedSession] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchMode, setSearchMode] = useState(false);
    const searchActive = searchMode || Boolean(searchQuery);
    const filteredGroups = useMemo(() => filterProjectGroups(groups, searchQuery), [groups, searchQuery]);
    const filteredGroupCount = filteredGroups.length;
    const safeProjectIndex = filteredGroupCount === 0
        ? 0
        : Math.min(projectIndex, filteredGroupCount - 1);
    const currentGroup = filteredGroups[safeProjectIndex];
    const filteredSessions = filterSessions(currentGroup?.sessions ?? [], searchQuery);
    const safeThreadIndex = filteredSessions.length === 0
        ? 0
        : Math.min(threadIndex, filteredSessions.length - 1);
    const { activePanel, setActivePanel } = useKeyNav(onQuit, { enabled: !searchMode });
    useEffect(() => {
        if (filteredGroupCount === 0) {
            setProjectIndex(0);
        }
        else if (projectIndex > filteredGroupCount - 1) {
            setProjectIndex(filteredGroupCount - 1);
            setThreadIndex(0);
        }
    }, [filteredGroupCount, projectIndex]);
    useEffect(() => {
        if (filteredSessions.length === 0) {
            setThreadIndex(0);
            setSelectedSession(null);
            return;
        }
        const normalizedIndex = Math.min(threadIndex, filteredSessions.length - 1);
        if (normalizedIndex !== threadIndex) {
            setThreadIndex(normalizedIndex);
            return;
        }
        const session = filteredSessions[normalizedIndex];
        setSelectedSession(session ?? null);
    }, [filteredSessions, threadIndex]);
    useEffect(() => {
        setProjectIndex(0);
        setThreadIndex(0);
    }, [searchQuery]);
    useInput((input, key) => {
        if (searchMode) {
            if (key.escape) {
                setSearchMode(false);
                setSearchQuery("");
                return;
            }
            if (key.return) {
                setSearchMode(false);
                return;
            }
            if (key.backspace || key.delete) {
                setSearchQuery((prev) => prev.slice(0, -1));
                return;
            }
            if (input && !key.ctrl && !key.meta && input.length === 1) {
                setSearchQuery((prev) => prev + input);
            }
            return;
        }
        if (input === "/") {
            setSearchMode(true);
            setSearchQuery("");
        }
    }, { isActive: true });
    const handleProjectChange = useCallback((index) => {
        setProjectIndex(index);
        setThreadIndex(0);
    }, []);
    const handleThreadChange = useCallback((index) => {
        setThreadIndex(index);
    }, []);
    const handleThreadSelect = useCallback((session) => {
        setSelectedSession(session);
        setActivePanel("messages");
    }, [setActivePanel]);
    const contentHeight = rows - 3;
    const leftPanelHeight = Math.floor(contentHeight / 2);
    const leftWidth = Math.min(Math.floor(cols * 0.33), 50);
    const metaWidth = Math.min(Math.floor(cols * 0.25), 40);
    const listHeight = leftPanelHeight - 3;
    const threadListHeight = contentHeight - leftPanelHeight - 3;
    const messageHeight = contentHeight - 3;
    const projectListActive = !searchMode && activePanel === "projects";
    const threadListActive = !searchMode && activePanel === "threads";
    const messagePanelActive = !searchMode && activePanel === "messages";
    return (_jsxs(Box, { flexDirection: "column", height: rows, children: [_jsxs(Box, { flexDirection: "row", height: contentHeight, children: [_jsxs(Box, { flexDirection: "column", width: leftWidth, children: [_jsx(ProjectList, { groups: filteredGroups, isActive: projectListActive, selectedIndex: safeProjectIndex, onSelectedChange: handleProjectChange, height: listHeight }), _jsx(ThreadList, { sessions: filteredSessions, isActive: threadListActive, selectedIndex: safeThreadIndex, onSelectedChange: handleThreadChange, onSelect: handleThreadSelect, height: threadListHeight })] }), _jsx(Box, { flexDirection: "column", width: metaWidth, children: _jsx(SessionMetadataPanel, { session: selectedSession, isActive: messagePanelActive, height: messageHeight }) }), _jsx(Box, { flexDirection: "column", flexGrow: 1, children: _jsx(MessageView, { session: selectedSession, isActive: messagePanelActive, height: messageHeight }) })] }), _jsx(StatusBar, { activePanel: activePanel, searchActive: searchActive, searchQuery: searchQuery, selectedSession: selectedSession })] }));
}
