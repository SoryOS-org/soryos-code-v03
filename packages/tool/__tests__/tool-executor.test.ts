import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry } from "@soryos/tool";
import type { SessionData } from "@soryos/schema";

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

function makeSession(): SessionData {
  return {
    id: "test-session",
    title: "test-session",
    sandbox_id: "",
    sandbox_state: "running",
    environment: "local",
    providerId: "local",
    model: "gemini-3.8-flash",
    provider: "google",
    created_at: new Date().toISOString(),
    messages: [],
    files: {},
    openFiles: [],
    activeFile: "",
    preview_url: null,
    needs_run: false,
    agent_running: false,
    cwd: "",
  };
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-tool-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed");
  fs.mkdirSync(path.join(tmp, "sub"));
  fs.mkdirSync(path.join(tmp, "decoy"));
  fs.writeFileSync(path.join(tmp, "sub", "clean.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(tmp, "sub", "hits.ts"), "// needleZQ here\n");
  fs.writeFileSync(path.join(tmp, "decoy", "hits.ts"), "// needleZQ decoy\n");
  fs.writeFileSync(path.join(tmp, "root.txt"), "txt\n");
  provider = new LocalExecutionProvider(tmp);
  await provider.init(tmp);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("ToolExecutor — dispatch réel sur disque", () => {
  it("outil inconnu : erreur honnête listant les outils disponibles", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("frobnicate", {}, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/Unknown tool "frobnicate"/);
    expect(r.output).toContain("read_file");
    expect(r.output).toContain("shell_command");
  });

  it("validation : paramètre requis manquant → erreur explicite", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("read_file", {}, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(r.output).toMatch(/Missing required parameter "path" for tool "read_file"/);
  });

  it("write_file puis read_file : cycle réel vérifié sur le disque", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const w = await executor.execute(
      "write_file",
      { path: "sub/written.txt", content: "contenu réel" },
      provider,
      session,
      "build"
    );
    expect(w.isError).toBe(false);
    expect(fs.readFileSync(path.join(tmp, "sub", "written.txt"), "utf8")).toBe("contenu réel");

    const r = await executor.execute("read_file", { path: "sub/written.txt" }, provider, session, "build");
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("contenu réel");
  });

  it("mode plan : write_file refusé avec PERMISSION DENIED, aucun fichier créé", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute(
      "write_file",
      { path: "plan-should-not-exist.txt", content: "x" },
      provider,
      session,
      "plan"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("PERMISSION DENIED");
    expect(String(r.output)).toContain("Plan");
    expect(fs.existsSync(path.join(tmp, "plan-should-not-exist.txt"))).toBe(false);
  });

  it("mode explore : shell_command refusé, lecture autorisée", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const denied = await executor.execute(
      "shell_command",
      { command: "echo nope" },
      provider,
      session,
      "explore"
    );
    expect(denied.isError).toBe(true);
    expect(String(denied.output)).toContain("PERMISSION DENIED");

    const allowed = await executor.execute("read_file", { path: "root.txt" }, provider, session, "explore");
    expect(allowed.isError).toBe(false);
  });

  it("shell_command : exit code non nul → isError + code affiché", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const fail = await executor.execute("shell_command", { command: "exit 3" }, provider, session, "build");
    expect(fail.isError).toBe(true);
    expect(String(fail.output)).toContain("[exit code 3]");

    const ok = await executor.execute(
      "shell_command",
      { command: "echo hello-test" },
      provider, session, "build"
    );
    expect(ok.isError).toBe(false);
    expect(String(ok.output)).toContain("hello-test");
    expect(String(ok.output)).toContain("[exit code 0]");
  });

  it("list_files : scope limité au répertoire demandé (regression chemin relatif)", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("list_files", { path: "sub" }, provider, session, "build");
    expect(r.isError).toBe(false);
    const out = String(r.output);
    expect(out).toContain("sub/clean.ts");
    expect(out).toContain("sub/hits.ts");
    expect(out).not.toContain("decoy");
    expect(out).not.toContain("root.txt");
  });

  it("grep_search : résultats bornés au path demandé (regression scoping)", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const scoped = await executor.execute(
      "grep_search",
      { query: "needleZQ", path: "sub" },
      provider, session, "build"
    );
    expect(scoped.isError).toBe(false);
    expect(String(scoped.output)).toContain("sub/hits.ts");
    expect(String(scoped.output)).not.toContain("decoy");

    const root = await executor.execute("grep_search", { query: "needleZQ" }, provider, session, "build");
    expect(String(root.output)).toContain("2 matches");
    expect(String(root.output)).toContain("decoy/hits.ts");
  });

  it("glob_files : **/*.ts matche les sous-dossiers et ignore les .txt", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("glob_files", { pattern: "**/*.ts" }, provider, session, "build");
    expect(r.isError).toBe(false);
    const out = String(r.output);
    expect(out).toContain("sub/clean.ts");
    expect(out).toContain("sub/hits.ts");
    expect(out).toContain("decoy/hits.ts");
    expect(out).not.toContain("root.txt");
    expect(out).not.toContain("seed.txt");
  });

  it("todo_write puis todo_read : persistance dans la session", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const w = await executor.execute(
      "todo_write",
      { todos: [{ id: "t1", content: "étape 1", status: "pending" }] },
      provider, session, "build"
    );
    expect(w.isError).toBe(false);
    expect(String(w.output)).toContain("1 todos");

    const r = await executor.execute("todo_read", {}, provider, session, "build");
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("étape 1");
    expect(session.todos).toHaveLength(1);
    expect(session.todos?.[0].id).toBe("t1");
  });

  it("lecture hors workspace (traversal) : refusée", async () => {
    const session = makeSession();
    session.cwd = tmp;
    const r = await executor.execute("read_file", { path: "../outside.txt" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toMatch(/traversal|outside workspace/i);
  });

  it("registry : les 35 outils snake_case sont enregistrés", () => {
    const names = toolRegistry.getToolDefinitions().map((t) => t.name).sort();
    for (const expected of [
      "read_file", "write_file", "edit_file", "delete_file", "list_files",
      "glob_files", "grep_search", "shell_command", "git_status", "git_diff",
      "git_log", "git_add", "git_commit", "codebase_search", "todo_write", "todo_read",
      "webfetch", "patch_file", "question",
      "git_worktree_create", "git_worktree_list", "git_worktree_remove",
      "codemode",
      "vision_analyze", "voice_transcribe", "image_info",
    ]) {
      expect(names).toContain(expected);
    }
    expect(names.length).toBe(35);
  });
});
