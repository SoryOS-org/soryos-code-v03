/**
 * @soryos/sandbox
 * Interface de base pour les providers de sandbox.
 */

import {
  ProviderId,
  ProviderType,
  ProviderCapabilities,
  EnvironmentInfo,
  CommandOptions,
  CommandResult,
  ProcessHandle,
  FileEntry,
} from "./types";

export interface SandboxProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly type: ProviderType;
  readonly capabilities: ProviderCapabilities;

  // Lifecycle
  create(options?: {
    sessionId?: string;
    workspacePath?: string;
    token?: string;
    owner?: string;
    repo?: string;
    branch?: string;
    codespaceName?: string;
  }): Promise<string>;
  connect(sandboxId: string): Promise<boolean>;
  disconnect(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;

  // Status & Info
  getStatus(): Promise<"ready" | "busy" | "paused" | "disconnected" | "error" | "not_configured">;
  getEnvironmentInfo(): Promise<EnvironmentInfo>;

  // Execution
  executeCommand(command: string, options?: CommandOptions): Promise<CommandResult>;

  // File Operations
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
  listFiles(directoryPath?: string): Promise<FileEntry[]>;
  createDirectory(directoryPath: string): Promise<void>;

  // Process Management
  startProcess(command: string, options?: CommandOptions): Promise<ProcessHandle>;
  stopProcess(processId: string): Promise<void>;
  getProcessStatus(processId: string): Promise<ProcessHandle | null>;
}
