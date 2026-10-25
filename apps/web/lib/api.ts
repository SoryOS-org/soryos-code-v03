import type { SoryOSEvent, GetSessionResponse } from "./types";

function getApiBase(): string {
  // In the browser, always use relative URLs to avoid CORS and wrong ports (e.g. localhost:8000)
  if (typeof window !== "undefined") {
    return "";
  }
  // Server-side SSR requests
  const port = process.env.PORT || 3000;
  return `http://127.0.0.1:${port}`;
}

export async function createSession(
  title?: string,
  message?: string,
  model?: string,
  providerId?: string,
  environment?: string,
  extra?: Record<string, any>
): Promise<{ id: string; title: string }> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/sessions`, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, message, model, providerId, environment, ...extra }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Impossible de créer le projet (${res.status}).`);
  if (typeof data.id !== "string" || !data.id) {
    throw new Error("La création du projet n’a pas renvoyé de session valide. Réessayez.");
  }
  return data;
}

export async function listSessions(): Promise<
  Array<{ id: string; title: string; created_at: string }>
> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: Array<{ id: string; title: string; created_at: string }> };
    return data.sessions ?? [];
  } catch (err) {
    console.warn("Failed to list sessions:", err);
    return [];
  }
}

export async function getSession(id: string): Promise<GetSessionResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/sessions/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get session: ${res.statusText}`);
  return res.json();
}

export async function abortSession(id: string): Promise<void> {
  const base = getApiBase();
  await fetch(`${base}/api/sessions/${id}/abort`, { method: "POST" }).catch(() => {});
}

export async function listSessionFiles(sessionId: string): Promise<string[]> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions/${sessionId}/files`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { paths: string[] };
    return data.paths ?? [];
  } catch (err) {
    console.warn("Failed to list session files:", err);
    return [];
  }
}

export async function fetchFile(
  sessionId: string,
  path: string,
): Promise<string> {
  const base = getApiBase();
  const cleanPath = path
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  try {
    const res = await fetch(
      `${base}/api/sessions/${sessionId}/files/${cleanPath}`,
    );
    if (!res.ok) return `// File not found: ${path}`;
    return res.text();
  } catch (err) {
    console.warn("fetchFile error:", err);
    return `// Error loading file: ${path}`;
  }
}

export async function saveFile(
  sessionId: string,
  path: string,
  content: string,
): Promise<boolean> {
  const base = getApiBase();
  const cleanPath = path
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  try {
    const res = await fetch(
      `${base}/api/sessions/${sessionId}/files/${cleanPath}`,
      {
        method: "PUT",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: content,
      },
    );
    return res.ok;
  } catch (err) {
    console.error("saveFile error:", err);
    return false;
  }
}

export async function createProjectFile(
  sessionId: string,
  path: string,
  content: string = "",
): Promise<boolean> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/sessions/${sessionId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_file", path, content }),
    });
    return res.ok;
  } catch (err) {
    console.error("createProjectFile error:", err);
    return false;
  }
}

export async function deleteProjectFile(
  sessionId: string,
  path: string,
): Promise<boolean> {
  const base = getApiBase();
  const cleanPath = path
    .replace(/^\/home\/user\//, "")
    .replace(/^home\/user\//, "")
    .replace(/^\.\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  try {
    const res = await fetch(
      `${base}/api/sessions/${sessionId}/files/${cleanPath}`,
      {
        method: "DELETE",
      },
    );
    return res.ok;
  } catch (err) {
    console.error("deleteProjectFile error:", err);
    return false;
  }
}

export async function ensurePreview(
  sessionId: string,
): Promise<{ preview_url: string | null; status: string; output?: string | null }> {
  try {
    const base = getApiBase();
    const res = await fetch(`${base}/api/sessions/${sessionId}/preview`);
    if (!res.ok) {
      return { preview_url: `/api/preview/${sessionId}`, status: "ready", output: null };
    }
    return res.json();
  } catch {
    return { preview_url: `/api/preview/${sessionId}`, status: "ready", output: null };
  }
}

export async function runTerminal(
  sessionId: string,
  command: string,
): Promise<{ output: string; isError: boolean; cwd: string }> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/sessions/${sessionId}/terminal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error(`Terminal error: ${res.statusText}`);
  return res.json();
}

function parseSseChunk(raw: string): SoryOSEvent | null {
  const normalized = raw.replace(/\r/g, "");
  for (const line of normalized.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") return null;
    try {
      return JSON.parse(payload) as SoryOSEvent;
    } catch {
      return null;
    }
  }
  return null;
}

async function consumeSse(
  url: string,
  init: RequestInit,
  onEvent: (event: SoryOSEvent) => void,
): Promise<"streamed" | "already_running"> {
  const res = await fetch(url, init);
  if (res.status === 409) return "already_running";
  if (!res.ok) throw new Error(`Agent error: ${res.statusText}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const event = parseSseChunk(part);
      if (event) onEvent(event);
    }
  }

  const tail = parseSseChunk(buffer);
  if (tail) onEvent(tail);
  return "streamed";
}

/** Resume agent on the last saved user message (no duplicate insert). */
export async function streamRun(
  sessionId: string,
  onEvent: (event: SoryOSEvent) => void,
): Promise<"streamed" | "already_running"> {
  const base = getApiBase();
  return consumeSse(
    `${base}/api/sessions/${sessionId}/run`,
    { method: "POST" },
    onEvent,
  );
}

/** New user turn: persist message then stream agent. */
export async function sendMessage(
  sessionId: string,
  content: string,
  onEvent: (event: SoryOSEvent) => void,
  model?: string,
  agent?: string,
): Promise<"streamed" | "already_running"> {
  const base = getApiBase();
  return consumeSse(
    `${base}/api/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, model, agent }),
    },
    onEvent,
  );
}

// Workspace File Operations (used by PreviewPanel / File Explorer)
export async function saveWorkspaceFile(
  sessionId: string,
  path: string,
  content: string,
): Promise<boolean> {
  return saveFile(sessionId, path, content);
}

export async function createWorkspaceFile(
  sessionId: string,
  path: string,
  content: string = "",
): Promise<boolean> {
  return createProjectFile(sessionId, path, content);
}

export async function createWorkspaceFolder(
  sessionId: string,
  path: string,
): Promise<boolean> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/sessions/${sessionId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create_folder", path }),
    });
    return res.ok;
  } catch (err) {
    console.error("createWorkspaceFolder error:", err);
    return false;
  }
}

export async function renameWorkspacePath(
  sessionId: string,
  oldPath: string,
  newPath: string,
): Promise<boolean> {
  const base = getApiBase();
  try {
    const res = await fetch(`${base}/api/sessions/${sessionId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "rename", oldPath, newPath }),
    });
    return res.ok;
  } catch (err) {
    console.error("renameWorkspacePath error:", err);
    return false;
  }
}

export async function deleteWorkspacePath(
  sessionId: string,
  path: string,
): Promise<boolean> {
  return deleteProjectFile(sessionId, path);
}

