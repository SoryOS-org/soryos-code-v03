import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { SubagentManager, registerTaskTool } from "@soryos/agent";
import type { LlmClient } from "@soryos/agent";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { toolRegistry, ToolExecutor } from "@soryos/tool";
import { LocalExecutionProvider } from "@soryos/execution";

const originalCwd = process.cwd();
let repo: string;

class StubLlm implements LlmClient {
  queue: Array<{ text?: string; error?: string }> = [];
  async generate(): Promise<{ text: string; error?: string }> {
    const next = this.queue.shift();
    if (!next) return { text: "", error: "Stub vide" };
    return next;
  }
  async *streamChat(): AsyncGenerator<{ text: string; error?: string }> {
    yield { text: "stub" };
  }
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function makeSession(id: string) {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = repo;
  session.model = "gemini-3.8-flash";
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: repo });
  return sessionStore.get(id)!;
}

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-wt-iso-"));
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "test@soryos.local");
  git(repo, "config", "user.name", "SoryOS Test");
  fs.writeFileSync(path.join(repo, "seed.txt"), "seed content");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "init");
  process.chdir(repo);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("SubagentManager — isolation worktree (réelle)", () => {
  it("isolate: true écrit DANS le worktree, le dépôt principal reste intact, worktree conservé", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [{ tool: "write_file", parameters: { path: "hello.txt", content: "isolated!" } }],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "done in worktree" }) },
    ];
    const manager = new SubagentManager(stub);
    const session = makeSession("iso-a");

    const result = await manager.run({
      definitionId: "coder",
      prompt: "Écris hello.txt",
      session,
      isolate: true,
    });

    expect(result.success).toBe(true);
    expect(result.output).toBe("done in worktree");
    expect(result.worktreePath).toBeTruthy();
    expect(result.worktreeBranch).toBeTruthy();

    const wtPath = String(result.worktreePath);
    // Le fichier existe dans le worktree…
    expect(fs.existsSync(path.join(wtPath, "hello.txt"))).toBe(true);
    expect(fs.readFileSync(path.join(wtPath, "hello.txt"), "utf8")).toBe("isolated!");
    // …et PAS dans le dépôt principal.
    expect(fs.existsSync(path.join(repo, "hello.txt"))).toBe(false);
    // Le worktree est CONSERVÉ (jamais silencieusement supprimé).
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.readFileSync(path.join(wtPath, "seed.txt"), "utf8")).toBe("seed content");
  });

  it("sans isolate → aucun nouveau worktree créé", async () => {
    const listBefore = execFileSync("git", ["worktree", "list"], { cwd: repo, encoding: "utf8" });
    const stub = new StubLlm();
    stub.queue = [{ text: JSON.stringify({ toolCalls: [], final: "no isolation" }) }];
    const manager = new SubagentManager(stub);
    const session = makeSession("iso-b");

    const result = await manager.run({
      definitionId: "coder",
      prompt: "Rien",
      session,
    });

    const listAfter = execFileSync("git", ["worktree", "list"], { cwd: repo, encoding: "utf8" });
    expect(result.success).toBe(true);
    expect(result.worktreePath).toBeUndefined();
    expect(listAfter).toBe(listBefore);
  });

  it("outil task : paramètre isolate transmis, metadata worktree exposée", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [{ tool: "write_file", parameters: { path: "via-task.txt", content: "ok" } }],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "task done" }) },
    ];
    registerTaskTool(stub);
    const executor = new ToolExecutor(toolRegistry);
    const session = makeSession("iso-task");

    const r = await executor.execute(
      "task",
      { subagent: "coder", prompt: "Écris via-task.txt", isolate: true },
      new LocalExecutionProvider(repo),
      session,
      "build"
    );

    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("task done");
    expect(String(r.output)).toContain("[worktree]");
    expect(r.metadata).toMatchObject({ subagent: "coder" });
    expect(r.metadata!.worktreePath).toBeTruthy();
    const wtPath = String(r.metadata!.worktreePath);
    expect(fs.existsSync(path.join(wtPath, "via-task.txt"))).toBe(true);
    expect(fs.existsSync(path.join(repo, "via-task.txt"))).toBe(false);
  });

  it("dépôt git absent + isolate → dégradation honnête (note d'isolation, run continue)", async () => {
    const nonGit = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-wt-nongit-"));
    try {
      const stub = new StubLlm();
      stub.queue = [{ text: JSON.stringify({ toolCalls: [], final: "ok anyway" }) }];
      const manager = new SubagentManager(stub);
      const session = sessionStore.getOrCreate("iso-nongit");
      session.agent_running = true;
      session.providerId = "local";
      session.environment = "local";
      session.cwd = nonGit;
      session.model = "gemini-3.8-flash";
      sessionStore.save(session);
      workspaceManager.getOrCreateWorkspace("iso-nongit", { providerId: "local", workspacePath: nonGit });
      process.chdir(nonGit);

      const result = await manager.run({
        definitionId: "coder",
        prompt: "Test",
        session,
        isolate: true,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe("ok anyway");
      expect(result.worktreePath).toBeUndefined();
    } finally {
      process.chdir(repo);
      fs.rmSync(nonGit, { recursive: true, force: true });
    }
  });
});
