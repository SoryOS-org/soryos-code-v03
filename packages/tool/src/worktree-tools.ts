/**
 * Git worktree operations for isolated parallel work.
 * Real `git worktree add/list/remove` through the ExecutionProvider shell —
 * never faked. Worktrees live under `<repoRoot>/.soryos-worktrees/<name>`
 * on dedicated branches so parallel agents never fight over the same files.
 */
import { ExecutionProvider } from "@soryos/execution";
import { ShellTools } from "./shell-tools";
import { globalEventBus } from "@soryos/bus";

export interface WorktreeResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
  verified?: boolean;
}

export interface WorktreeInfo {
  path: string;
  branch?: string;
  head?: string;
  bare?: boolean;
  detached?: boolean;
}

const SAFE_NAME = /[^a-zA-Z0-9._-]/g;
const MAX_NAME_LENGTH = 64;

export class WorktreeTools {
  private shellTools: ShellTools;

  constructor(private provider: ExecutionProvider) {
    this.shellTools = new ShellTools(provider);
  }

  /** Sanitizes a caller-provided name: no path traversal, no separators. */
  sanitizeName(name: string): string {
    const cleaned = name.replace(SAFE_NAME, "-").replace(/^[-.]+/, "").slice(0, MAX_NAME_LENGTH);
    return cleaned || `worktree-${Date.now()}`;
  }

  private async repoRoot(): Promise<{ root: string } | { error: string }> {
    const r = await this.shellTools.shellCommand("git rev-parse --show-toplevel", { timeoutMs: 10_000 });
    if (r.exitCode !== 0 || !r.stdout?.trim()) {
      return { error: `Not a git repository (git rev-parse failed): ${(r.stderr || r.error || "unknown error").trim()}` };
    }
    return { root: r.stdout.trim() };
  }

  async createWorktree(options: { name?: string; branch?: string; path?: string } = {}): Promise<WorktreeResult> {
    const root = await this.repoRoot();
    if ("error" in root) return { success: false, error: root.error };

    const name = this.sanitizeName(options.name ?? `worktree-${Date.now()}`);
    const worktreePath = options.path
      ? options.path // absolute or provider-relative; git resolves it
      : `${root.root}/.soryos-worktrees/${name}`;
    // Branch names legitimately contain "/", but never ".." or other separators.
    const branch = (options.branch ?? `soryos/${name}`)
      .replace(/[^a-zA-Z0-9._/-]/g, "-")
      .replace(/\.\./g, "-");

    const add = await this.shellTools.shellCommand(
      `git worktree add ${JSON.stringify(worktreePath)} -b ${JSON.stringify(branch)}`,
      { timeoutMs: 30_000 }
    );
    if (add.exitCode !== 0) {
      return {
        success: false,
        error: `git worktree add failed: ${(add.stderr || add.error || add.stdout || "unknown error").trim()}`,
        metadata: { path: worktreePath, branch },
      };
    }

    // Physical verification: the worktree directory must exist and contain a .git link.
    const check = await this.shellTools.shellCommand(
      `test -d ${JSON.stringify(worktreePath)} && test -e ${JSON.stringify(worktreePath + "/.git")}`,
      { timeoutMs: 5_000 }
    );
    if (check.exitCode !== 0) {
      return {
        success: false,
        error: `git worktree add reported success but ${worktreePath} was not verified on disk.`,
        metadata: { path: worktreePath, branch },
      };
    }

    globalEventBus.emit("file.changed", { path: worktreePath, action: "worktree.created" });
    return {
      success: true,
      output: `Worktree created at ${worktreePath} on branch "${branch}".`,
      metadata: { path: worktreePath, branch },
      verified: true,
    };
  }

  async listWorktrees(): Promise<WorktreeResult> {
    const r = await this.shellTools.shellCommand("git worktree list --porcelain", { timeoutMs: 10_000 });
    if (r.exitCode !== 0) {
      return { success: false, error: `git worktree list failed: ${(r.stderr || r.error || "unknown error").trim()}` };
    }
    const worktrees: WorktreeInfo[] = [];
    let current: WorktreeInfo | null = null;
    for (const line of (r.stdout ?? "").split("\n")) {
      if (line.startsWith("worktree ")) {
        if (current) worktrees.push(current);
        current = { path: line.slice("worktree ".length).trim() };
      } else if (current && line.startsWith("branch ")) {
        current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
      } else if (current && line.startsWith("HEAD ")) {
        current.head = line.slice("HEAD ".length).trim();
      } else if (current && line === "bare") {
        current.bare = true;
      } else if (current && line === "detached") {
        current.detached = true;
      }
    }
    if (current) worktrees.push(current);
    return {
      success: true,
      output: worktrees.map((w) => `${w.path}${w.branch ? ` (${w.branch})` : ""}`).join("\n"),
      metadata: { worktrees },
    };
  }

  async removeWorktree(path: string, force: boolean = false): Promise<WorktreeResult> {
    if (!path?.trim()) {
      return { success: false, error: "Worktree path is required." };
    }
    const r = await this.shellTools.shellCommand(
      `git worktree remove ${force ? "--force " : ""}${JSON.stringify(path)}`,
      { timeoutMs: 30_000 }
    );
    if (r.exitCode !== 0) {
      return {
        success: false,
        error: `git worktree remove failed: ${(r.stderr || r.error || r.stdout || "unknown error").trim()}` +
          (force ? "" : " (retry with force=true to discard uncommitted changes)"),
        metadata: { path },
      };
    }
    globalEventBus.emit("file.changed", { path, action: "worktree.removed" });
    return { success: true, output: `Worktree removed: ${path}`, metadata: { path }, verified: true };
  }
}
