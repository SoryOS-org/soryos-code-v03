import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { sandboxManager } from "@soryos/sandbox";
import type { SessionData, ProviderId } from "@soryos/schema";

/**
 * Gestion des sessions (GET, PATCH, DELETE).
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
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

  return NextResponse.json({
    id: session.id,
    title: session.title,
    sandbox_id: session.sandbox_id,
    sandbox_state: session.sandbox_state,
    environment: session.environment || (session.providerId === "local" ? "local" : "sandbox"),
    providerId: session.providerId || "local",
    codespaceId: session.codespaceId,
    repository: session.repository,
    branch: session.branch,
    workspaceState: session.workspaceState || "WORKSPACE_READY",
    workspaceError: session.workspaceError,
    cwd: session.cwd,
    model: session.model,
    provider: session.provider,
    messages: session.messages,
    files: session.files || {},
    openFiles: session.openFiles || [],
    activeFile: session.activeFile || "",
    preview_url: session.preview_url,
    needs_run: session.needs_run,
    agent_running: session.agent_running,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));

  const updatedSession: Partial<SessionData> = {};

  // Update session properties
  if (body.title && typeof body.title === "string") {
    updatedSession.title = body.title.trim();
  }

  if (body.codespaceId) updatedSession.codespaceId = body.codespaceId;
  if (body.repository) updatedSession.repository = body.repository;
  if (body.branch) updatedSession.branch = body.branch;
  if (body.workspaceState) updatedSession.workspaceState = body.workspaceState;
  if (body.workspaceError) updatedSession.workspaceError = body.workspaceError;
  
  if (body.environment) {
    updatedSession.environment = body.environment as "sandbox" | "local";
    if (updatedSession.environment === "local") {
      updatedSession.providerId = "local";
    }
  }

  if (body.providerId) {
    const newProviderId = body.providerId as ProviderId;
    updatedSession.providerId = newProviderId;
    updatedSession.environment = newProviderId === "local" ? "local" : "sandbox";
  }

  // Switch sandbox provider if needed (only if providerId is explicitly set and not local)
  if (updatedSession.providerId && updatedSession.providerId !== "local") {
    try {
      const { sandboxId } = await sandboxManager.switchProvider(id, updatedSession.providerId);
      updatedSession.sandbox_id = sandboxId;
    } catch {
      // ignore
    }
  }

  // Save session
  const finalSession = sessionStore.update(id, updatedSession);

  return NextResponse.json({
    id: finalSession.id,
    title: finalSession.title,
    environment: finalSession.environment,
    providerId: finalSession.providerId,
    sandbox_id: finalSession.sandbox_id,
    codespaceId: finalSession.codespaceId,
    repository: finalSession.repository,
    branch: finalSession.branch,
    workspaceState: finalSession.workspaceState,
    cwd: finalSession.cwd,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  sessionStore.delete(id);
  return NextResponse.json({ success: true, id });
}
