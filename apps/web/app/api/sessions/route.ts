import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import type { SessionData, ProviderId } from "@soryos/schema";

/**
 * Gestion des sessions (GET, POST).
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
 */
export async function GET() {
  const sessions = sessionStore.getAll();
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Créer une nouvelle session via @soryos/session
    const id = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Determine provider and environment (defaults to local, never force e2b unless requested)
    const providerId: ProviderId = body.providerId || "local";
    const environment = body.environment || (providerId === "local" ? "local" : "sandbox");

    // Créer le workspace
    workspaceManager.getOrCreateWorkspace(id, {
      environment,
      providerId,
      repository: body.repository,
      branch: body.branch,
    });
    
    // Créer la session
    const session: SessionData = {
      id,
      title: body.title || "New Session",
      sandbox_id: `sandbox-${id}`,
      sandbox_state: "running",
      environment,
      providerId,
      codespaceId: body.codespaceId,
      repository: body.repository,
      branch: body.branch,
      model: body.model || "deepseek-chat",
      provider: "DeepSeek",
      created_at: new Date().toISOString(),
      messages: [],
      files: {},
      openFiles: [],
      activeFile: "",
      preview_url: null,
      needs_run: false,
      agent_running: false,
      cwd: providerId === "local" ? (typeof process !== "undefined" && process.cwd ? process.cwd() : "/app/applet") : "/home/user",
    };
    
    // Ajouter le message initial si fourni
    if (body.message) {
      session.messages.push({
        id: crypto.randomUUID(),
        role: "user",
        content: body.message,
        created_at: new Date().toISOString(),
      });
    }
    
    sessionStore.create(session);
    
    return NextResponse.json({
      id: session.id,
      title: session.title,
      sandbox_id: session.sandbox_id,
      model: session.model,
      provider: session.provider,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create session" },
      { status: 500 },
    );
  }
}
