import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { GitHubRemoteFilesystem } from "@soryos/filesystem";
import type { SessionData } from "@soryos/schema";

/**
 * Lecture/Écriture d'un fichier spécifique.
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filePath: string[] }> },
) {
  const { id, filePath } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const cleanPath = filePath.join("/")
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  // Try session files first
  if (session.files[cleanPath]) {
    return new NextResponse(session.files[cleanPath], {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // If not found in session files but connected to GitHub, fetch from remote
  if (
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      const content = await fs.readFile(cleanPath);
      const files = { ...session.files, [cleanPath]: content };
      sessionStore.update(id, { files });
      return new NextResponse(content, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (e) {
      console.warn("Remote file read failed, returning session fallback:", e);
    }
  }

  return new NextResponse(`// File not found: ${cleanPath}`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; filePath: string[] }> },
) {
  const { id, filePath } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const cleanPath = filePath.join("/")
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  const content = await req.text();
  const files = { ...session.files, [cleanPath]: content };
  sessionStore.update(id, { files });

  return NextResponse.json({ success: true, path: cleanPath });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; filePath: string[] }> },
) {
  const { id, filePath } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const cleanPath = filePath.join("/")
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");

  const files = { ...session.files };
  delete files[cleanPath];
  sessionStore.update(id, { files });

  return NextResponse.json({ success: true, path: cleanPath });
}
