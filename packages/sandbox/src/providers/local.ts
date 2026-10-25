import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";
import { SandboxProvider } from "../provider";
import {
  ProviderId,
  ProviderType,
  ProviderCapabilities,
  EnvironmentInfo,
  CommandOptions,
  CommandResult,
  ProcessHandle,
  FileEntry,
} from "../types";
import { sessionStore } from "@soryos/session";

export class LocalProvider implements SandboxProvider {
  readonly id: ProviderId = "local";
  readonly name = "Local Machine";
  readonly type: ProviderType = "local machine";

  readonly capabilities: ProviderCapabilities = {
    terminal: true,
    filesystem: true,
    processes: true,
    interactiveProcess: true,
    persistentWorkspace: true,
    snapshots: false,
    pauseResume: false,
    longRunningJobs: true,
    artifacts: true,
    network: true,
    git: true,
    preview: true,
  };

  private sandboxId: string | null = null;
  private sessionId: string | null = null;
  private status: "ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured" = "ready";
  private baseDir: string = path.join(os.tmpdir(), "soryos-workspaces");
  private cwd: string = path.join(os.tmpdir(), "soryos-workspaces", "default");
  private activeProcesses = new Map<string, { handle: ProcessHandle; child: ChildProcess }>();

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true });
      } catch (err) {
        console.warn("[LocalProvider] Could not create baseDir:", err);
      }
    }
  }

  getWorkspaceDir(): string {
    return this.cwd;
  }

  private resolvePath(relativePath: string, customCwd?: string): string {
    const root = customCwd ? path.resolve(this.cwd, customCwd) : this.cwd;
    if (path.isAbsolute(relativePath)) {
      // Prevent path traversal outside root
      if (relativePath.startsWith(root)) {
        return relativePath;
      }
      return path.join(root, relativePath.replace(/^[/\\]+/, ""));
    }
    return path.resolve(root, relativePath);
  }

  async create(options?: { sessionId?: string; workspacePath?: string }): Promise<string> {
    this.sessionId = options?.sessionId || `local-${Date.now()}`;
    this.sandboxId = `local-${this.sessionId}`;

    if (options?.workspacePath) {
      this.cwd = path.resolve(options.workspacePath);
    } else {
      this.cwd = path.join(this.baseDir, this.sessionId);
    }

    try {
      await fsp.mkdir(this.cwd, { recursive: true });
    } catch (err) {
      console.warn("[LocalProvider] Error creating session workspace dir:", err);
    }

    // Seed disk workspace with files from session if they exist
    if (options?.sessionId) {
      try {
        const session = sessionStore.getOrCreate(options.sessionId);
        if (session && session.files && Object.keys(session.files).length > 0) {
          for (const [relPath, content] of Object.entries(session.files)) {
            const targetPath = this.resolvePath(relPath);
            await fsp.mkdir(path.dirname(targetPath), { recursive: true });
            await fsp.writeFile(targetPath, content, "utf-8");
          }
        }
      } catch (err) {
        console.warn("[LocalProvider] Error seeding workspace files:", err);
      }
    }

    this.status = "ready";
    return this.sandboxId;
  }

  async connect(sandboxId: string): Promise<boolean> {
    this.sandboxId = sandboxId;
    this.status = "ready";
    return true;
  }

  async disconnect(): Promise<void> {
    this.status = "disconnected";
  }

  async start(): Promise<void> {
    this.status = "ready";
  }

  async stop(): Promise<void> {
    this.status = "disconnected";
    for (const [procId, { child }] of this.activeProcesses.entries()) {
      try {
        child.kill("SIGTERM");
      } catch {
        // ignore
      }
      this.activeProcesses.delete(procId);
    }
  }

  async pause(): Promise<void> {
    // Local pause not supported
  }

  async resume(): Promise<void> {
    this.status = "ready";
  }

  async destroy(): Promise<void> {
    await this.stop();
    try {
      if (this.cwd.startsWith(this.baseDir) && this.cwd !== this.baseDir) {
        await fsp.rm(this.cwd, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  }

  async getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured"> {
    return this.status;
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return {
      os: `${process.platform} (${os.release()})`,
      arch: process.arch,
      nodeVersion: process.version,
      pythonVersion: "Python 3",
      gccVersion: "GCC available",
      rustVersion: "Rust available",
      cwd: this.cwd,
      configured: true,
      configMessage: `Physical execution directory: ${this.cwd}`,
    };
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const startTime = Date.now();
    const rawCmd = command.trim();
    const workingDir = options?.cwd ? this.resolvePath(options.cwd) : this.cwd;
    const timeoutMs = options?.timeoutMs || 60_000;

    // Ensure working directory exists physically
    try {
      await fsp.mkdir(workingDir, { recursive: true });
    } catch {
      // ignore
    }

    // Special case: cd command
    if (rawCmd.startsWith("cd ")) {
      const targetDir = rawCmd.slice(3).trim();
      const nextDir = targetDir === "~" ? this.baseDir : path.resolve(workingDir, targetDir);
      if (fs.existsSync(nextDir)) {
        this.cwd = nextDir;
        return {
          exitCode: 0,
          stdout: `Changed directory to ${nextDir}`,
          stderr: "",
          output: `Changed directory to ${nextDir}`,
          isError: false,
          durationMs: Date.now() - startTime,
        };
      } else {
        return {
          exitCode: 1,
          stdout: "",
          stderr: `cd: no such file or directory: ${targetDir}`,
          output: `cd: no such file or directory: ${targetDir}`,
          isError: true,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return new Promise<CommandResult>((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", rawCmd] : ["-c", rawCmd];

      const child = spawn(shell, shellArgs, {
        cwd: workingDir,
        env: {
          ...process.env,
          ...(options?.env || {}),
          TERM: "xterm-256color",
          FORCE_COLOR: "0",
        },
      });

      const finish = (exitCode: number, errorMsg?: string) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);

        const durationMs = Date.now() - startTime;
        if (errorMsg) {
          stderr += (stderr ? "\n" : "") + errorMsg;
        }
        const fullOutput = (stdout + (stderr ? (stdout ? "\n" : "") + stderr : "")).trim();

        resolve({
          exitCode,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          output: fullOutput || (exitCode === 0 ? "(Command succeeded with no output)" : "(Command failed)"),
          isError: exitCode !== 0,
          durationMs,
        });
      };

      timer = setTimeout(() => {
        try {
          child.kill("SIGTERM");
          setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch {
              // ignore
            }
          }, 2000);
        } catch {
          // ignore
        }
        finish(124, `Command timed out after ${timeoutMs}ms`);
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      child.on("error", (err: Error) => {
        finish(1, `Process spawn error: ${err.message}`);
      });

      child.on("close", (code: number | null) => {
        finish(code ?? 0);
      });
    });
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath);
    try {
      return await fsp.readFile(fullPath, "utf-8");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read file ${filePath}: ${msg}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fsp.mkdir(path.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content, "utf-8");

    // Also update in-memory session store so web preview and UI update immediately
    if (this.sessionId) {
      try {
        const session = sessionStore.get(this.sessionId);
        if (session) {
          const rel = path.relative(this.cwd, fullPath);
          session.files[rel] = content;
        }
      } catch {
        // ignore
      }
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    const current = await this.readFile(filePath);

    if (!current.includes(targetContent)) {
      throw new Error(
        `Target content not found in ${filePath}. Verify exact characters and whitespace before editing.`
      );
    }

    const updated = current.replace(targetContent, replacementContent);
    await this.writeFile(filePath, updated);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fsp.unlink(fullPath);
    } catch (err) {
      console.warn(`[LocalProvider] Could not delete ${fullPath}:`, err);
    }

    if (this.sessionId) {
      try {
        const session = sessionStore.get(this.sessionId);
        if (session) {
          const rel = path.relative(this.cwd, fullPath);
          delete session.files[rel];
        }
      } catch {
        // ignore
      }
    }
  }

  async listFiles(directoryPath?: string): Promise<FileEntry[]> {
    const targetDir = directoryPath ? this.resolvePath(directoryPath) : this.cwd;
    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const results: FileEntry[] = [];

    const walk = async (currentDir: string) => {
      let entries: fs.Dirent[] = [];
      try {
        entries = await fsp.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") {
          continue;
        }
        const full = path.join(currentDir, entry.name);
        const rel = path.relative(this.cwd, full);
        if (entry.isDirectory()) {
          results.push({
            path: rel,
            name: entry.name,
            isDirectory: true,
            sizeBytes: 0,
            updatedAt: new Date().toISOString(),
          });
          await walk(full);
        } else if (entry.isFile()) {
          let size = 0;
          let mtime = new Date().toISOString();
          try {
            const stat = await fsp.stat(full);
            size = stat.size;
            mtime = stat.mtime.toISOString();
          } catch {
            // ignore
          }
          results.push({
            path: rel,
            name: entry.name,
            isDirectory: false,
            sizeBytes: size,
            updatedAt: mtime,
          });
        }
      }
    };

    await walk(targetDir);
    return results;
  }

  async createDirectory(directoryPath: string): Promise<void> {
    const full = this.resolvePath(directoryPath);
    await fsp.mkdir(full, { recursive: true });
  }

  async startProcess(command: string, options?: CommandOptions): Promise<ProcessHandle> {
    const procId = `proc-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const workingDir = options?.cwd ? this.resolvePath(options.cwd) : this.cwd;

    const child = spawn("/bin/bash", ["-c", command], {
      cwd: workingDir,
      env: {
        ...process.env,
        ...(options?.env || {}),
      },
      detached: true,
      stdio: "pipe",
    });

    const handle: ProcessHandle = {
      processId: procId,
      command,
      status: "running",
      pid: child.pid,
    };

    this.activeProcesses.set(procId, { handle, child });

    child.on("exit", () => {
      handle.status = "stopped";
    });

    return handle;
  }

  async stopProcess(processId: string): Promise<void> {
    const entry = this.activeProcesses.get(processId);
    if (entry) {
      try {
        entry.child.kill("SIGTERM");
      } catch {
        // ignore
      }
      entry.handle.status = "stopped";
      this.activeProcesses.delete(processId);
    }
  }

  async getProcessStatus(processId: string): Promise<ProcessHandle | null> {
    const entry = this.activeProcesses.get(processId);
    return entry ? entry.handle : null;
  }
}
