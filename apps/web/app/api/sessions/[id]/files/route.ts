import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { GitHubRemoteFilesystem } from "@soryos/filesystem";
import type { SessionData } from "@soryos/schema";

/**
 * Gestion des fichiers d'une session.
 * Utilise UNIQUEMENT @soryos/* - Aucune logique métier ici.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session: SessionData | undefined = sessionStore.get(id);

  if (!session) {
    return NextResponse.json({ paths: [] });
  }

  let files = session.files;

  // If session files are empty but session is connected to a remote GitHub Codespace / repo, fetch live
  if (
    Object.keys(files).length === 0 &&
    (session.providerId === "github-codespaces" || session.providerId === "github-repository") &&
    session.repository
  ) {
    try {
      const fs = new GitHubRemoteFilesystem(id, session.repository, session.branch || "main");
      const entries = await fs.listFiles();
      const newFiles: { [key: string]: string } = {};
      for (const entry of entries) {
        if (entry.type === "file") {
          newFiles[entry.path] = "";
        }
      }
      sessionStore.update(id, { files: newFiles });
      files = newFiles;
    } catch (e) {
      console.warn("Auto-sync remote files in files GET warning:", e);
    }
  }

  const paths = Object.keys(files);
  return NextResponse.json({ paths });
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

  try {
    const body = await req.json();
    const { action, path, newPath, content = "" } = body;

    const normalize = (p: string) =>
      p
        .replace(/^\/home\/user\//, "")
        .replace(/^home\/user\//, "")
        .replace(/^\.\//, "")
        .replace(/^\/+/, "");

    const files = { ...session.files };

    if (action === "create_file" && path) {
      const cleanPath = normalize(path);
      files[cleanPath] = content;
      sessionStore.update(id, { files });
      return NextResponse.json({ success: true, path: cleanPath });
    }

    if (action === "create_folder" && path) {
      const cleanPath = normalize(path);
      const placeholder = `${cleanPath}/.gitkeep`;
      files[placeholder] = "";
      sessionStore.update(id, { files });
      return NextResponse.json({ success: true, path: cleanPath });
    }

    if (action === "rename" && path && newPath) {
      const oldClean = normalize(path);
      const newClean = normalize(newPath);

      const isDirectory =
        !files[oldClean] &&
        Object.keys(files).some((p) => p.startsWith(`${oldClean}/`));

      if (isDirectory) {
        const matching = Object.keys(files).filter((p) =>
          p.startsWith(`${oldClean}/`)
        );
        for (const oldKey of matching) {
          const suffix = oldKey.slice(oldClean.length);
          files[`${newClean}${suffix}`] = files[oldKey];
          delete files[oldKey];
        }
      } else {
        const existingContent = files[oldClean] ?? "";
        files[newClean] = existingContent;
        delete files[oldClean];
      }

      sessionStore.update(id, { files });
      return NextResponse.json({ success: true, oldPath: oldClean, newPath: newClean });
    }

    if (action === "delete" && path) {
      const cleanPath = normalize(path);
      delete files[cleanPath];
      const subtreeKeys = Object.keys(files).filter((p) =>
        p.startsWith(`${cleanPath}/`)
      );
      for (const k of subtreeKeys) {
        delete files[k];
      }
      sessionStore.update(id, { files });
      return NextResponse.json({ success: true, deleted: [cleanPath, ...subtreeKeys] });
    }

    if (action === "save" && path) {
      const cleanPath = normalize(path);
      files[cleanPath] = content;
      sessionStore.update(id, { files });
      return NextResponse.json({ success: true, path: cleanPath });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
