import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { sandboxManager } from "@soryos/sandbox";
import { gitManager } from "@soryos/git";
import type { ExecutionProvider } from "@soryos/execution";
import type { SessionData, ProviderId } from "@soryos/schema";

/**
 * Git synchronisation for session environment transitions.
 * GET  → real git status of the active execution provider
 * POST → commit_and_push | sync_cloud (real git operations, honest errors)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  try {
    const providerId: ProviderId = session.providerId || "local";
    const { provider } = await sandboxManager.getOrCreateSandbox(id, providerId);
    const exec = provider as unknown as ExecutionProvider;

    const status = await gitManager.getStatus(exec);
    const head = await provider.executeCommand("git rev-parse --short HEAD");
    const uncommittedFilesCount = status.modifiedFiles.length + status.untrackedFiles.length;

    return NextResponse.json({
      gitStatus: {
        isClean: status.isClean,
        currentBranch: status.branch,
        currentCommit: head.exitCode === 0 ? head.stdout.trim() : "none",
        uncommittedFilesCount,
      },
    });
  } catch (e) {
    return NextResponse.json({
      gitStatus: null,
      error: e instanceof Error ? e.message : "Impossible de lire le statut git",
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const providerId: ProviderId = body.providerId || session.providerId || "local";

  try {
    if (action === "commit_and_push") {
      const { provider } = await sandboxManager.getOrCreateSandbox(
        id,
        session.providerId || "local"
      );
      const exec = provider as unknown as ExecutionProvider;

      const status = await gitManager.getStatus(exec);
      let committed = false;

      if (!status.isClean) {
        const message =
          typeof body.commitMessage === "string" && body.commitMessage.trim()
            ? body.commitMessage.trim()
            : "soryos-code: checkpoint";
        committed = await gitManager.commit(exec, message);
        if (!committed) {
          return NextResponse.json(
            { error: "Le commit git a échoué sur le provider actif" },
            { status: 400 }
          );
        }
      }

      const remote = await provider.executeCommand("git remote get-url origin");
      if (remote.exitCode !== 0) {
        return NextResponse.json(
          {
            error:
              "Aucun remote « origin » configuré sur ce workspace — impossible de pusher. Ajoutez un remote GitHub ou utilisez « Changer directement ».",
          },
          { status: 400 }
        );
      }

      const push = await provider.executeCommand("git push -u origin HEAD");
      if (push.exitCode !== 0) {
        return NextResponse.json(
          { error: `git push a échoué : ${push.stderr || push.stdout}`.slice(0, 500) },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, committed });
    }

    if (action === "sync_cloud") {
      if (providerId === "local") {
        return NextResponse.json({ success: true, message: "Cible locale, rien à synchroniser" });
      }
      if (!session.repository && !session.codespaceId) {
        return NextResponse.json(
          {
            error:
              "Aucun dépôt lié à cette session — sélectionnez d'abord un repository GitHub dans le sélecteur d'environnement.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ success: true, repository: session.repository });
    }

    return NextResponse.json({ error: `Action inconnue : ${action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur git inconnue" },
      { status: 500 }
    );
  }
}
