import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { GitHubRemoteFilesystem } from "@soryos/filesystem";
import type { SessionData } from "@soryos/schema";

/**
 * Importation de fichiers dans une session.
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const path = (formData.get("path") as string | null) || file.name;
    const cleanPath = path
      .replace(/^\/home\/user\//, "")
      .replace(/^home\/user\//, "")
      .replace(/^\.\//, "")
      .replace(/^\/+/, "");

    const content = await file.text();
    const files = { ...session.files, [cleanPath]: content };
    sessionStore.update(id, { files });

    return NextResponse.json({
      success: true,
      path: cleanPath,
      size: content.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
