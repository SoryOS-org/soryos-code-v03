import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { devRunner } from "@soryos/dev-runner";

/**
 * API Route pour récupérer ou initialiser la preview d'une session.
 * Utilise désormais le PreviewManager pour une détection réelle du serveur dev.
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
    // On demande au devRunner d'assurer que la preview est prête sur le port 3000 (standard Next/Vite)
    const preview = await devRunner.previewManager.ensurePreview({
      sessionId: id,
      port: 3000,
      path: '/'
    });

    return NextResponse.json({
      preview_url: preview.url,
      status: "ready",
      port: preview.port,
      tunnelType: preview.tunnelType
    });
  } catch (error) {
    console.error("[Preview API] Erreur lors de la détection du serveur:", error);
    
    // Fallback sur la page de preview statique générée si le serveur réel n'est pas encore là
    return NextResponse.json({
      preview_url: `/api/preview/${id}`,
      status: "fallback",
      message: error instanceof Error ? error.message : "Serveur dev non détecté"
    });
  }
}
