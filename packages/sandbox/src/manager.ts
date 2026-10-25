/**
 * @soryos/sandbox
 * Gestionnaire central des sandboxes.
 */

import { SandboxProvider } from "./provider";
import { sandboxRegistry } from "./registry";
import {
  ProviderId,
  SandboxEvent,
  SandboxEventType,
  CommandOptions,
  CommandResult,
  FileEntry,
  ProcessHandle,
} from "./types";

type EventListener = (event: SandboxEvent) => void;

declare global {
  // Survives Next.js route-bundle module duplication (dev + prod chunks)
  var __soryos_active_sandboxes:
    | Map<string, { providerId: ProviderId; provider: SandboxProvider; sandboxId: string }>
    | undefined;
}

const activeSandboxesStore: Map<
  string,
  { providerId: ProviderId; provider: SandboxProvider; sandboxId: string }
> =
  globalThis.__soryos_active_sandboxes ??
  new Map<string, { providerId: ProviderId; provider: SandboxProvider; sandboxId: string }>();
globalThis.__soryos_active_sandboxes = activeSandboxesStore;

class SandboxManager {
  private activeSandboxes = activeSandboxesStore;
  private listeners: EventListener[] = [];

  // Event Subscription
  onEvent(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emitEvent(
    type: SandboxEventType,
    sessionId: string,
    providerId: ProviderId,
    sandboxId: string,
    data?: Record<string, unknown>
  ) {
    const event: SandboxEvent = {
      type,
      sessionId,
      providerId,
      sandboxId,
      timestamp: new Date().toISOString(),
      data,
    };
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error("Error in sandbox event listener:", e);
      }
    });
  }

  // Get or Create Sandbox for Session
  async getOrCreateSandbox(
    sessionId: string,
    requestedProviderId: ProviderId = "local",
    providerOptions?: {
      token?: string;
      owner?: string;
      repo?: string;
      branch?: string;
      codespaceName?: string;
    }
  ): Promise<{ provider: SandboxProvider; sandboxId: string; providerId: ProviderId }> {
    const existing = this.activeSandboxes.get(sessionId);

    // If sandbox exists for same provider, return it
    if (existing && existing.providerId === requestedProviderId) {
      return existing;
    }

    // If switching provider, disconnect existing
    if (existing && existing.providerId !== requestedProviderId) {
      await existing.provider.disconnect();
      this.emitEvent("sandbox.disconnected", sessionId, existing.providerId, existing.sandboxId);
    }

    const provider = await sandboxRegistry.createProvider(requestedProviderId);
    if (!provider) {
      throw new Error(`Provider ${requestedProviderId} not found in registry.`);
    }

    this.emitEvent("sandbox.starting", sessionId, requestedProviderId, "");
    const sandboxId = await provider.create({ sessionId, ...providerOptions });
    await provider.start();

    const entry = { providerId: requestedProviderId, provider, sandboxId };
    this.activeSandboxes.set(sessionId, entry);

    this.emitEvent("sandbox.created", sessionId, requestedProviderId, sandboxId);
    this.emitEvent("sandbox.ready", sessionId, requestedProviderId, sandboxId);

    return entry;
  }

  // Get the provider bound to a session, if a sandbox is already active
  getActiveProviderId(sessionId: string): ProviderId | undefined {
    return this.activeSandboxes.get(sessionId)?.providerId;
  }

  // Switch Provider for Session
  async switchProvider(
    sessionId: string,
    newProviderId: ProviderId
  ): Promise<{ provider: SandboxProvider; sandboxId: string; providerId: ProviderId }> {
    return this.getOrCreateSandbox(sessionId, newProviderId);
  }

  // Unified File System Operations
  async readFile(sessionId: string, filePath: string, providerId: ProviderId = "local"): Promise<string> {
    const { provider } = await this.getOrCreateSandbox(sessionId, providerId);
    return provider.readFile(filePath);
  }

  async writeFile(sessionId: string, filePath: string, content: string, providerId: ProviderId = "local"): Promise<void> {
    const { provider } = await this.getOrCreateSandbox(sessionId, providerId);
    await provider.writeFile(filePath, content);
  }

  async editFile(
    sessionId: string,
    filePath: string,
    targetContent: string,
    replacementContent: string,
    providerId: ProviderId = "local"
  ): Promise<void> {
    const { provider } = await this.getOrCreateSandbox(sessionId, providerId);
    await provider.editFile(filePath, targetContent, replacementContent);
  }

  async deleteFile(sessionId: string, filePath: string, providerId: ProviderId = "local"): Promise<void> {
    const { provider } = await this.getOrCreateSandbox(sessionId, providerId);
    await provider.deleteFile(filePath);
  }

  async listFiles(sessionId: string, directoryPath?: string, providerId: ProviderId = "local"): Promise<FileEntry[]> {
    const { provider } = await this.getOrCreateSandbox(sessionId, providerId);
    return provider.listFiles(directoryPath);
  }

  // Unified Command Execution (Terminal / Agents / Builds)
  async executeCommand(
    sessionId: string,
    command: string,
    options?: CommandOptions,
    providerId: ProviderId = "local"
  ): Promise<CommandResult> {
    const { provider, sandboxId } = await this.getOrCreateSandbox(sessionId, providerId);

    this.emitEvent("sandbox.command.started", sessionId, providerId, sandboxId, { command });

    const result = await provider.executeCommand(command, options);

    if (result.isError) {
      this.emitEvent("sandbox.command.error", sessionId, providerId, sandboxId, { command, output: result.output });
    } else {
      this.emitEvent("sandbox.command.completed", sessionId, providerId, sandboxId, { command, output: result.output });
    }

    return result;
  }

  // Unified Process Operations
  async startProcess(
    sessionId: string,
    command: string,
    options?: CommandOptions,
    providerId: ProviderId = "local"
  ): Promise<ProcessHandle> {
    const { provider, sandboxId } = await this.getOrCreateSandbox(sessionId, providerId);
    const handle = await provider.startProcess(command, options);
    this.emitEvent("sandbox.process.started", sessionId, providerId, sandboxId, { command, processId: handle.processId });
    return handle;
  }

  async stopProcess(sessionId: string, processId: string, providerId: ProviderId = "local"): Promise<void> {
    const { provider, sandboxId } = await this.getOrCreateSandbox(sessionId, providerId);
    await provider.stopProcess(processId);
    this.emitEvent("sandbox.process.stopped", sessionId, providerId, sandboxId, { processId });
  }
}

export const sandboxManager = new SandboxManager();
