import { credentialManager } from "@soryos/credentials";

export interface RemoteFileEntry {
  path: string;
  name: string;
  type: "file" | "directory";
  size?: number;
  sha?: string;
}

export interface RemoteFilesystemProvider {
  listFiles(dirPath?: string): Promise<RemoteFileEntry[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string, message?: string): Promise<void>;
  createFile(filePath: string, content: string, message?: string): Promise<void>;
  createDirectory(dirPath: string): Promise<void>;
  deleteFile(filePath: string, message?: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
}

export class GitHubRemoteFilesystem implements RemoteFilesystemProvider {
  constructor(
    private sessionId: string,
    private repository: string,
    private branch: string = "main"
  ) {}

  private getToken(): string {
    // The web GitHubService stores the verified token in @soryos/credentials
    // under "github-codespaces"; fall back to env vars.
    const resolved = credentialManager.resolveCredentials("github-codespaces", this.sessionId);
    const token =
      resolved?.apiKey ||
      process.env.GITHUB_TOKEN ||
      process.env.GITHUB_PAT ||
      "";
    if (!token) throw new Error("Compte GitHub non connecté");
    return token;
  }

  private headers(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "SoryOS-Code-IDE",
    };
  }

  /** Resolves the real default branch when the requested one doesn't exist (main vs master). */
  private async resolveBranch(token: string): Promise<string> {
    const repo = this.repository.trim();
    const check = await fetch(
      `https://api.github.com/repos/${repo}/branches/${encodeURIComponent(this.branch)}`,
      { headers: this.headers(token) },
    );
    if (check.ok) return this.branch;
    const info = await fetch(`https://api.github.com/repos/${repo}`, { headers: this.headers(token) });
    if (!info.ok) {
      throw new Error(`Dépôt GitHub inaccessible (${info.status}) : ${repo}`);
    }
    const data = await info.json();
    if (data.default_branch) this.branch = data.default_branch;
    return this.branch;
  }

  getBranch(): string {
    return this.branch;
  }

  // List all real files and directories using GitHub Git Trees API
  async listFiles(dirPath: string = ""): Promise<RemoteFileEntry[]> {
    const token = this.getToken();
    const cleanRepo = this.repository.trim();
    await this.resolveBranch(token);

    try {
      // 1. Try recursive Git Trees API for complete repository tree
      const treeRes = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "SoryOS-Code-IDE",
          },
        }
      );

      if (treeRes.ok) {
        const data = await treeRes.json();
        if (Array.isArray(data.tree)) {
          return data.tree.map((item: { path: string; type: string; size?: number; sha?: string }) => ({
            path: item.path,
            name: item.path.split("/").pop() || item.path,
            type: item.type === "tree" ? ("directory" as const) : ("file" as const),
            size: item.size,
            sha: item.sha,
          }));
        }
      }

      // 2. Fallback to Contents API for specific directory
      const cleanPath = dirPath.replace(/^\//, "");
      const contentsRes = await fetch(
        `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${encodeURIComponent(this.branch)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "SoryOS-Code-IDE",
          },
        }
      );

      if (contentsRes.ok) {
        const items = await contentsRes.json();
        if (Array.isArray(items)) {
          return items.map((i: { path: string; name: string; type: string; size?: number; sha?: string }) => ({
            path: i.path,
            name: i.name,
            type: i.type === "dir" ? ("directory" as const) : ("file" as const),
            size: i.size,
            sha: i.sha,
          }));
        }
      }

      throw new Error(
        `Impossible de lister les fichiers (${treeRes.status}/${contentsRes.status}) sur ${cleanRepo}@${this.branch}`,
      );
    } catch (e) {
      console.error("Failed to list remote files from GitHub:", e);
      throw e;
    }
  }

  // Read actual file content from GitHub
  async readFile(filePath: string): Promise<string> {
    const token = this.getToken();
    const cleanRepo = this.repository.trim();
    const cleanPath = filePath.replace(/^\//, "").replace(/^\.\//, "");

    const res = await fetch(
      `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${encodeURIComponent(this.branch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Fichier introuvable sur GitHub (${res.status}): ${filePath}`);
    }

    const data = await res.json();

    if (data.content && data.encoding === "base64") {
      // Decode base64 UTF-8 cleanly
      const raw = atob(data.content.replace(/\n/g, ""));
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    if (data.download_url) {
      const rawRes = await fetch(data.download_url);
      if (rawRes.ok) return rawRes.text();
    }

    return "";
  }

  // Write / modify file in remote repository
  async writeFile(filePath: string, content: string, message?: string): Promise<void> {
    const token = this.getToken();
    const cleanRepo = this.repository.trim();
    const cleanPath = filePath.replace(/^\//, "").replace(/^\.\//, "");

    // 1. Get current SHA if file exists
    let sha: string | undefined;
    try {
      const checkRes = await fetch(
        `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${encodeURIComponent(this.branch)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "SoryOS-Code-IDE",
          },
        }
      );
      if (checkRes.ok) {
        const existing = await checkRes.json();
        sha = existing.sha;
      }
    } catch {
      // file might be new
    }

    // 2. Base64 encode UTF-8 content
    const utf8Bytes = new TextEncoder().encode(content);
    let binary = "";
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const base64Content = btoa(binary);

    // 3. Commit file via GitHub API
    const commitMsg = message || `Update ${cleanPath} via SoryOS-Code`;
    const putRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "SoryOS-Code-IDE",
        },
        body: JSON.stringify({
          message: commitMsg,
          content: base64Content,
          branch: this.branch,
          ...(sha ? { sha } : {}),
        }),
      }
    );

    if (!putRes.ok) {
      const err = await putRes.text().catch(() => "");
      throw new Error(`Échec de l'écriture sur GitHub (${putRes.status}): ${err}`);
    }
  }

  async createFile(filePath: string, content: string, message?: string): Promise<void> {
    return this.writeFile(filePath, content, message || `Create ${filePath} via SoryOS-Code`);
  }

  async createDirectory(dirPath: string): Promise<void> {
    const keepPath = `${dirPath.replace(/\/$/, "")}/.gitkeep`;
    return this.createFile(keepPath, "", "Create directory via SoryOS-Code");
  }

  async deleteFile(filePath: string, message?: string): Promise<void> {
    const token = this.getToken();
    const cleanRepo = this.repository.trim();
    const cleanPath = filePath.replace(/^\//, "").replace(/^\.\//, "");

    const checkRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}?ref=${encodeURIComponent(this.branch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "SoryOS-Code-IDE",
        },
      }
    );

    if (!checkRes.ok) return;
    const existing = await checkRes.json();

    await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${cleanPath}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "SoryOS-Code-IDE",
      },
      body: JSON.stringify({
        message: message || `Delete ${cleanPath} via SoryOS-Code`,
        sha: existing.sha,
        branch: this.branch,
      }),
    });
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const content = await this.readFile(oldPath);
    await this.writeFile(newPath, content, `Rename ${oldPath} to ${newPath}`);
    await this.deleteFile(oldPath, `Remove old file ${oldPath} after rename`);
  }
}
