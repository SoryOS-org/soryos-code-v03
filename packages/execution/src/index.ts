/**
 * @soryos/execution
 * Unified execution provider layer for real sandboxes (Local, Codespaces, E2B, Vercel, Cloud Run).
 * Browser-safe guarded against native Node.js module bundler failures using dynamic evaluation.
 */

import { CommandOptions, CommandResult, FileEntry, ProviderId } from "@soryos/schema";
import { ExecutionError } from "@soryos/core";

const isServer = typeof window === "undefined";

declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

/**
 * Optional override for native module resolution.
 *
 * `dynamicRequire` uses `eval("require")`, which deliberately bypasses bundler
 * static analysis (so this package stays safe to import from client bundles).
 * The side effect is that test runners cannot intercept it by mocking
 * "fs/promises". Tests install a resolver here instead.
 */
let moduleResolver: ((moduleName: string) => unknown) | null = null;

/** @internal Exposed for tests; not part of the public API. */
export function __setModuleResolver(resolver: ((moduleName: string) => unknown) | null): void {
  moduleResolver = resolver;
}

function dynamicRequire(moduleName: string): any {
  if (!isServer) {
    throw new ExecutionError(`Node.js native module '${moduleName}' cannot be executed in browser environment.`);
  }
  if (moduleResolver) {
    return moduleResolver(moduleName);
  }
  try {
    const req = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
    return req(moduleName);
  } catch {
    throw new ExecutionError(`Failed to dynamically load native Node.js module '${moduleName}'.`);
  }
}

function getNodeFs() {
  return dynamicRequire("fs/promises") as typeof import("fs/promises");
}

function getNodePath() {
  return dynamicRequire("path") as typeof import("path");
}

function getNodeExecAsync() {
  const { exec } = dynamicRequire("child_process");
  const { promisify } = dynamicRequire("util");
  return promisify(exec);
}

export interface ExecutionProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: "local" | "cloud" | "container";

  init(workspacePath?: string): Promise<void>;
  getWorkspacePath(): string;
  executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  listFiles(dirPath?: string): Promise<FileEntry[]>;
  /** Create directory recursively. */
  createDirectory?(dirPath: string): Promise<void>;
  /** Move/rename a file or directory. */
  moveFile?(sourcePath: string, targetPath: string): Promise<void>;
}

/**
 * Base class for cloud providers that require API configuration
 */
export abstract class CloudExecutionProvider implements ExecutionProvider {
  readonly type: "cloud" | "container" = "cloud";
  protected apiKey: string | null = null;
  protected workspaceDir: string;

  constructor(protected providerId: ProviderId, protected providerName: string) {
    this.workspaceDir = "";
  }

  get id(): ProviderId { return this.providerId; }
  get name(): string { return this.providerName; }

  /**
   * Check if provider is properly configured
   */
  protected isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Get the environment variable name for this provider's API key
   */
  protected abstract getApiKeyEnvVar(): string;

  /**
   * Initialize the provider with workspace path
   */
  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `Provider ${this.name} is not configured. Please set the ${this.getApiKeyEnvVar()} environment variable.`
      );
    }
  }

  /**
   * Get API key from environment
   */
  protected getApiKeyFromEnvironment(): string | null {
    const envVar = this.getApiKeyEnvVar();
    return typeof process !== "undefined" ? process.env[envVar] || null : null;
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  abstract executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>;
  abstract readFile(filePath: string): Promise<string>;
  abstract writeFile(filePath: string, content: string): Promise<void>;
  abstract editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void>;
  abstract deleteFile(filePath: string): Promise<void>;
  abstract listFiles(dirPath?: string): Promise<FileEntry[]>;
}

/**
 * Local Execution Provider - executes commands on the local machine
 */
export class LocalExecutionProvider implements ExecutionProvider {
  readonly id: ProviderId = "local";
  readonly name = "Machine Locale";
  readonly type = "local" as const;

  private workspaceDir: string;

  constructor(customWorkspaceDir?: string) {
    this.workspaceDir = customWorkspaceDir || (isServer && typeof process !== "undefined" && process.cwd ? process.cwd() : "/");
  }

  async init(workspacePath?: string): Promise<void> {
    if (workspacePath) {
      this.workspaceDir = workspacePath;
    }
    const fs = getNodeFs();
    const path = getNodePath();
    await fs.mkdir(this.workspaceDir, { recursive: true });

    // Seed empty workspace directory with project codebase if different from root project dir
    const rootDir = typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet";
    if (this.workspaceDir !== rootDir) {
      try {
        const files = await fs.readdir(this.workspaceDir);
        if (files.length === 0) {
          const copyDir = async (src: string, dest: string) => {
            await fs.mkdir(dest, { recursive: true });
            const entries = await fs.readdir(src, { withFileTypes: true });
            for (const entry of entries) {
              if (
                entry.name === "node_modules" ||
                entry.name === ".git" ||
                entry.name === ".next" ||
                entry.name === "dist"
              ) {
                continue;
              }
              const srcPath = path.join(src, entry.name);
              const destPath = path.join(dest, entry.name);
              if (entry.isDirectory()) {
                await copyDir(srcPath, destPath);
              } else {
                await fs.copyFile(srcPath, destPath);
              }
            }
          };
          await copyDir(rootDir, this.workspaceDir);
        }
      } catch {
        // ignore seed errors
      }
    }
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  /**
   * Resolve a path relative to the workspace, ensuring it stays within the workspace
   * @param relPath - The relative or absolute path to resolve
   * @returns The resolved absolute path within the workspace
   * @throws ExecutionError if the path attempts to escape the workspace
   */
  private resolvePath(relPath: string): string {
    const path = getNodePath();
    const fs = getNodeFs();
    
    // Normalize the path
    let normalizedPath = relPath.replace(/^[/\\]+/, "");
    
    // Treat Windows separators as separators, not literal filename characters.
    // Without this, "..\windows\system32" is a valid single filename on POSIX and
    // slips past the traversal check below.
    const traversalProbe = normalizedPath.replace(/\\/g, "/");
    
    // Check for path traversal attempts
    if (traversalProbe.includes("..") || path.isAbsolute(relPath)) {
      // If it's an absolute path, verify it's within workspace
      const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(this.workspaceDir, relPath);
      const workspaceAbs = path.resolve(this.workspaceDir);
      
      // Normalize both paths for comparison
      const normalizedAbsolute = path.normalize(absolutePath);
      const normalizedWorkspace = path.normalize(workspaceAbs);
      
      // Ensure the path is within the workspace
      if (!normalizedAbsolute.startsWith(normalizedWorkspace + path.sep) && 
          normalizedAbsolute !== normalizedWorkspace) {
        throw new ExecutionError(
          `Path traversal detected: '${relPath}' attempts to access outside workspace '${this.workspaceDir}'`
        );
      }
      
      // On POSIX, "..\\windows" is a single literal filename rather than a
      // parent reference, so containment alone would accept it. Re-check the
      // separator-normalized form against the workspace to reject the bypass.
      const posixNormalized = path.normalize(
        path.resolve(this.workspaceDir, traversalProbe)
      );
      if (!posixNormalized.startsWith(normalizedWorkspace + path.sep) &&
          posixNormalized !== normalizedWorkspace) {
        throw new ExecutionError(
          `Path traversal detected: '${relPath}' attempts to access outside workspace '${this.workspaceDir}'`
        );
      }
      return normalizedAbsolute;
    }
    
    return path.resolve(this.workspaceDir, normalizedPath);
  }

  /**
   * Reject paths that escape the workspace through a symlink.
   *
   * `resolvePath` only validates the literal path, so an in-workspace symlink
   * such as "link-to-etc/passwd" would still read outside the sandbox. Resolve
   * the real path first and verify it stays contained.
   */
  private async assertNotEscapingSymlink(absolutePath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const workspaceAbs = path.resolve(this.workspaceDir);

    let realPath: string;
    try {
      // Resolve the deepest existing ancestor so not-yet-created files are
      // still checked against their real parent directory.
      let probe = absolutePath;
      for (;;) {
        try {
          realPath = await fs.realpath(probe);
          break;
        } catch {
          const parent = path.dirname(probe);
          if (parent === probe) return; // reached the filesystem root
          probe = parent;
        }
      }
    } catch {
      return; // realpath unavailable: fall back to the lexical check
    }

    const real = path.resolve(realPath);
    if (!real.startsWith(workspaceAbs + path.sep) && real !== workspaceAbs) {
      throw new ExecutionError(
        `Path traversal detected: '${absolutePath}' resolves outside workspace '${this.workspaceDir}'`
      );
    }
  }

  /**
   * Validate that a path is within the workspace directory
   * @param absolutePath - The absolute path to validate
   * @returns The validated path
   * @throws ExecutionError if path is outside workspace
   */
  private validatePath(absolutePath: string): string {
    const path = getNodePath();
    const workspaceAbs = path.resolve(this.workspaceDir);
    const normalizedPath = path.normalize(absolutePath);
    const normalizedWorkspace = path.normalize(workspaceAbs);
    
    if (!normalizedPath.startsWith(normalizedWorkspace + path.sep) && 
        normalizedPath !== normalizedWorkspace) {
      throw new ExecutionError(
        `Access denied: path '${absolutePath}' is outside workspace '${this.workspaceDir}'`
      );
    }
    
    return normalizedPath;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    const cwd = options?.cwd ? this.resolvePath(options.cwd) : this.workspaceDir;
    const timeoutMs = options?.timeoutMs || 60_000;
    const execAsync = getNodeExecAsync();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...(typeof process !== "undefined" ? process.env : {}), ...(options?.env || {}) },
        timeout: timeoutMs,
      });

      return {
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: (execErr.stdout || "").trimEnd(),
        stderr: (execErr.stderr || execErr.message || "").trimEnd(),
        exitCode: typeof execErr.code === "number" ? execErr.code : 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fs = getNodeFs();
    const fullPath = this.resolvePath(filePath);
    await this.assertNotEscapingSymlink(fullPath);
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible de lire le fichier ${filePath}: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible d'écrire dans ${filePath}: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new ExecutionError(`Le bloc cible à remplacer n'a pas été trouvé dans ${filePath}.`);
    }
    const updated = current.replace(targetContent, replacementContent);
    await this.writeFile(filePath, updated);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fs = getNodeFs();
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
  }

  async listFiles(dirPath = ""): Promise<FileEntry[]> {
    const fs = getNodeFs();
    const path = getNodePath();
    const targetDir = this.resolvePath(dirPath);
    const results: FileEntry[] = [];

    const scan = async (currentDir: string, relativeRoot: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.join(relativeRoot, entry.name);
          const stat = await fs.stat(fullPath);

          results.push({
            path: relPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });

          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          }
        }
      } catch {
        // ignore
      }
    };

    await scan(targetDir, "");
    return results;
  }
}

/**
 * E2B Cloud Execution Provider
 * Requires E2B_API_KEY to be configured
 */
export class E2BExecutionProvider extends CloudExecutionProvider {
  readonly type = "cloud" as const;

  constructor() {
    super("e2b", "E2B Cloud Sandbox");
  }

  protected getApiKeyEnvVar(): string {
    return "E2B_API_KEY";
  }

  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "/tmp/soryos-workspaces/e2b";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `E2B provider is not configured. Please set the E2B_API_KEY environment variable.`
      );
    }
  }

  /**
   * Remote sandbox provisioning happens lazily in each operation via
   * `sandboxRegistry.createProvider("e2b")`, so init() only validates
   * credentials and constructing a provider needs no network access.
   */

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      const result = await provider.executeCommand(command, options);
      
      return {
        stdout: result.output || result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMessage = (err as Error).message;
      return {
        stdout: "",
        stderr: `E2B execution error: ${errorMessage}`,
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      return await provider.readFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`E2B read file error: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      await provider.writeFile(filePath, content);
    } catch (err: unknown) {
      throw new ExecutionError(`E2B write file error: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      await provider.editFile(filePath, targetContent, replacementContent);
    } catch (err: unknown) {
      throw new ExecutionError(`E2B edit file error: ${(err as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      await provider.deleteFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`E2B delete file error: ${(err as Error).message}`);
    }
  }

  async listFiles(dirPath?: string): Promise<FileEntry[]> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("e2b");
      return await provider.listFiles(dirPath);
    } catch (err: unknown) {
      throw new ExecutionError(`E2B list files error: ${(err as Error).message}`);
    }
  }
}

/**
 * Vercel Sandbox Execution Provider
 * Requires VERCEL_TOKEN to be configured
 */
export class VercelExecutionProvider extends CloudExecutionProvider {
  readonly type = "cloud" as const;

  constructor() {
    super("vercel", "Vercel Sandbox");
  }

  protected getApiKeyEnvVar(): string {
    return "VERCEL_TOKEN";
  }

  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "/tmp/soryos-workspaces/vercel";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `Vercel provider is not configured. Please set the VERCEL_TOKEN environment variable.`
      );
    }
    
    // Remote provisioning is deferred: each operation resolves the sandbox
    // through sandboxRegistry.createProvider(), so init() only validates
    // credentials and does not require network access.
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      const result = await provider.executeCommand(command, options);
      
      return {
        stdout: result.output || result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMessage = (err as Error).message;
      return {
        stdout: "",
        stderr: `Vercel execution error: ${errorMessage}`,
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      return await provider.readFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`Vercel read file error: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      await provider.writeFile(filePath, content);
    } catch (err: unknown) {
      throw new ExecutionError(`Vercel write file error: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      await provider.editFile(filePath, targetContent, replacementContent);
    } catch (err: unknown) {
      throw new ExecutionError(`Vercel edit file error: ${(err as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      await provider.deleteFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`Vercel delete file error: ${(err as Error).message}`);
    }
  }

  async listFiles(dirPath?: string): Promise<FileEntry[]> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("vercel");
      return await provider.listFiles(dirPath);
    } catch (err: unknown) {
      throw new ExecutionError(`Vercel list files error: ${(err as Error).message}`);
    }
  }
}

/**
 * GitHub Codespaces Execution Provider
 * Requires GITHUB_TOKEN to be configured
 */
export class GitHubCodespacesExecutionProvider extends CloudExecutionProvider {
  readonly type = "cloud" as const;

  constructor() {
    super("github-codespaces", "GitHub Codespaces");
  }

  protected getApiKeyEnvVar(): string {
    return "GITHUB_TOKEN";
  }

  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "/tmp/soryos-workspaces/github-codespaces";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `GitHub Codespaces provider is not configured. Please set the GITHUB_TOKEN environment variable.`
      );
    }
    
    // Remote provisioning is deferred: each operation resolves the sandbox
    // through sandboxRegistry.createProvider(), so init() only validates
    // credentials and does not require network access.
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      const result = await provider.executeCommand(command, options);
      
      return {
        stdout: result.output || result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMessage = (err as Error).message;
      return {
        stdout: "",
        stderr: `GitHub Codespaces execution error: ${errorMessage}`,
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      return await provider.readFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`GitHub Codespaces read file error: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      await provider.writeFile(filePath, content);
    } catch (err: unknown) {
      throw new ExecutionError(`GitHub Codespaces write file error: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      await provider.editFile(filePath, targetContent, replacementContent);
    } catch (err: unknown) {
      throw new ExecutionError(`GitHub Codespaces edit file error: ${(err as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      await provider.deleteFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`GitHub Codespaces delete file error: ${(err as Error).message}`);
    }
  }

  async listFiles(dirPath?: string): Promise<FileEntry[]> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("github-codespaces");
      return await provider.listFiles(dirPath);
    } catch (err: unknown) {
      throw new ExecutionError(`GitHub Codespaces list files error: ${(err as Error).message}`);
    }
  }
}

/**
 * GitHub Repository Execution Provider
 * This provider works with GitHub repositories but doesn't create a full sandbox
 * It uses git operations to read/write files
 */
export class GitHubRepositoryExecutionProvider extends CloudExecutionProvider {
  readonly type = "cloud" as const;

  constructor() {
    super("github-repository", "GitHub Repository");
  }

  protected getApiKeyEnvVar(): string {
    return "GITHUB_TOKEN";
  }

  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "/tmp/soryos-workspaces/github-repository";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `GitHub Repository provider is not configured. Please set the GITHUB_TOKEN environment variable.`
      );
    }
    
    // For github-repository, we use local execution with git operations
    // This is a simplified provider that works with git repos
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    const cwd = options?.cwd || this.workspaceDir;
    const timeoutMs = options?.timeoutMs || 60_000;
    const execAsync = getNodeExecAsync();

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        env: { ...(typeof process !== "undefined" ? process.env : {}), ...(options?.env || {}) },
        timeout: timeoutMs,
      });

      return {
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      return {
        stdout: (execErr.stdout || "").trimEnd(),
        stderr: (execErr.stderr || execErr.message || "").trimEnd(),
        exitCode: typeof execErr.code === "number" ? execErr.code : 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = path.resolve(this.workspaceDir, filePath);
    try {
      return await fs.readFile(fullPath, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible de lire le fichier ${filePath}: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = path.resolve(this.workspaceDir, filePath);
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, "utf-8");
    } catch (err: unknown) {
      throw new ExecutionError(`Impossible d'écrire dans ${filePath}: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const current = await this.readFile(filePath);
    if (!current.includes(targetContent)) {
      throw new ExecutionError(`Le bloc cible à remplacer n'a pas été trouvé dans ${filePath}.`);
    }
    const updated = current.replace(targetContent, replacementContent);
    await this.writeFile(filePath, updated);
  }

  async deleteFile(filePath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = path.resolve(this.workspaceDir, filePath);
    try {
      await fs.unlink(fullPath);
    } catch {
      // ignore
    }
  }

  /** Create directory recursively (matches interface contract used by tools). */
  async createDirectory(dirPath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const fullPath = path.resolve(this.workspaceDir, dirPath);
    try {
      await fs.mkdir(fullPath, { recursive: true });
    } catch {
      // ignore
    }
  }

  async moveFile(sourcePath: string, targetPath: string): Promise<void> {
    const fs = getNodeFs();
    const path = getNodePath();
    const source = path.resolve(this.workspaceDir, sourcePath);
    const target = path.resolve(this.workspaceDir, targetPath);
    try {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(source, target);
    } catch {
      // ignore
    }
  }

  async listFiles(dirPath = ""): Promise<FileEntry[]> {
    const fs = getNodeFs();
    const path = getNodePath();
    const targetDir = path.resolve(this.workspaceDir, dirPath);
    const results: FileEntry[] = [];

    const scan = async (currentDir: string, relativeRoot: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
            continue;
          }
          const fullPath = path.join(currentDir, entry.name);
          const relPath = path.join(relativeRoot, entry.name);
          const stat = await fs.stat(fullPath);

          results.push({
            path: relPath,
            name: entry.name,
            isDirectory: entry.isDirectory(),
            sizeBytes: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });

          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          }
        }
      } catch {
        // ignore
      }
    };

    await scan(targetDir, "");
    return results;
  }
}

/**
 * Google Cloud Run Execution Provider
 * Requires GCP credentials to be configured
 */
export class GoogleCloudRunExecutionProvider extends CloudExecutionProvider {
  readonly type = "container" as const;

  constructor() {
    super("google-cloud-run", "Google Cloud Run");
  }

  protected getApiKeyEnvVar(): string {
    return "GOOGLE_CLOUD_CREDENTIALS";
  }

  async init(workspacePath?: string): Promise<void> {
    this.apiKey = this.getApiKeyFromEnvironment();
    this.workspaceDir = workspacePath || "/tmp/soryos-workspaces/google-cloud-run";
    
    if (!this.isConfigured()) {
      throw new ExecutionError(
        `Google Cloud Run provider is not configured. Please set the GOOGLE_CLOUD_CREDENTIALS environment variable.`
      );
    }
    
    // Remote provisioning is deferred: each operation resolves the sandbox
    // through sandboxRegistry.createProvider(), so init() only validates
    // credentials and does not require network access.
  }

  getWorkspacePath(): string {
    return this.workspaceDir;
  }

  async executeCommand(command: string, options?: CommandOptions): Promise<CommandResult> {
    const start = Date.now();
    
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      const result = await provider.executeCommand(command, options);
      
      return {
        stdout: result.output || result.stdout || "",
        stderr: result.stderr || "",
        exitCode: result.exitCode,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const errorMessage = (err as Error).message;
      return {
        stdout: "",
        stderr: `Google Cloud Run execution error: ${errorMessage}`,
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      return await provider.readFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`Google Cloud Run read file error: ${(err as Error).message}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      await provider.writeFile(filePath, content);
    } catch (err: unknown) {
      throw new ExecutionError(`Google Cloud Run write file error: ${(err as Error).message}`);
    }
  }

  async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      await provider.editFile(filePath, targetContent, replacementContent);
    } catch (err: unknown) {
      throw new ExecutionError(`Google Cloud Run edit file error: ${(err as Error).message}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      await provider.deleteFile(filePath);
    } catch (err: unknown) {
      throw new ExecutionError(`Google Cloud Run delete file error: ${(err as Error).message}`);
    }
  }

  async listFiles(dirPath?: string): Promise<FileEntry[]> {
    try {
      const { sandboxRegistry } = await import("@soryos/sandbox");
      const provider = await sandboxRegistry.createProvider("google-cloud-run");
      return await provider.listFiles(dirPath);
    } catch (err: unknown) {
      throw new ExecutionError(`Google Cloud Run list files error: ${(err as Error).message}`);
    }
  }
}

/**
 * Execution Manager - Manages provider instances per session
 */
export class ExecutionManager {
  private providers: Map<string, ExecutionProvider> = new Map();

  /**
   * Get a provider instance for a specific session and provider ID
   * Creates a new instance if one doesn't exist
   */
  public async getProvider(sessionId: string, providerId: ProviderId = "local"): Promise<ExecutionProvider> {
    const key = `${sessionId}:${providerId}`;
    let provider = this.providers.get(key);

    if (!provider) {
      provider = await this.createProvider(providerId, sessionId);
      this.providers.set(key, provider);
    }

    return provider;
  }

  /**
   * Get or create a provider instance for a session
   * This is the main method used by the system
   */
  public async getOrCreateProvider(sessionId: string, providerId: ProviderId = "local"): Promise<ExecutionProvider> {
    return this.getProvider(sessionId, providerId);
  }

  /**
   * Create a provider instance based on the provider ID
   * Each provider must be properly configured or it will throw an error
   */
  private async createProvider(providerId: ProviderId, sessionId: string): Promise<ExecutionProvider> {
    const path = getNodePath();
    const rootDir = typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet";
    
    let provider: ExecutionProvider;
    switch (providerId) {
      case "local":
        provider = new LocalExecutionProvider();
        break;
      case "github-repository":
        provider = new GitHubRepositoryExecutionProvider();
        break;
      case "e2b":
        provider = new E2BExecutionProvider();
        break;
      case "vercel":
        provider = new VercelExecutionProvider();
        break;
      case "github-codespaces":
        provider = new GitHubCodespacesExecutionProvider();
        break;
      case "google-cloud-run":
        provider = new GoogleCloudRunExecutionProvider();
        break;
      default:
        throw new ExecutionError(`Provider ${providerId} is not supported or does not exist.`);
    }

    // Initialize so credential checks in init() actually run. Without this the
    // provider is handed back unconfigured and every later call fails obscurely.
    await provider.init();

    return provider;
  }

  /**
   * Get a provider instance without session context
   * Useful for direct provider access
   */
  public async getProviderById(providerId: ProviderId): Promise<ExecutionProvider> {
    return this.createProvider(providerId, "");
  }

  /**
   * Check if a provider is configured and available
   */
  public async isProviderConfigured(providerId: ProviderId): Promise<boolean> {
    try {
      const provider = await this.createProvider(providerId, "");
      // For cloud providers, check if they have API keys
      if (provider instanceof CloudExecutionProvider) {
        return (provider as any).isConfigured?.() ?? true;
      }
      // Local provider is always configured
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up provider instances for a session
   */
  public cleanupSession(sessionId: string): void {
    const keysToRemove: string[] = [];
    for (const key of this.providers.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.providers.delete(key);
    }
  }

  /**
   * Clear all provider instances
   */
  public clearAll(): void {
    this.providers.clear();
  }
}

export const executionManager = new ExecutionManager();
