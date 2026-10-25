/**
 * @soryos/sandbox
 * Types pour la gestion des sandboxes.
 */

// `ProviderId` is owned by @soryos/schema; re-exported here so sandbox
// consumers keep a single import path.
export type { ProviderId } from "@soryos/schema";
import type { ProviderId } from "@soryos/schema";

export type ProviderType =
  | "cloud sandbox"
  | "cloud execution / jobs"
  | "cloud development environment"
  | "local machine";

export interface ProviderCapabilities {
  terminal: boolean;
  filesystem: boolean;
  processes: boolean;
  interactiveProcess: boolean;
  persistentWorkspace: boolean;
  snapshots: boolean;
  pauseResume: boolean;
  longRunningJobs: boolean;
  artifacts: boolean;
  network: boolean;
  git: boolean;
  preview: boolean;
}

export interface EnvironmentInfo {
  os: string;
  arch: string;
  nodeVersion?: string;
  pythonVersion?: string;
  rustVersion?: string;
  gccVersion?: string;
  cwd: string;
  configured: boolean;
  configMessage?: string;
}

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  background?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output: string;
  isError: boolean;
  durationMs?: number;
  artifacts?: Array<{
    name: string;
    path: string;
    sizeBytes?: number;
    downloadUrl?: string;
  }>;
}

export interface ProcessHandle {
  processId: string;
  command: string;
  status: "running" | "stopped" | "failed";
  pid?: number;
}

// `FileEntry` is owned by @soryos/schema; re-exported here so sandbox
// consumers keep a single import path.
export type { FileEntry } from "@soryos/schema";

export interface GitSyncState {
  isClean: boolean;
  currentBranch: string;
  currentCommit: string;
  uncommittedFilesCount: number;
  remoteRepoUrl?: string;
  aheadCount?: number;
  behindCount?: number;
  diverged?: boolean;
}

export interface SessionWorkspaceContext {
  projectId: string;
  workspaceId: string;
  sessionId: string;
  environment: "sandbox" | "local";
  providerId: ProviderId;
  gitRepository?: string;
  gitBranch?: string;
  gitCommit?: string;
  syncState?: GitSyncState;
}

export type SandboxEventType =
  | "sandbox.created"
  | "sandbox.ready"
  | "sandbox.starting"
  | "sandbox.started"
  | "sandbox.command.started"
  | "sandbox.command.output"
  | "sandbox.command.completed"
  | "sandbox.command.error"
  | "sandbox.process.started"
  | "sandbox.process.stopped"
  | "sandbox.disconnected"
  | "sandbox.reconnected"
  | "sandbox.stopped"
  | "sandbox.destroyed";

export interface SandboxEvent {
  type: SandboxEventType;
  sessionId: string;
  providerId: ProviderId;
  sandboxId: string;
  timestamp: string;
  data?: Record<string, unknown>;
}
