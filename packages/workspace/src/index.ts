/**
 * @soryos/workspace
 * Source of truth for ActiveWorkspace and workspace state.
 * Shared synchronously between Explorer, Editor, Terminal, Agent, and DevRunner.
 */

import { ActiveWorkspace, ProviderId, WorkspaceStatus } from "@soryos/schema";
import { ExecutionProvider, executionManager } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";

declare global {
  // Survives Next.js route-bundle module duplication (dev + prod chunks)
  var __soryos_workspaces_store: Map<string, ActiveWorkspace> | undefined;
}

const workspacesStore: Map<string, ActiveWorkspace> =
  globalThis.__soryos_workspaces_store ?? new Map<string, ActiveWorkspace>();
globalThis.__soryos_workspaces_store = workspacesStore;

export class WorkspaceManager {
  private workspaces: Map<string, ActiveWorkspace> = workspacesStore;

  public getOrCreateWorkspace(
    sessionId: string,
    options?: {
      projectId?: string;
      environment?: "local" | "sandbox";
      providerId?: ProviderId;
      workspacePath?: string;
      repository?: string;
      branch?: string;
    }
  ): ActiveWorkspace {
    let ws = this.workspaces.get(sessionId);

    if (!ws) {
      const rootDir = typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet";
      const env = options?.environment || "local";
      const providerId = options?.providerId || "local";

      ws = {
        id: `ws-${sessionId}`,
        projectId: options?.projectId || "default-project",
        sessionId,
        title: "Workspace Actif",
        environment: env,
        providerId: providerId,
        workspacePath: options?.workspacePath || (providerId === "local" ? rootDir : `/tmp/soryos-workspaces/${sessionId}`),
        repository: options?.repository,
        branch: options?.branch || "main",
        status: "WORKSPACE_READY",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.workspaces.set(sessionId, ws);
      globalEventBus.emit(sessionId, "session.created", { workspaceId: ws.id });
    }

    return ws;
  }

  public getWorkspace(sessionId: string): ActiveWorkspace | undefined {
    return this.workspaces.get(sessionId);
  }

  public updateWorkspaceState(sessionId: string, status: WorkspaceStatus): void {
    const ws = this.workspaces.get(sessionId);
    if (ws) {
      ws.status = status;
      ws.updatedAt = new Date().toISOString();
      globalEventBus.emit(sessionId, "session.updated", { workspaceId: ws.id, status });
    }
  }

  public async getExecutionProvider(sessionId: string): Promise<ExecutionProvider> {
    const ws = this.getOrCreateWorkspace(sessionId);
    return executionManager.getOrCreateProvider(sessionId, ws.providerId);
  }
}

export const workspaceManager = new WorkspaceManager();

export class WorkspaceStore {
  public static async get(id: string) {
    return workspaceManager.getWorkspace(id) || null;
  }
}

export class ProjectStore {
  public static async get(id: string) {
    return null;
  }
}
