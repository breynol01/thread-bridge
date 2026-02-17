import { Command } from "commander";
import chalk from "chalk";
import { readCodexSession } from "./readers/codexReader.js";
import { readClaudeSession } from "./readers/claudeReader.js";
import { writeCodexSession } from "./writers/codexWriter.js";
import { writeClaudeSession } from "./writers/claudeWriter.js";
import { listCodexSessions, resolveCodexSession, } from "./discovery/codexDiscovery.js";
import { listClaudeSessions, resolveClaudeSession, } from "./discovery/claudeDiscovery.js";
import { opencodeProvider } from "./providers/opencode.js";
import { getUnifiedIndex } from "./unified/index.js";
function providerBadge(provider) {
    switch (provider) {
        case "codex": return chalk.yellow("codex");
        case "claude": return chalk.blue("claude");
        case "opencode": return chalk.magenta("ocode");
    }
}
/**
 * Try to resolve a session ID prefix across both Codex and Claude.
 * Returns { source, id, filePath } or undefined.
 */
function resolveAnySession(idPrefix, sourceHint) {
    if (sourceHint === "codex" || !sourceHint) {
        const codex = resolveCodexSession(idPrefix);
        if (codex)
            return { source: "codex", ...codex };
    }
    if (sourceHint === "claude" || !sourceHint) {
        const claude = resolveClaudeSession(idPrefix);
        if (claude)
            return { source: "claude", ...claude };
    }
    return undefined;
}
export function createCli() {
    const program = new Command();
    program
        .name("thread-bridge")
        .description("Unified thread viewer for Codex, Claude Code, and OpenCode")
        .version("0.1.0");
    // --- list ---
    const list = program.command("list").description("List sessions");
    list
        .command("codex")
        .description("List Codex CLI sessions")
        .action(() => {
        const sessions = listCodexSessions();
        if (sessions.length === 0) {
            console.log(chalk.yellow("No Codex sessions found."));
            return;
        }
        console.log(chalk.bold(`Found ${sessions.length} Codex sessions:\n`));
        for (const s of sessions.slice(0, 25)) {
            const name = s.name ?? chalk.dim("(unnamed)");
            const date = new Date(s.updatedAt).toLocaleString();
            const hasFile = s.filePath ? chalk.green("*") : chalk.red("!");
            console.log(`  ${hasFile} ${chalk.cyan(s.id)}  ${name}  ${chalk.dim(date)}`);
        }
        if (sessions.length > 25) {
            console.log(chalk.dim(`  ... and ${sessions.length - 25} more`));
        }
    });
    list
        .command("claude")
        .description("List Claude Code sessions")
        .option("--project <path>", "Filter by project path")
        .action((opts) => {
        const sessions = listClaudeSessions(opts.project);
        if (sessions.length === 0) {
            console.log(chalk.yellow("No Claude sessions found."));
            return;
        }
        console.log(chalk.bold(`Found ${sessions.length} Claude sessions:\n`));
        for (const s of sessions.slice(0, 25)) {
            const display = s.display.slice(0, 60);
            const date = new Date(s.timestamp).toLocaleString();
            const hasFile = s.filePath ? chalk.green("*") : chalk.red("!");
            console.log(`  ${hasFile} ${chalk.cyan(s.sessionId)}  ${display}  ${chalk.dim(date)}`);
        }
        if (sessions.length > 25) {
            console.log(chalk.dim(`  ... and ${sessions.length - 25} more`));
        }
    });
    list
        .command("opencode")
        .description("List OpenCode sessions")
        .action(() => {
        const sessions = opencodeProvider.listSessions();
        if (sessions.length === 0) {
            console.log(chalk.yellow("No OpenCode sessions found."));
            return;
        }
        console.log(chalk.bold(`Found ${sessions.length} OpenCode sessions:\n`));
        for (const s of sessions.slice(0, 25)) {
            const title = s.title ?? chalk.dim("(unnamed)");
            const date = new Date(s.timestamp).toLocaleString();
            const dir = s.projectDir ? chalk.dim(` ${s.projectDir}`) : "";
            console.log(`  ${chalk.magenta("ocode")} ${chalk.cyan(s.id)}  ${title}${dir}  ${chalk.dim(date)}`);
        }
        if (sessions.length > 25) {
            console.log(chalk.dim(`  ... and ${sessions.length - 25} more`));
        }
    });
    list
        .command("all")
        .description("List all sessions across providers, grouped by project")
        .action(() => {
        const groups = getUnifiedIndex();
        if (groups.length === 0) {
            console.log(chalk.yellow("No sessions found across any provider."));
            return;
        }
        const totalSessions = groups.reduce((n, g) => n + g.sessions.length, 0);
        console.log(chalk.bold(`${totalSessions} sessions across ${groups.length} projects:\n`));
        for (const group of groups) {
            const dir = group.projectDir === "(no project)"
                ? chalk.dim("(no project)")
                : chalk.bold(group.projectDir.replace(process.env.HOME ?? "", "~"));
            console.log(`${dir}  ${chalk.dim(`(${group.sessions.length} sessions)`)}`);
            for (const s of group.sessions.slice(0, 10)) {
                const badge = providerBadge(s.provider);
                const title = (s.title ?? "(unnamed)").slice(0, 50);
                const date = new Date(s.timestamp).toLocaleString();
                console.log(`  ${badge} ${chalk.cyan(s.id.slice(0, 12))}  ${title}  ${chalk.dim(date)}`);
            }
            if (group.sessions.length > 10) {
                console.log(chalk.dim(`  ... and ${group.sessions.length - 10} more`));
            }
            console.log();
        }
    });
    // --- tui ---
    program
        .command("tui")
        .description("Launch interactive thread viewer")
        .action(async () => {
        const { launchTui } = await import("./tui/index.js");
        launchTui();
    });
    // --- convert ---
    const convert = program.command("convert").description("Convert a session");
    convert
        .command("codex [sessionId]")
        .description("Convert a Codex session to Claude Code format")
        .option("--dry-run", "Preview without writing files")
        .option("--cwd <path>", "Working directory for the converted session")
        .option("--name <name>", "Custom session name")
        .action((sessionId, opts) => {
        if (!sessionId) {
            const sessions = listCodexSessions();
            if (sessions.length === 0) {
                console.log(chalk.yellow("No Codex sessions found."));
                return;
            }
            console.log(chalk.yellow("Please provide a session ID. Available sessions:\n"));
            for (const s of sessions.slice(0, 15)) {
                const name = s.name ?? "(unnamed)";
                console.log(`  ${chalk.cyan(s.id)}  ${name}`);
            }
            return;
        }
        const resolved = resolveAnySession(sessionId, "codex");
        if (!resolved) {
            console.error(chalk.red(`Session not found for: ${sessionId}`));
            process.exit(1);
        }
        console.log(chalk.dim(`Reading Codex session from: ${resolved.filePath}`));
        const ir = readCodexSession(resolved.filePath);
        console.log(chalk.dim(`Parsed ${ir.messages.length} messages (model: ${ir.sourceModel ?? "unknown"})`));
        const result = writeClaudeSession(ir, opts);
        if (opts.dryRun) {
            console.log(chalk.yellow("\n[dry-run] Would write to:"));
            console.log(`  ${result.filePath}`);
        }
        else {
            console.log(chalk.green("\nConverted successfully!"));
            console.log(`  Session file: ${result.filePath}`);
        }
        console.log(chalk.bold(`\nResume with: claude --resume ${result.sessionId}`));
    });
    convert
        .command("claude [sessionId]")
        .description("Convert a Claude Code session to Codex format")
        .option("--dry-run", "Preview without writing files")
        .option("--cwd <path>", "Working directory for the converted session")
        .option("--name <name>", "Custom session name")
        .action((sessionId, opts) => {
        if (!sessionId) {
            const sessions = listClaudeSessions();
            if (sessions.length === 0) {
                console.log(chalk.yellow("No Claude sessions found."));
                return;
            }
            console.log(chalk.yellow("Please provide a session ID. Available sessions:\n"));
            for (const s of sessions.slice(0, 15)) {
                console.log(`  ${chalk.cyan(s.sessionId)}  ${s.display.slice(0, 60)}`);
            }
            return;
        }
        const resolved = resolveAnySession(sessionId, "claude");
        if (!resolved) {
            console.error(chalk.red(`Session not found for: ${sessionId}`));
            process.exit(1);
        }
        console.log(chalk.dim(`Reading Claude session from: ${resolved.filePath}`));
        const ir = readClaudeSession(resolved.filePath);
        console.log(chalk.dim(`Parsed ${ir.messages.length} messages (model: ${ir.sourceModel ?? "unknown"})`));
        const result = writeCodexSession(ir, opts);
        if (opts.dryRun) {
            console.log(chalk.yellow("\n[dry-run] Would write to:"));
            console.log(`  ${result.filePath}`);
        }
        else {
            console.log(chalk.green("\nConverted successfully!"));
            console.log(`  Session file: ${result.filePath}`);
        }
        console.log(chalk.bold(`\nResume with: codex --resume ${result.sessionId}`));
    });
    // --- inspect ---
    program
        .command("inspect <sessionId>")
        .description("Preview IR without writing (auto-detects source, or use --source)")
        .option("-s, --source <source>", "Force source: codex or claude")
        .action((sessionId, opts) => {
        const sourceHint = opts.source;
        if (sourceHint && sourceHint !== "codex" && sourceHint !== "claude") {
            console.error(chalk.red(`Unknown source: ${sourceHint}. Use 'codex' or 'claude'.`));
            process.exit(1);
        }
        const resolved = resolveAnySession(sessionId, sourceHint);
        if (!resolved) {
            console.error(chalk.red(`Session not found for: ${sessionId}`));
            process.exit(1);
        }
        console.log(chalk.dim(`Found ${resolved.source} session: ${resolved.id}`));
        const ir = resolved.source === "codex"
            ? readCodexSession(resolved.filePath)
            : readClaudeSession(resolved.filePath);
        console.log(chalk.bold("\nIR Session:"));
        console.log(`  ID: ${ir.id}`);
        console.log(`  Source: ${ir.sourceFormat}`);
        console.log(`  Model: ${ir.sourceModel ?? "unknown"}`);
        console.log(`  CWD: ${ir.cwd ?? "unknown"}`);
        console.log(`  Messages: ${ir.messages.length}\n`);
        for (let i = 0; i < ir.messages.length; i++) {
            const msg = ir.messages[i];
            const role = msg.role === "assistant" ? chalk.green(msg.role) : chalk.blue(msg.role);
            console.log(`  [${i}] ${role}  ${chalk.dim(msg.timestamp ?? "")}`);
            for (const block of msg.content) {
                if (block.type === "text") {
                    const preview = block.text.slice(0, 100);
                    console.log(`       text: ${preview}${block.text.length > 100 ? "..." : ""}`);
                }
                else if (block.type === "tool_call") {
                    const argsPreview = block.arguments.slice(0, 60);
                    console.log(`       tool_call: ${block.name}(${argsPreview}...)`);
                }
                else if (block.type === "tool_result") {
                    const outPreview = block.output.slice(0, 80);
                    console.log(`       tool_result: [${block.toolCallId.slice(0, 20)}] ${outPreview}...`);
                }
                else if (block.type === "thinking") {
                    const preview = block.text.slice(0, 100);
                    console.log(`       thinking: ${preview}...`);
                }
            }
        }
    });
    return program;
}
