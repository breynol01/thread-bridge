import { describe, it, expect } from "vitest";
import {
  mapToolNameCodexToClaude,
  mapToolNameClaudeToCodex,
  remapArgsCodexToClaude,
  remapArgsClaudeToCodex,
} from "../../src/mappings/toolNameMap.js";

describe("toolNameMap", () => {
  describe("name mapping", () => {
    it("maps exec_command to Bash", () => {
      expect(mapToolNameCodexToClaude("exec_command")).toBe("Bash");
    });

    it("maps Bash to exec_command", () => {
      expect(mapToolNameClaudeToCodex("Bash")).toBe("exec_command");
    });

    it("maps read_file to Read", () => {
      expect(mapToolNameCodexToClaude("read_file")).toBe("Read");
    });

    it("maps write_file to Write", () => {
      expect(mapToolNameCodexToClaude("write_file")).toBe("Write");
    });

    it("maps Read to read_file", () => {
      expect(mapToolNameClaudeToCodex("Read")).toBe("read_file");
    });

    it("maps Glob and LS to list_directory", () => {
      expect(mapToolNameClaudeToCodex("Glob")).toBe("list_directory");
      expect(mapToolNameClaudeToCodex("LS")).toBe("list_directory");
    });

    it("maps Grep to search_files", () => {
      expect(mapToolNameClaudeToCodex("Grep")).toBe("search_files");
    });

    it("passes through unknown tool names", () => {
      expect(mapToolNameCodexToClaude("unknown_tool")).toBe("unknown_tool");
      expect(mapToolNameClaudeToCodex("UnknownTool")).toBe("UnknownTool");
    });
  });

  describe("argument remapping", () => {
    it("remaps cmd to command for exec_command -> Bash", () => {
      const result = remapArgsCodexToClaude(
        "exec_command",
        '{"cmd":"ls -la","workdir":"/tmp"}',
      );
      const parsed = JSON.parse(result);
      expect(parsed.command).toBe("ls -la");
      expect(parsed.cwd).toBe("/tmp");
      expect(parsed.cmd).toBeUndefined();
    });

    it("remaps command to cmd for Bash -> exec_command", () => {
      const result = remapArgsClaudeToCodex(
        "Bash",
        '{"command":"ls -la","cwd":"/tmp"}',
      );
      const parsed = JSON.parse(result);
      expect(parsed.cmd).toBe("ls -la");
      expect(parsed.workdir).toBe("/tmp");
      expect(parsed.command).toBeUndefined();
    });

    it("remaps path to file_path for read_file -> Read", () => {
      const result = remapArgsCodexToClaude(
        "read_file",
        '{"path":"/Users/test/file.ts"}',
      );
      const parsed = JSON.parse(result);
      expect(parsed.file_path).toBe("/Users/test/file.ts");
    });

    it("remaps path to file_path for write_file -> Write", () => {
      const result = remapArgsCodexToClaude(
        "write_file",
        '{"path":"/Users/test/out.ts","content":"hello"}',
      );
      const parsed = JSON.parse(result);
      expect(parsed.file_path).toBe("/Users/test/out.ts");
      expect(parsed.content).toBe("hello");
    });

    it("passes through args for unknown tools", () => {
      const input = '{"foo":"bar"}';
      expect(remapArgsCodexToClaude("unknown", input)).toBe(input);
      expect(remapArgsClaudeToCodex("unknown", input)).toBe(input);
    });
  });
});
