import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawn, type ChildProcess } from "node:child_process";

export interface TerminalInstance {
  id: string;
  title: string;
  shell: string;
  cwd: string;
  buffer: string;
  history: string[];
  gitBranch: string;
  gitStatus: string;
  exitCode?: number;
  detectedPort?: number;
  /** Set when this terminal is attached to a remote machine (e.g. "codespace:<name>"). */
  remote?: string;
  activeProcess?: {
    pid: number;
    command: string;
    child: ChildProcess;
  };
}

export interface SessionTerminalState {
  sessionId: string;
  activeTerminalId: string;
  terminals: Map<string, TerminalInstance>;
}

class PtyManager {
  private sessions = new Map<string, SessionTerminalState>();
  private baseWorkspaceDir = path.join(os.tmpdir(), "soryos-workspaces");

  constructor() {
    if (!fs.existsSync(this.baseWorkspaceDir)) {
      try {
        fs.mkdirSync(this.baseWorkspaceDir, { recursive: true });
      } catch (err) {
        console.warn("[PtyManager] Could not create base workspace dir:", err);
      }
    }
  }

  ensureWorkspaceDir(sessionId: string): string {
    const dir = path.join(this.baseWorkspaceDir, sessionId || "default");
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn(`[PtyManager] Error creating workspace dir for ${sessionId}:`, err);
      }
    }
    return dir;
  }

  getOrCreateSessionState(sessionId: string): SessionTerminalState {
    let state = this.sessions.get(sessionId);
    if (!state) {
      const defaultDir = this.ensureWorkspaceDir(sessionId);
      const defaultTerm: TerminalInstance = {
        id: `term-1`,
        title: "bash",
        shell: "/bin/bash",
        cwd: defaultDir,
        buffer: `\x1b[1;36mOpenCode / SoryOS Terminal\x1b[0m\r\nWorkspace: ${defaultDir}\r\n\r\n`,
        history: [],
        gitBranch: "main",
        gitStatus: "clean",
      };

      state = {
        sessionId,
        activeTerminalId: defaultTerm.id,
        terminals: new Map([[defaultTerm.id, defaultTerm]]),
      };
      this.sessions.set(sessionId, state);
    }
    return state;
  }

  createTerminal(sessionId: string, shell: string = "/bin/bash"): TerminalInstance {
    const state = this.getOrCreateSessionState(sessionId);
    const count = state.terminals.size + 1;
    const termDir = this.ensureWorkspaceDir(sessionId);

    const term: TerminalInstance = {
      id: `term-${count}`,
      title: `term-${count}`,
      shell,
      cwd: termDir,
      buffer: `\x1b[1;36mTerminal ${count} ready\x1b[0m\r\nWorkspace: ${termDir}\r\n\r\n`,
      history: [],
      gitBranch: "main",
      gitStatus: "clean",
    };

    state.terminals.set(term.id, term);
    state.activeTerminalId = term.id;
    return term;
  }

  closeTerminal(sessionId: string, terminalId: string): boolean {
    const state = this.sessions.get(sessionId);
    if (!state) return false;

    const term = state.terminals.get(terminalId);
    if (term?.activeProcess) {
      try {
        term.activeProcess.child.kill("SIGTERM");
      } catch {
        // ignore
      }
    }

    state.terminals.delete(terminalId);

    if (state.activeTerminalId === terminalId) {
      const remaining = Array.from(state.terminals.keys());
      if (remaining.length > 0) {
        state.activeTerminalId = remaining[0];
      } else {
        const fresh = this.createTerminal(sessionId);
        state.activeTerminalId = fresh.id;
      }
    }

    return true;
  }

  clearTerminal(sessionId: string, terminalId: string): void {
    const state = this.sessions.get(sessionId);
    const term = state?.terminals.get(terminalId);
    if (term) {
      term.buffer = "";
    }
  }

  sendSignal(sessionId: string, terminalId: string, signal: string = "SIGINT"): boolean {
    const state = this.sessions.get(sessionId);
    const term = state?.terminals.get(terminalId);
    if (term?.activeProcess) {
      try {
        term.activeProcess.child.kill(signal as NodeJS.Signals);
        term.buffer += `\r\n^C\r\n`;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async executeCommand(options: {
    sessionId: string;
    terminalId: string;
    command: string;
  }): Promise<{
    output: string;
    isError: boolean;
    cwd: string;
    exitCode: number;
    gitBranch: string;
    gitStatus: string;
    detectedPort?: number;
  }> {
    const { sessionId, terminalId, command } = options;
    const state = this.getOrCreateSessionState(sessionId);
    const term = state.terminals.get(terminalId) || state.terminals.get(state.activeTerminalId)!;

    const rawCmd = command.trim();
    term.history.push(rawCmd);
    term.buffer += `$ ${rawCmd}\r\n`;

    // Handle cd command
    if (rawCmd.startsWith("cd ")) {
      const target = rawCmd.slice(3).trim();
      const nextDir = target === "~" ? this.baseWorkspaceDir : path.resolve(term.cwd, target);
      if (fs.existsSync(nextDir)) {
        term.cwd = nextDir;
        term.buffer += `\x1b[32m${nextDir}\x1b[0m\r\n`;
        return {
          output: nextDir,
          isError: false,
          cwd: term.cwd,
          exitCode: 0,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
        };
      } else {
        const err = `cd: no such file or directory: ${target}`;
        term.buffer += `\x1b[31m${err}\x1b[0m\r\n`;
        return {
          output: err,
          isError: true,
          cwd: term.cwd,
          exitCode: 1,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
        };
      }
    }

    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let detectedPort: number | undefined;

      const shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";
      const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", rawCmd] : ["-c", rawCmd];

      const child = spawn(shell, shellArgs, {
        cwd: term.cwd,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          FORCE_COLOR: "1",
        },
      });

      if (child.pid) {
        term.activeProcess = {
          pid: child.pid,
          command: rawCmd,
          child,
        };
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        stdout += text;
        term.buffer += text.replace(/\n/g, "\r\n");

        // Port detection logic (e.g. localhost:3000, port 5173, etc.)
        const portMatch = text.match(/(?:localhost|127\.0\.0\.1|port)\s*[:=]\s*(\d{4,5})/i);
        if (portMatch) {
          detectedPort = parseInt(portMatch[1], 10);
          term.detectedPort = detectedPort;
        }
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf-8");
        stderr += text;
        term.buffer += `\x1b[33m${text.replace(/\n/g, "\r\n")}\x1b[0m`;
      });

      child.on("close", (code: number | null) => {
        term.activeProcess = undefined;
        term.exitCode = code ?? 0;
        const isError = (code ?? 0) !== 0;

        const combinedOutput = (stdout + (stderr ? "\n" + stderr : "")).trim();
        resolve({
          output: combinedOutput,
          isError,
          cwd: term.cwd,
          exitCode: code ?? 0,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
          detectedPort,
        });
      });

      child.on("error", (err: Error) => {
        term.activeProcess = undefined;
        term.exitCode = 1;
        const errMsg = `Spawn error: ${err.message}`;
        term.buffer += `\x1b[31m${errMsg}\x1b[0m\r\n`;
        resolve({
          output: errMsg,
          isError: true,
          cwd: term.cwd,
          exitCode: 1,
          gitBranch: term.gitBranch,
          gitStatus: term.gitStatus,
        });
      });
    });
  }
}

export const ptyManager = new PtyManager();
export async function initializeTerminal(sessionId: string) {
  return ptyManager.getOrCreateSessionState(sessionId);
}
