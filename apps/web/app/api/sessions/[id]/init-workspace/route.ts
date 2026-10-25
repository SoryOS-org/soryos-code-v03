import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { sandboxManager } from "@soryos/sandbox";
import { GitHubRemoteFilesystem } from "@soryos/filesystem";
import { credentialManager } from "@/lib/credentials/manager";
import type { SessionData, ProviderId } from "@soryos/schema";

/**
 * Initialisation du workspace pour une session.
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const overrides = {
      codespaceId: body.codespaceId,
      repository: body.repository,
      branch: body.branch,
      providerId: body.providerId as ProviderId | undefined,
    };

    // Determine target provider: overrides first, then session.providerId, fallback to "local"
    const targetProviderId: ProviderId = overrides.providerId || session.providerId || "local";
    session.providerId = targetProviderId;
    if (overrides.repository) session.repository = overrides.repository;
    if (overrides.branch) session.branch = overrides.branch;
    if (overrides.codespaceId) session.codespaceId = overrides.codespaceId;
    session.environment = targetProviderId === "local" ? "local" : "sandbox";

    // Initialize workspace with target provider
    const ws = workspaceManager.getOrCreateWorkspace(id, {
      environment: session.environment,
      providerId: targetProviderId,
      repository: overrides.repository,
      branch: overrides.branch,
    });
    ws.providerId = targetProviderId;

    // Initialize sandbox for target provider (NEVER call E2B when targetProviderId is github-codespaces or local!)
    let providerOptions:
      | { token?: string; owner?: string; repo?: string; branch?: string; codespaceName?: string }
      | undefined;
    const targetRepo = overrides.repository || session.repository;
    if (targetProviderId === "github-codespaces") {
      const ghCreds = credentialManager.getCredentials("github-codespaces");
      const ghToken = ghCreds?.apiKey || process.env.GITHUB_TOKEN;
      if (ghToken) {
        // Make the token + gh CLI available to the codespaces provider / exec layer
        process.env.GITHUB_TOKEN = ghToken;
        process.env.GH_TOKEN = ghToken;
        if (!process.env.GH_CLI_PATH) {
          process.env.GH_CLI_PATH = "/tmp/opencode/gh";
        }
        // Bundled ssh/ssh-keygen live next to the gh binary (see /tmp/opencode/bin)
        if (!process.env.PATH?.includes("/tmp/opencode/bin")) {
          process.env.PATH = `/tmp/opencode/bin:${process.env.PATH ?? ""}`;
        }
      }
      if (targetRepo) {
        const [owner, repoName] = targetRepo.split("/");
        providerOptions = {
          token: ghToken,
          owner,
          repo: repoName,
          branch: overrides.branch || session.branch || "main",
          codespaceName: overrides.codespaceId || session.codespaceId,
        };
      }
    }
    const { sandboxId } = await sandboxManager.getOrCreateSandbox(
      id,
      targetProviderId,
      providerOptions
    );
    session.sandbox_id = sandboxId;

    // If GitHub repository, sync the file tree (contents are loaded lazily on open)
    let syncError: string | undefined;
    const repo = overrides.repository || session.repository;
    if (repo && (ws.providerId === "github-codespaces" || ws.providerId === "github-repository")) {
      try {
        const fs = new GitHubRemoteFilesystem(id, repo, overrides.branch || session.branch || "main");
        const entries = await fs.listFiles();
        session.branch = fs.getBranch();
        for (const entry of entries) {
          if (entry.type === "file" && !(entry.path in session.files)) {
            session.files[entry.path] = "";
          }
        }
      } catch (e) {
        syncError = e instanceof Error ? e.message : String(e);
        console.warn("GitHub file sync error:", e);
      }
    }

    session.workspaceState = "WORKSPACE_READY";
    sessionStore.save(session);

    return NextResponse.json({
      success: true,
      sandboxId,
      paths: Object.keys(session.files),
      filesCount: Object.keys(session.files).length,
      branch: session.branch,
      ...(syncError ? { syncError } : {}),
    });
  } catch (err) {
    session.workspaceState = "WORKSPACE_ERROR";
    session.workspaceError = err instanceof Error ? err.message : "Initialization failed";
    sessionStore.save(session);

    return NextResponse.json(
      { error: session.workspaceError },
      { status: 500 }
    );
  }
}
