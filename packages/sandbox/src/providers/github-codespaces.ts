
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
import { createGitHubClient } from "@soryos/github";
import { execInCodespace } from "../codespace-exec";

export class GitHubCodespacesProvider implements SandboxProvider {
  readonly id: ProviderId = "github-codespaces";
  readonly name = "GitHub Codespaces";
  readonly type: ProviderType = "cloud development environment";

  readonly capabilities: ProviderCapabilities = {
    terminal: true,
    filesystem: true,
    processes: true,
    interactiveProcess: false, // execInCodespace is not interactive yet
    persistentWorkspace: true,
    snapshots: false,
    pauseResume: true,
    longRunningJobs: true,
    artifacts: true,
    network: true,
    git: true,
    preview: true,
  };

  private sessionId: string = "session";
  private codespaceName: string | null = null;
  private owner: string | null = null;
  private repo: string | null = null;
  private token: string | null = null;
  private status: "ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured" = "not_configured";
  private cwd: string = "/workspace";

  private getToken(): string {
    const token = this.token || process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "GitHub token introuvable pour Codespaces (options.token ou variable d'environnement GITHUB_TOKEN)"
      );
    }
    return token;
  }

  private getGitHubClient() {
    return createGitHubClient(this.getToken(), this.owner || "");
  }

  async create(options?: {
    sessionId?: string;
    workspacePath?: string;
    token?: string;
    owner?: string;
    repo?: string;
    branch?: string;
    codespaceName?: string;
  }): Promise<string> {
    this.sessionId = options?.sessionId ?? this.sessionId;
    if (options?.token) this.token = options.token;
    if (options?.owner) this.owner = options.owner;
    if (options?.repo) this.repo = options.repo;

    // Preferred path: connect to an already-created Codespace (created by the
    // web layer via /api/github?action=create_codespace).
    if (options?.codespaceName) {
      this.codespaceName = options.codespaceName;
      if (this.repo) this.cwd = `/workspaces/${this.repo}`;
      const state = await this.getStatus();
      if (state === "error") {
        this.status = "error";
        throw new Error(`Codespace « ${options.codespaceName} » inaccessible via l'API GitHub`);
      }
      if (state === "paused") {
        const client = this.getGitHubClient();
        const started = await client.startCodespace(options.codespaceName);
        if (!started.success) {
          throw new Error(`Impossible de démarrer le Codespace : ${started.error}`);
        }
        this.status = "busy";
      }
      return this.codespaceName;
    }

    // Fallback: create a brand-new Codespace (needs owner/repo/token).
    if (!this.owner || !this.repo) {
      throw new Error("owner et repo requis pour créer un nouveau Codespace");
    }
    const client = this.getGitHubClient();
    const result = await client.createCodespace(this.owner, this.repo, {
      branch: options?.branch || "main",
    });

    if (!result.success || !result.data) {
      this.status = "error";
      throw new Error(`Failed to create Codespace: ${result.error}`);
    }

    this.codespaceName = result.data.name;
    this.status = "ready";
    this.cwd = `/workspaces/${this.repo}`;

    return this.codespaceName;
  }

  async connect(
    sandboxId: string,
    options?: { sessionId?: string; owner?: string; repo?: string; token?: string }
  ): Promise<boolean> {
    this.sessionId = options?.sessionId ?? this.sessionId;
    this.codespaceName = sandboxId;
    this.owner = options?.owner ?? this.owner;
    this.repo = options?.repo ?? this.repo;
    if (options?.token) this.token = options.token;
    this.cwd = `/workspaces/${this.repo}`;

    await this.getStatus();
    return this.status === "ready" || this.status === "paused";
  }

  async disconnect(): Promise<void> {
    this.status = "disconnected";
  }

  async start(): Promise<void> {
    if (!this.codespaceName) throw new Error("No Codespace selected");
    const client = this.getGitHubClient();
    await client.startCodespace(this.codespaceName);
    this.status = "ready";
  }

  async stop(): Promise<void> {
    if (!this.codespaceName) throw new Error("No Codespace selected");
    const client = this.getGitHubClient();
    await client.stopCodespace(this.codespaceName);
    this.status = "paused";
  }

  async pause(): Promise<void> {
    await this.stop();
  }

  async resume(): Promise<void> {
    await this.start();
  }

  async destroy(): Promise<void> {
    // Deleting a codespace is a destructive action, typically done by the user.
    this.status = "disconnected";
  }

  async getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured"> {
    if (!this.codespaceName) {
      this.status = "not_configured";
      return this.status;
    }
    try {
        const client = this.getGitHubClient();
        const result = await client.getCodespace(this.codespaceName);

        if (!result.success || !result.data) {
            this.status = "error";
            return this.status;
        }

        switch (result.data.state) {
            case 'Available':
                this.status = "ready";
                break;
            case 'Shutdown':
                this.status = "paused";
                break;
            case 'Starting':
            case 'Provisioning':
            case 'Updating':
            case 'Rebuilding':
                this.status = "busy";
                break;
            default:
                this.status = "error";
                break;
        }
        return this.status;
    } catch (e) {
        this.status = "error";
        return this.status;
    }
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
      try {
        const token = this.getToken();
        const info = {
            os: "Linux (GitHub Codespaces Dev Container)",
            arch: "x86_64",
            nodeVersion: "v20.18.0", // This should be dynamic
            pythonVersion: "Python 3.11.8", // This should be dynamic
            cwd: this.cwd,
            configured: true,
            configMessage: "GitHub OAuth token active. Machine Codespace connected.",
        };

        if (this.codespaceName) {
            const res = await this.executeCommand("node -v && python --version");
            const [node, python] = res.stdout.split('\n');
            info.nodeVersion = node;
            info.pythonVersion = python;
        }

        return info;
      } catch (e) {
          return {
            os: "Linux (GitHub Codespaces Dev Container)",
            arch: "x86_64",
            nodeVersion: "N/A",
            pythonVersion: "N/A",
            cwd: this.cwd,
            configured: false,
            configMessage: "Veuillez connecter votre compte GitHub pour activer Codespaces.",
          }
      }
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    if (!this.codespaceName) {
      const msg = "Aucun Codespace sélectionné : choisissez un Codespace pour exécuter des commandes.";
      return { exitCode: 1, stdout: "", stderr: msg, output: msg, isError: true, durationMs: 0 };
    }
    
    const res = await execInCodespace({
      codespaceName: this.codespaceName,
      command,
      cwd: this.repo ? `/workspaces/${this.repo}` : undefined,
    });
    
    return {
      exitCode: res.exitCode,
      stdout: res.stdout,
      stderr: res.stderr,
      output: res.stdout || res.stderr,
      isError: res.exitCode !== 0,
      durationMs: 0, // Not provided by this implementation
    };
  }

  async readFile(filePath: string): Promise<string> {
    const res = await this.executeCommand(`cat ${filePath}`);
    if(res.isError) throw new Error(res.stderr);
    return res.stdout;
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const b64 = Buffer.from(content).toString('base64');
    const res = await this.executeCommand(`echo '${b64}' | base64 -d > ${filePath}`);
    if(res.isError) throw new Error(res.stderr);
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new Error(`Target content not found in ${filePath}`);
    }
    await this.writeFile(filePath, current.replace(targetContent, replacementContent));
  }

  async deleteFile(filePath: string): Promise<void> {
    const res = await this.executeCommand(`rm ${filePath}`);
    if(res.isError) throw new Error(res.stderr);
  }

  async listFiles(directoryPath?: string): Promise<FileEntry[]> {
    const path = directoryPath || '.';
    const res = await this.executeCommand(`ls -la --full-time ${path}`);
    if(res.isError) throw new Error(res.stderr);

    return res.stdout
        .split('\n')
        .slice(1) // remove total
        .map(line => {
            const parts = line.split(/\s+/);
            if(parts.length < 9) return null;
            const [permissions, , owner, group, size, month, day, time, ...nameParts] = parts;
            const name = nameParts.join(' ');
            const isDirectory = permissions.startsWith('d');
            return {
                path: `${path}/${name}`,
                name,
                isDirectory,
                sizeBytes: parseInt(size),
                updatedAt: new Date(`${month} ${day} ${time}`).toISOString(),
            };
        })
        .filter(e => e !== null && e.name !== '.' && e.name !== '..') as FileEntry[];
  }

  async createDirectory(dirPath: string): Promise<void> {
    const res = await this.executeCommand(`mkdir -p ${dirPath}`);
    if(res.isError) throw new Error(res.stderr);
  }

  async startProcess(command: string): Promise<ProcessHandle> {
      throw new Error("Interactive processes not supported yet in Codespaces provider");
  }

  async stopProcess(processId: string): Promise<void> {
    throw new Error("Interactive processes not supported yet in Codespaces provider");
  }

  async getProcessStatus(processId: string): Promise<ProcessHandle | null> {
    return null;
  }
}
