/**
 * @soryos/sandbox
 * E2B Cloud Sandbox Provider - REAL IMPLEMENTATION
 * 
 * Based on Vibra Code's E2BManager with full E2B SDK integration.
 * No more simulation - this connects to real E2B sandboxes.
 */

import { Sandbox } from '@e2b/code-interpreter';
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
import crypto from 'crypto';

/**
 * Configuration options for E2B sandbox creation
 */
export interface E2BSandboxConfig {
  templateId?: string;
  apiKey?: string;
  envVars?: Record<string, string>;
  timeout?: number;
  workingDirectory?: string;
}

/**
 * GitHub configuration for push operations
 */
export interface GitHubConfig {
  token: string;
  repository: string;
}

/**
 * Real E2B Provider implementation
 * 
 * Features:
 * - Real sandbox creation via E2B SDK
 * - Session token management for real-time sync
 * - Command execution with streaming support
 * - File operations (read, write, list, delete)
 * - Process management
 * - Git operations (init, commit, push)
 * - Auto-pause with configurable timeout
 * - Session resume capability
 */
export class E2BProvider implements SandboxProvider {
  readonly id: ProviderId = "e2b";
  readonly name = "E2B Cloud Sandbox";
  readonly type: ProviderType = "cloud sandbox";

  readonly capabilities: ProviderCapabilities = {
    terminal: true,
    filesystem: true,
    processes: true,
    interactiveProcess: true,
    persistentWorkspace: true,
    snapshots: true,
    pauseResume: true,
    longRunningJobs: true,
    artifacts: true,
    network: true,
    git: true,
    preview: true,
  };

  private sandbox: Sandbox | null = null;
  private sandboxId: string | null = null;
  private sessionToken: string | null = null;
  private apiKey: string | null = null;
  private cwd: string;
  private status: "ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured" = "not_configured";
  private config: E2BSandboxConfig;

  /**
   * Create a new E2B provider instance
   */
  constructor(config: E2BSandboxConfig = {}) {
    this.apiKey = config.apiKey || process.env.E2B_API_KEY || null;
    this.cwd = config.workingDirectory || "/vibe0";
    this.config = {
      templateId: config.templateId || process.env.E2B_TEMPLATE_ID,
      envVars: config.envVars || {},
      timeout: config.timeout || parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000'),
      workingDirectory: this.cwd
    };
    
    this.status = this.apiKey ? "ready" : "not_configured";
  }

  /**
   * Create a new E2B sandbox with auto-pause enabled
   */
  async create(options?: { sessionId?: string }): Promise<string> {
    if (!this.apiKey) {
      this.status = "not_configured";
      throw new Error('E2B_API_KEY environment variable is required for real sandbox creation');
    }

    const templateId = this.config.templateId || "YOUR_E2B_TEMPLATE_ID";
    const timeoutMs = this.config.timeout || 900000;

    console.log(`[E2B] Creating sandbox with template: ${templateId} (auto-pause enabled, ${timeoutMs/1000}s timeout)`);

    try {
      // Create sandbox with native auto-pause
      const createFn = (Sandbox as any).betaCreate || Sandbox.create;
      this.sandbox = await createFn.call(Sandbox, templateId, {
        apiKey: this.apiKey,
        envs: this.config.envVars || {},
        autoPause: true,
        timeoutMs: timeoutMs
      });

      this.sandboxId = this.sandbox?.sandboxId || null;
      console.log(`[E2B] Sandbox created: ${this.sandboxId}`);

      // Wait for startup script to finish generating session token
      await this.ensureSessionToken();

      // Configure environment files
      await this.configureEnvironment();

      this.status = "ready";
      return this.sandboxId || 'e2b-sandbox';

    } catch (error) {
      console.error('[E2B] Failed to create sandbox:', error);
      this.status = "error";
      throw error;
    }
  }

  /**
   * Connect to an existing E2B sandbox
   * This auto-resumes if the sandbox was paused
   */
  async connect(sandboxId: string): Promise<boolean> {
    if (!this.apiKey) {
      this.status = "not_configured";
      return false;
    }

    if (this.sandbox && this.sandboxId === sandboxId) {
      console.log('[E2B] Already connected to sandbox:', sandboxId);
      return true;
    }

    console.log(`[E2B] Connecting to existing sandbox: ${sandboxId}`);

    try {
      const timeoutMs = this.config.timeout || parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000');
      
      this.sandbox = await (Sandbox as any).connect(sandboxId, {
        apiKey: this.apiKey,
        timeoutMs: timeoutMs
      });

      this.sandboxId = sandboxId;

      // Explicitly reset the sandbox timeout after connecting
      try {
        await (this.sandbox as any)?.setTimeout?.(timeoutMs);
        console.log(`[E2B] Sandbox timeout reset to ${timeoutMs/1000}s`);
      } catch (timeoutError) {
        console.warn('[E2B] Failed to reset sandbox timeout:', timeoutError);
      }

      // OPTIMIZATION: Skip session token and env file checks on resume
      // These were already set when the sandbox was first created
      console.log(`[E2B] Connected to sandbox: ${sandboxId}`);
      this.status = "ready";
      return true;

    } catch (error) {
      console.error('[E2B] Failed to connect to sandbox:', error);
      this.status = "error";
      return false;
    }
  }

  /**
   * Disconnect from the sandbox
   */
  async disconnect(): Promise<void> {
    this.status = "disconnected";
  }

  /**
   * Start the sandbox (alias for connect if already created)
   */
  async start(): Promise<void> {
    if (!this.sandbox && this.sandboxId) {
      await this.connect(this.sandboxId);
    }
    this.status = this.apiKey ? "ready" : "not_configured";
  }

  /**
   * Stop the sandbox (kill it)
   */
  async stop(): Promise<void> {
    await this.destroy();
  }

  /**
   * Pause the sandbox
   */
  async pause(): Promise<void> {
    if (!this.sandbox) {
      console.log('[E2B] No sandbox to pause');
      return;
    }

    try {
      console.log(`[E2B] Pausing sandbox: ${this.sandboxId}`);
      await (this.sandbox as any).betaPause?.();
      this.status = "paused";
      console.log(`[E2B] Sandbox paused: ${this.sandboxId}`);
    } catch (error) {
      console.error('[E2B] Failed to pause sandbox:', error);
      this.status = "error";
    }
  }

  /**
   * Resume a paused sandbox
   */
  async resume(): Promise<void> {
    if (!this.sandboxId) {
      console.log('[E2B] No sandbox to resume');
      return;
    }

    try {
      console.log(`[E2B] Resuming sandbox: ${this.sandboxId}`);
      const timeoutMs = this.config.timeout || parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000');
      this.sandbox = await (Sandbox as any).connect(this.sandboxId, { 
        apiKey: this.apiKey,
        timeoutMs: timeoutMs 
      });
      await (this.sandbox as any)?.setTimeout?.(timeoutMs);
      this.status = "ready";
      console.log(`[E2B] Sandbox resumed: ${this.sandboxId}`);
    } catch (error) {
      console.error('[E2B] Failed to resume sandbox:', error);
      this.status = "error";
    }
  }

  /**
   * Destroy the sandbox (kill it and clean up)
   */
  async destroy(): Promise<void> {
    if (this.sandbox) {
      try {
        console.log(`[E2B] Destroying sandbox: ${this.sandboxId}`);
        await this.sandbox.kill();
        console.log(`[E2B] Sandbox destroyed: ${this.sandboxId}`);
      } catch (error) {
        console.error('[E2B] Failed to destroy sandbox:', error);
      }
      this.sandbox = null;
      this.sandboxId = null;
      this.sessionToken = null;
    }
    this.status = "disconnected";
  }

  /**
   * Get the current status of the provider
   */
  async getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured"> {
    return this.status;
  }

  /**
   * Get environment information about the sandbox
   */
  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return {
      os: "Linux (Ubuntu 22.04 LTS)",
      arch: "x86_64",
      nodeVersion: "v20.17.0",
      pythonVersion: "Python 3.10.12",
      gccVersion: "gcc 11.4.0",
      rustVersion: "rustc 1.75.0",
      cwd: this.cwd,
      configured: Boolean(this.apiKey),
      configMessage: this.apiKey
        ? `E2B API key configured. Sandbox: ${this.sandboxId || 'not created'}`
        : "E2B_API_KEY environment variable missing. Set E2B_API_KEY in server environment.",
    };
  }

  /**
   * Get the sandbox ID
   */
  getSandboxId(): string | null {
    return this.sandboxId;
  }

  /**
   * Get the session token
   */
  getSessionToken(): string | null {
    return this.sessionToken;
  }

  /**
   * Execute a command in the sandbox with streaming support
   */
  async executeCommand(
    command: string,
    options?: CommandOptions
  ): Promise<CommandResult> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    const startTime = Date.now();
    const workingDir = options?.cwd || this.cwd;

    console.log(`[E2B] Executing command: ${command.substring(0, 100)}...`);
    console.log(`[E2B] Working directory: ${workingDir}`);

    // Always ensure we're in the correct directory
    const finalCommand = workingDir !== this.cwd ? `cd ${workingDir} && ${command}` : command;
    console.log(`[E2B] Final command: ${finalCommand.substring(0, 150)}...`);

    try {
      const result = await this.sandbox.commands.run(finalCommand, {
        onStdout: options?.onStdout,
        onStderr: options?.onStderr,
        background: options?.background || false,
        timeoutMs: 0, // Disable timeout for long-running commands
        requestTimeoutMs: 900000, // 15 minutes for HTTP request timeout
        envs: options?.env
      });

      // Handle both CommandResult and CommandHandle
      if ('exitCode' in result) {
        // CommandResult
        console.log(`[E2B] Command completed with exit code: ${result.exitCode}`);
        return {
          exitCode: result.exitCode || 0,
          stdout: result.stdout,
          stderr: result.stderr,
          output: result.stdout + result.stderr,
          isError: (result.exitCode || 0) !== 0,
          durationMs: Date.now() - startTime,
        };
      } else {
        // CommandHandle - for background commands
        console.log(`[E2B] Command started in background`);
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
          output: '',
          isError: false,
          durationMs: Date.now() - startTime,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[E2B] Command execution error: ${msg}`);
      return {
        exitCode: 1,
        stdout: "",
        stderr: msg,
        output: `E2B Execution Error: ${msg}`,
        isError: true,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Read a file from the sandbox
   */
  async readFile(filePath: string): Promise<string> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      const content = await this.sandbox.files.read(filePath);
      return content;
    } catch (error) {
      console.error(`[E2B] Failed to read file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Write a file to the sandbox
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      await this.sandbox.files.write(filePath, content);
      console.log(`[E2B] File written: ${filePath}`);
    } catch (error) {
      console.error(`[E2B] Failed to write file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Edit a file in the sandbox (replace content)
   */
  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      const current = await this.readFile(filePath);
      if (!current.includes(targetContent)) {
        throw new Error(`Target content not found in ${filePath}`);
      }
      await this.writeFile(filePath, current.replace(targetContent, replacementContent));
    } catch (error) {
      console.error(`[E2B] Failed to edit file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Delete a file from the sandbox
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      if ((this.sandbox.files as any).delete) {
        await (this.sandbox.files as any).delete(filePath);
      } else if ((this.sandbox.files as any).remove) {
        await (this.sandbox.files as any).remove(filePath);
      } else {
        await this.executeCommand(`rm -rf "${filePath}"`);
      }
      console.log(`[E2B] File deleted: ${filePath}`);
    } catch (error) {
      console.error(`[E2B] Failed to delete file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(directoryPath?: string): Promise<FileEntry[]> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      const targetDir = directoryPath || this.cwd;
      const result = await this.sandbox.files.list(targetDir);
      
      return (result as any[]).map(f => ({
        path: f.path || f.name,
        name: f.name,
        isDirectory: Boolean(f.isDirectory ?? (f.type === 'dir')),
        sizeBytes: f.sizeBytes ?? f.size ?? 0,
        updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : (f.mtime ? new Date(f.mtime).toISOString() : new Date().toISOString()),
      })) as FileEntry[];
    } catch (error) {
      console.error(`[E2B] Failed to list files in ${directoryPath || this.cwd}:`, error);
      // Return empty array on error
      return [];
    }
  }

  /**
   * Create a directory in the sandbox
   */
  async createDirectory(path: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      if ((this.sandbox.files as any).createDirectory) {
        await (this.sandbox.files as any).createDirectory(path);
      } else if ((this.sandbox.files as any).makeDir) {
        await (this.sandbox.files as any).makeDir(path);
      } else {
        await this.executeCommand(`mkdir -p "${path}"`);
      }
      console.log(`[E2B] Directory created: ${path}`);
    } catch (error) {
      console.error(`[E2B] Failed to create directory ${path}:`, error);
      throw error;
    }
  }

  /**
   * Start a process in the sandbox
   */
  async startProcess(command: string, options?: CommandOptions): Promise<ProcessHandle> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    const procId = `e2b-proc-${Date.now()}`;
    
    try {
      const finalCommand = options?.cwd ? `cd ${options.cwd} && ${command}` : command;
      
      const result = await this.sandbox.commands.run(finalCommand, {
        onStdout: options?.onStdout,
        onStderr: options?.onStderr,
        background: true,
        timeoutMs: 0,
        requestTimeoutMs: 900000,
        envs: options?.env
      });

      const handle: ProcessHandle = {
        processId: procId,
        command,
        status: "running",
        pid: result.pid
      };
      
      console.log(`[E2B] Process started: ${procId} (PID: ${result.pid})`);
      return handle;
    } catch (error) {
      console.error(`[E2B] Failed to start process: ${command}`, error);
      const handle: ProcessHandle = {
        processId: procId,
        command,
        status: "failed",
        pid: undefined
      };
      return handle;
    }
  }

  /**
   * Stop a running process
   */
  async stopProcess(processId: string): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    // Note: E2B SDK doesn't have direct process killing
    // We need to track processes and kill them by PID or command
    console.log(`[E2B] Stopping process: ${processId}`);
    
    // For now, we'll use pkill to stop the process
    try {
      await this.executeCommand(`pkill -f "${processId}" || true`);
    } catch {
      // Ignore errors
    }
  }

  /**
   * Get the status of a process
   */
  async getProcessStatus(processId: string): Promise<ProcessHandle | null> {
    // Note: E2B doesn't provide direct process status
    // This would need to be tracked separately
    console.log(`[E2B] Process status not directly available from E2B SDK`);
    return null;
  }

  /**
   * Get the host URL for a specific port (tunnel URL)
   */
  async getHost(port: number): Promise<string> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      const host = await this.sandbox.getHost(port);
      // E2B getHost returns just the hostname, so we need to add https://
      return `https://${host}`;
    } catch (error) {
      console.error(`[E2B] Failed to get host for port ${port}:`, error);
      throw error;
    }
  }

  /**
   * Check if the sandbox is running
   */
  async isRunning(): Promise<boolean> {
    if (!this.sandbox) {
      return false;
    }

    try {
      return await this.sandbox.isRunning();
    } catch (error) {
      console.error('[E2B] Error checking sandbox status:', error);
      return false;
    }
  }

  /**
   * Initialize a git repository in the sandbox
   */
  async initializeGit(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    console.log('[E2B] Initializing git repository...');

    // Run all git init commands in a single atomic script
    const initScript = `
      cd ${this.cwd}
      rm -rf .wh..git .wh.* 2>/dev/null || true
      rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
      git config --global --add safe.directory ${this.cwd}
      git config --global user.email "soryos-code@app.com"
      git config --global user.name "SoryOS Code"
      git config --global init.defaultBranch main
      git init
      echo "Git initialized successfully"
    `;

    await this.executeCommand(initScript, { cwd: this.cwd });
    console.log('[E2B] Git repository initialized');
  }

  /**
   * Commit all changes and push to GitHub
   */
  async commitAndPush(
    githubToken: string,
    repository: string,
    commitMessage: string,
    isInitialPush: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    try {
      console.log(`[E2B] Pushing to GitHub: ${repository} (isInitialPush: ${isInitialPush})`);

      // Set up remote with token authentication
      const remoteUrl = `https://${githubToken}@github.com/${repository}.git`;
      const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');

      // Generate README content for initial push
      const repoName = repository.split('/')[1] || repository;
      const readmeContent = `# ${repoName}

> Built with [SoryOS Code](https://github.com/SoryOS-org/soryos-cloud) - AI-powered development environment

## About

This project was created using **SoryOS Code**, an AI-powered development platform.

## Getting Started

\`\`\`bash
# Clone the repository
git clone https://github.com/${repository}.git
cd ${repoName}

# Install dependencies
npm install

# Start the development server
npm run dev
\`\`\`
`;

      let pushScript: string;

      if (isInitialPush) {
        // Initial push: Delete .git, init fresh, add README, force push
        console.log('[E2B] Initial push - creating fresh git repository with README');
        pushScript = `
          cd ${this.cwd}
          rm -rf .wh.* 2>/dev/null || true
          rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
          
          cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF
          
          git config --global --add safe.directory ${this.cwd}
          git config --global user.email "soryos-code@app.com"
          git config --global user.name "SoryOS Code"
          git config --global init.defaultBranch main
          git init
          
          echo '.wh.*' >> .gitignore
          echo 'node_modules/' >> .gitignore
          echo '.env.local' >> .gitignore
          echo '.soryos/' >> .gitignore
          
          git remote add origin "${remoteUrl}"
          git add .
          git commit -m "${escapedMessage}"
          git push -u origin main --force 2>&1
        `;
      } else {
        // Subsequent push: Preserve git history, add new commit on top
        console.log('[E2B] Subsequent push - adding new commit to existing history');
        pushScript = `
          cd ${this.cwd}
          rm -rf .wh.* 2>/dev/null || true
          rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
          
          if [ ! -f "README.md" ]; then
            cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF
          fi
          
          git config --global --add safe.directory ${this.cwd}
          git config --global user.email "soryos-code@app.com"
          git config --global user.name "SoryOS Code"
          git config --global init.defaultBranch main
          
          git init
          
          echo '.wh.*' >> .gitignore
          echo 'node_modules/' >> .gitignore
          echo '.env.local' >> .gitignore
          echo '.soryos/' >> .gitignore
          
          git remote add origin "${remoteUrl}"
          
          git fetch origin main 2>/dev/null || true
          git reset origin/main 2>/dev/null || true
          
          git add .
          git commit -m "${escapedMessage}"
          
          git push origin main 2>&1 || git push origin main --force 2>&1
        `;
      }

      const result = await this.sandbox.commands.run(pushScript, {
        timeoutMs: 120000, // 2 minutes timeout for push
      });

      console.log('[E2B] Git stdout:', result.stdout);
      console.log('[E2B] Git stderr:', result.stderr);
      console.log('[E2B] Git exit code:', result.exitCode);

      // Check for success indicators in output
      const output = result.stdout + result.stderr;
      const isSuccess = result.exitCode === 0 ||
        output.includes('-> main') ||
        output.includes('Everything up-to-date') ||
        output.includes('Nothing to commit') ||
        output.includes('Push completed');

      if (!isSuccess) {
        return { success: false, error: result.stderr || result.stdout || 'Push failed' };
      }

      console.log('[E2B] Successfully pushed to GitHub');
      return { success: true };
    } catch (error: any) {
      console.error('[E2B] Git push error:', error);
      const errorMessage = error.result?.stderr || error.result?.stdout || error.message || 'Unknown error';
      
      // Check if this is actually a success case
      if (errorMessage.includes('nothing to commit') ||
          errorMessage.includes('Everything up-to-date') ||
          errorMessage.includes('-> main')) {
        console.log('[E2B] Already up to date, treating as success');
        return { success: true };
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Ensure session token exists and is valid
   */
  private async ensureSessionToken(): Promise<void> {
    if (!this.sandbox) return;

    // Try to read existing token
    try {
      const result = await this.sandbox.commands.run('cat /vibe0/.session_token 2>/dev/null');
      this.sessionToken = result.stdout.trim();
      if (this.sessionToken && this.sessionToken.length >= 32) {
        console.log('[E2B] Session token found:', this.sessionToken.substring(0, 8) + '...');
        return;
      }
    } catch {
      // Token file doesn't exist yet
    }

    // Generate new token
    console.log('[E2B] Session token not found, generating one...');
    this.sessionToken = crypto.randomBytes(32).toString('hex');
    await this.sandbox.files.write('/vibe0/.session_token', this.sessionToken);
    console.log('[E2B] Session token generated:', this.sessionToken.substring(0, 8) + '...');
  }

  /**
   * Configure environment files with sandbox ID and session token
   */
  private async configureEnvironment(): Promise<void> {
    if (!this.sandbox || !this.sandboxId || !this.sessionToken) return;

    // Check if startup.sh already wrote env files
    let needsEnvWrite = true;
    try {
      const existing = await this.sandbox.commands.run('cat /vibe0/.env.local 2>/dev/null');
      if (existing.stdout.includes(this.sandboxId) && existing.stdout.includes(this.sessionToken)) {
        needsEnvWrite = false;
        console.log('[E2B] Env files already configured by startup script');
      }
    } catch {}

    if (needsEnvWrite) {
      const envContent = `EXPO_PUBLIC_PROJECT_ID=${this.sandboxId}\nEXPO_PUBLIC_SESSION_TOKEN=${this.sessionToken}\nSORYOS_SANDBOX_ID=${this.sandboxId}\nSORYOS_SESSION_TOKEN=${this.sessionToken}`;
      
      await this.sandbox.files.write('/vibe0/.env.local', envContent);
      
      // Also write shell export format
      const expoEnvContent = `export EXPO_PUBLIC_PROJECT_ID=${this.sandboxId}\nexport EXPO_PUBLIC_SESSION_TOKEN=${this.sessionToken}\nexport SORYOS_SANDBOX_ID=${this.sandboxId}\nexport SORYOS_SESSION_TOKEN=${this.sessionToken}`;
      await this.sandbox.files.write('/vibe0/.soryos_env', expoEnvContent);
      
      console.log(`[E2B] Injected sandbox ID and session token into .env.local and .soryos_env`);
    }
  }

  /**
   * Execute an AI agent in the sandbox
   */
  async executeAgent(
    prompt: string,
    agentType: 'claude' | 'cursor' | 'gemini' = 'claude',
    options: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      isFirstMessage?: boolean;
      model?: string;
      mcpConfig?: Record<string, any>;
    } = {}
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    const { onStdout, onStderr, isFirstMessage, model, mcpConfig } = options;

    if (agentType === 'claude') {
      return this.executeClaudeAgent(prompt, {
        onStdout,
        onStderr,
        isFirstMessage: isFirstMessage ?? true,
        model,
        mcpConfig
      });
    } else if (agentType === 'gemini') {
      return this.executeGeminiAgent(prompt, { onStdout, onStderr });
    } else {
      return this.executeCursorAgent(prompt, { onStdout, onStderr, isFirstMessage: isFirstMessage ?? true });
    }
  }

  /**
   * Execute Claude Code CLI agent
   */
  private async executeClaudeAgent(
    prompt: string,
    options: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      isFirstMessage?: boolean;
      model?: string;
      mcpConfig?: Record<string, any>;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    const claudeModel = options.model || 'claude-opus-4-5-20251101';
    const continueFlag = options.isFirstMessage ? '' : '--continue';
    
    // Use base64 encoding to safely pass the prompt
    const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');

    // Build MCP config flag if provided
    let mcpFlag = '';
    if (options.mcpConfig && Object.keys(options.mcpConfig).length > 0) {
      const mcpConfigJson = JSON.stringify(options.mcpConfig);
      const mcpConfigBase64 = Buffer.from(mcpConfigJson, 'utf8').toString('base64');
      mcpFlag = `--mcp-config "$(echo '${mcpConfigBase64}' | base64 -d)"`;
    }

    const anthropicKey = process.env.ANTHROPIC_SANDBOX_API_KEY || process.env.ANTHROPIC_API_KEY;
    const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_SANDBOX_API_KEY or ANTHROPIC_API_KEY environment variable is required');
    }

    const claudeCommand = `export ANTHROPIC_API_KEY='${anthropicKey}' && ` +
                        `export ANTHROPIC_BASE_URL='${anthropicBaseUrl}' && ` +
                        `echo '${promptBase64}' | base64 -d | ` +
                        `claude -p --output-format stream-json --verbose --dangerously-skip-permissions ` +
                        `${mcpFlag} ${continueFlag} --model ${claudeModel}`;

    return this.executeCommand(claudeCommand, { 
      ...options, 
      cwd: this.cwd 
    });
  }

  /**
   * Execute Cursor Agent CLI
   */
  private async executeCursorAgent(
    prompt: string,
    options: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
      isFirstMessage?: boolean;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    // Use base64 encoding to safely pass the prompt
    const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
    const resumeFlag = options.isFirstMessage ? '' : '--resume=soryos-code';
    
    const cursorApiKey = process.env.CURSOR_AGENT_API_KEY;
    if (!cursorApiKey) {
      throw new Error('CURSOR_AGENT_API_KEY environment variable is required');
    }

    const cursorCommand = `echo '${promptBase64}' | base64 -d | ` +
                        `cursor-agent --api-key ${cursorApiKey} -p --output-format stream-json --force --model auto ${resumeFlag}`;

    return this.executeCommand(cursorCommand, { 
      ...options, 
      cwd: this.cwd 
    });
  }

  /**
   * Execute Gemini CLI agent
   */
  private async executeGeminiAgent(
    prompt: string,
    options: {
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.sandbox) {
      throw new Error('Sandbox not created. Call create() or connect() first.');
    }

    // Use base64 encoding to safely pass the prompt
    const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }

    const geminiCommand = `export GEMINI_API_KEY='${geminiApiKey}' && ` +
                        `echo '${promptBase64}' | base64 -d | ` +
                        `gemini --output-format stream-json --yolo`;

    return this.executeCommand(geminiCommand, { 
      ...options, 
      cwd: this.cwd 
    });
  }
}
