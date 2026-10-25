/**
 * @soryos/sandbox
 * Registry des providers de sandbox.
 */

import { SandboxProvider } from "./provider";
import { ProviderId } from "./types";
import { LocalProvider } from "./providers/local";

// Import dynamique pour éviter les erreurs de bundling
let E2BProvider: typeof import("./providers/e2b").E2BProvider | null = null;
let VercelProvider: typeof import("./providers/vercel").VercelProvider | null = null;
let GoogleCloudRunProvider: typeof import("./providers/google-cloud-run").GoogleCloudRunProvider | null = null;
let GitHubCodespacesProvider: typeof import("./providers/github-codespaces").GitHubCodespacesProvider | null = null;

class SandboxRegistry {
  private providers = new Map<ProviderId, SandboxProvider>();

  constructor() {
    // Local provider est toujours disponible
    this.register(new LocalProvider());
  }

  register(provider: SandboxProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): SandboxProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): SandboxProvider[] {
    return Array.from(this.providers.values());
  }

  has(id: ProviderId): boolean {
    return this.providers.has(id);
  }

  /**
   * Crée un provider de manière dynamique (pour éviter les erreurs de bundling).
   */
  async createProvider(id: ProviderId, sessionId?: string): Promise<SandboxProvider> {
    switch (id) {
      case "local":
        return new LocalProvider();
      case "e2b":
        if (!E2BProvider) {
          const mod = await import("./providers/e2b");
          E2BProvider = mod.E2BProvider;
        }
        return new E2BProvider();
      case "vercel":
        if (!VercelProvider) {
          const mod = await import("./providers/vercel");
          VercelProvider = mod.VercelProvider;
        }
        return new VercelProvider();
      case "google-cloud-run":
        if (!GoogleCloudRunProvider) {
          const mod = await import("./providers/google-cloud-run");
          GoogleCloudRunProvider = mod.GoogleCloudRunProvider;
        }
        return new GoogleCloudRunProvider();
      case "github-codespaces":
        if (!GitHubCodespacesProvider) {
          const mod = await import("./providers/github-codespaces");
          GitHubCodespacesProvider = mod.GitHubCodespacesProvider;
        }
        return new GitHubCodespacesProvider();
      default:
        throw new Error(`Provider ${id} not found or not supported.`);
    }
  }
}

export const sandboxRegistry = new SandboxRegistry();
