import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry, WorktreeTools } from "@soryos/tool";
import type { SessionData } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";

let repo: string;
let notRepo: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function makeSession(id: string, cwd: string): SessionData {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = cwd;
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: cwd });
  return sessionStore.get(id)!;
}

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-wt-repo-"));
  git(repo, "init", "-b", "main");
  git(repo, "config", "user.email", "test@soryos.local");
  git(repo, "config", "user.name", "SoryOS Test");
  fs.writeFileSync(path.join(repo, "seed.txt"), "seed content");
  git(repo, "add", ".");
  git(repo, "commit", "-m", "init");

  notRepo = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-wt-norepo-"));
  provider = new LocalExecutionProvider(repo);
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
  fs.rmSync(notRepo, { recursive: true, force: true });
});

describe("WorktreeTools — opérations git réelles", () => {
  it("createWorktree crée un dossier + branche réels, vérifiés sur disque", async () => {
    const tools = new WorktreeTools(provider);
    const r = await tools.createWorktree({ name: "wt-alpha" });

    expect(r.success).toBe(true);
    const wtPath = String(r.metadata!.path);
    const branch = String(r.metadata!.branch);
    expect(fs.existsSync(wtPath)).toBe(true);
    expect(fs.existsSync(path.join(wtPath, ".git"))).toBe(true);
    expect(fs.readFileSync(path.join(wtPath, "seed.txt"), "utf8")).toBe("seed content");
    expect(branch).toBe("soryos/wt-alpha");
    expect(git(repo, "branch", "--list", "soryos/wt-alpha")).toContain("soryos/wt-alpha");
    expect(r.verified).toBe(true);
  });

  it("listWorktrees inclut le dépôt principal et le worktree", async () => {
    const tools = new WorktreeTools(provider);
    await tools.createWorktree({ name: "wt-beta" });
    const r = await tools.listWorktrees();

    expect(r.success).toBe(true);
    const worktrees = r.metadata!.worktrees as Array<{ path: string; branch?: string }>;
    expect(worktrees.length).toBeGreaterThanOrEqual(2);
    expect(worktrees.some((w) => w.path === repo)).toBe(true);
    expect(worktrees.some((w) => w.branch === "soryos/wt-beta")).toBe(true);
  });

  it("removeWorktree supprime le dossier réel", async () => {
    const tools = new WorktreeTools(provider);
    const created = await tools.createWorktree({ name: "wt-gamma" });
    const wtPath = String(created.metadata!.path);
    expect(fs.existsSync(wtPath)).toBe(true);

    const removed = await tools.removeWorktree(wtPath);

    expect(removed.success).toBe(true);
    expect(fs.existsSync(wtPath)).toBe(false);
    expect(git(repo, "worktree", "list")).not.toContain("wt-gamma");
  });

  it("hors dépôt git → erreur honnête", async () => {
    const bare = new LocalExecutionProvider(notRepo);
    const tools = new WorktreeTools(bare);
    const r = await tools.createWorktree({ name: "wt-nope" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Not a git repository");
  });

  it("sanitizeName neutralise la path traversal", () => {
    const tools = new WorktreeTools(provider);
    expect(tools.sanitizeName("../../evil")).not.toContain("..");
    expect(tools.sanitizeName("a/b\\c")).not.toContain("/");
    expect(tools.sanitizeName("a/b\\c")).not.toContain("\\");
    expect(tools.sanitizeName("")).toMatch(/^worktree-\d+$/);
  });
});

describe("git_worktree_* via ToolExecutor", () => {
  it("create/list/remove de bout en bout (build)", async () => {
    const session = makeSession("wt-exec", repo);

    const created = await executor.execute(
      "git_worktree_create",
      { name: "via-exec" },
      provider,
      session,
      "build"
    );
    expect(created.isError).toBe(false);
    const wtPath = String(created.metadata!.path);
    expect(fs.existsSync(wtPath)).toBe(true);

    const listed = await executor.execute("git_worktree_list", {}, provider, session, "build");
    expect(listed.isError).toBe(false);
    expect(String(listed.output)).toContain("via-exec");

    const removed = await executor.execute(
      "git_worktree_remove",
      { path: wtPath },
      provider,
      session,
      "build"
    );
    expect(removed.isError).toBe(false);
    expect(fs.existsSync(wtPath)).toBe(false);
  });

  it("mode plan → PERMISSION DENIED", async () => {
    const session = makeSession("wt-plan", repo);
    const r = await executor.execute("git_worktree_create", { name: "x" }, provider, session, "plan");
    expect(r.isError).toBe(true);
    expect(r.output).toContain("PERMISSION DENIED");
  });

  it("remove sans path → paramètre requis honnête", async () => {
    const session = makeSession("wt-req", repo);
    const r = await executor.execute("git_worktree_remove", {}, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(r.output).toContain('Missing required parameter "path"');
  });

  it("les trois outils sont enregistrés au registre (35 built-ins)", () => {
    expect(toolRegistry.has("git_worktree_create")).toBe(true);
    expect(toolRegistry.has("git_worktree_list")).toBe(true);
    expect(toolRegistry.has("git_worktree_remove")).toBe(true);
    expect(toolRegistry.getToolDefinitions().length).toBe(35);
  });
});
