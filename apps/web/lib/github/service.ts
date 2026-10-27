import { credentialManager } from "../credentials/manager";

let instance: GitHubService | null = null;

class GitHubService {
  private token: string = "";
  private userAccount: { connected: boolean; username?: string; name?: string; avatarUrl?: string; scopes?: string[] } = { connected: false };

  constructor(token: string) {
    this.token = token;
    if (token && token !== "TODO" && token !== "AIzaSyDummyKeyForStudioPreview") {
      this.verifyAndStoreToken("session", token).catch(() => {});
    }
  }

  getToken(): string {
    return this.token;
  }

  setToken(token: string) {
    this.token = token;
    if (token && !this.userAccount.connected) {
      this.verifyAndStoreToken("session", token).catch(() => {});
    }
  }

  getAccountState(sessionId: string) {
    return this.userAccount;
  }

  async verifyAndStoreToken(sessionId: string, token: string) {
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });

      if (!res.ok) {
        throw new Error(`Token GitHub invalide (HTTP ${res.status})`);
      }

      const user = await res.json();
      const scopes = res.headers.get("x-oauth-scopes")?.split(",").map(s => s.trim()) || ["repo", "codespace", "read:user"];

      this.token = token;
      this.userAccount = {
        connected: true,
        username: user.login,
        name: user.name || user.login,
        avatarUrl: user.avatar_url,
        scopes,
      };

      // Store in process.env so exec / gh-cli layer can immediately access it
      process.env.GITHUB_TOKEN = token;
      process.env.GH_TOKEN = token;

      // Store globally (no session scope) so every server module that resolves
      // "github-codespaces" (remote filesystem, codespace exec) finds the token.
      credentialManager.saveCredentials("github-codespaces", { apiKey: token });
      void credentialManager.persist("github-codespaces", { apiKey: token }).catch(() => {});

      return this.userAccount;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Échec de l'authentification GitHub: ${msg}`);
    }
  }

  disconnectAccount(sessionId: string) {
    this.token = "";
    this.userAccount = { connected: false };
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    credentialManager.deleteCredentials("github-codespaces");
    void credentialManager.remove("github-codespaces").catch(() => {});
  }

  async listRepositories(sessionId: string) {
    if (!this.token || !this.userAccount.connected) {
      return [];
    }
    try {
      const res = await fetch("https://api.github.com/user/repos?per_page=50&sort=updated", {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });
      if (!res.ok) return [];
      const repos = await res.json();
      return repos.map((r: any) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        description: r.description,
        defaultBranch: r.default_branch || "main",
        htmlUrl: r.html_url,
      }));
    } catch {
      return [];
    }
  }

  async listBranches(sessionId: string, repo: string) {
    if (!this.token) return [];
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/branches?per_page=30`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });
      if (!res.ok) return [{ name: "main", commitHash: "HEAD", isDefault: true }];
      const branches = await res.json();
      return branches.map((b: any, idx: number) => ({
        name: b.name,
        commitHash: b.commit?.sha || "HEAD",
        isDefault: idx === 0 || b.name === "main" || b.name === "master",
      }));
    } catch {
      return [{ name: "main", commitHash: "HEAD", isDefault: true }];
    }
  }

  async listCodespaces(sessionId: string, repo?: string) {
    if (!this.token) return [];
    try {
      const url = repo 
        ? `https://api.github.com/repos/${repo}/codespaces` 
        : `https://api.github.com/user/codespaces`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      });
      if (!res.ok) return [];
      const data = await res.json();
      const items = data.codespaces || data.items || (Array.isArray(data) ? data : []);
      return items.map((cs: any) => ({
        id: cs.name || String(cs.id),
        name: cs.name,
        displayName: cs.display_name || cs.name,
        state: cs.state || "Running",
        repositoryName: cs.repository?.full_name || repo || "repository",
        branch: cs.git_status?.ref || "main",
        webUrl: cs.web_url,
      }));
    } catch {
      return [];
    }
  }

  async createRepository(sessionId: string, name: string, description: string, isPrivate: boolean) {
    if (!this.token) throw new Error("Non authentifié sur GitHub");
    const res = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SoryOS-Code-IDE",
      },
      body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Échec de création du dépôt GitHub");
    }
    const r = await res.json();
    return {
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      htmlUrl: r.html_url,
    };
  }

  async createCodespace(sessionId: string, repo: string, branch: string = "main", machine?: string) {
    if (!this.token) throw new Error("Non authentifié sur GitHub");
    const payload: Record<string, string> = { ref: branch };
    if (machine && machine.trim() && machine !== "standardLinux32gb") {
      payload.machine = machine.trim();
    }
    const res = await fetch(`https://api.github.com/repos/${repo}/codespaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SoryOS-Code-IDE",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API: création du Codespace refusée (HTTP ${res.status})`);
    }
    const cs = await res.json();
    return {
      id: cs.name || String(cs.id),
      name: cs.name,
      state: cs.state || "Provisioning",
      repositoryName: repo,
      branch,
      webUrl: cs.web_url,
    };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __soryos_github_service: GitHubService | undefined;
}

export function getGitHubService(): GitHubService {
  if (globalThis.__soryos_github_service) {
    const existing = globalThis.__soryos_github_service;
    if (!existing.getToken()) {
      const config = credentialManager.getCredentials("github-codespaces");
      const token = (config && config.apiKey) ? config.apiKey : (process.env.GITHUB_TOKEN || "");
      if (token) existing.setToken(token);
    }
    return existing;
  }
  const config = credentialManager.getCredentials("github-codespaces"); 
  const token = (config && config.apiKey) ? config.apiKey : (process.env.GITHUB_TOKEN || "");
  const instance = new GitHubService(token);
  globalThis.__soryos_github_service = instance;
  return instance;
}
