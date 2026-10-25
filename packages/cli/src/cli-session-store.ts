/**
 * CliSessionStore — persistance DES sessions CLI sur disque (JSON, 1 fichier/session).
 * Réel : écriture/lecture physique sous `<cwd>/.soryos/cli-sessions/`.
 * Hydrate le `sessionStore` global (@soryos/session, in-memory) que le moteur
 * agent lit lui-même ; après chaque run, l'état à jour est ré-écrit sur disque.
 */

import type { SessionData } from "@soryos/schema";
import type { SessionSource } from "@soryos/session";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const CLI_SESSIONS_DIR = ".soryos/cli-sessions";

function sessionsDir(cwd: string = process.cwd()): string {
  return resolve(cwd, CLI_SESSIONS_DIR);
}

function fileFor(id: string, cwd: string = process.cwd()): string {
  // ids toujours sanitaires : pas de path traversal possible
  const safe = id.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(sessionsDir(cwd), `${safe}.json`);
}

function updatedAt(session: SessionData): number {
  const last = session.messages[session.messages.length - 1];
  const ts = last?.created_at ?? session.created_at;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export class CliSessionStore {
  /** Charge une session depuis disque (null si absente/corrompue). */
  async get(id: string, cwd?: string): Promise<SessionData | null> {
    const file = fileFor(id, cwd);
    if (!existsSync(file)) return null;
    try {
      const raw = await readFile(file, "utf8");
      const parsed = JSON.parse(raw) as SessionData;
      if (!parsed || typeof parsed.id !== "string" || !Array.isArray(parsed.messages)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Liste toutes les sessions disque, de la plus récente à la plus ancienne. */
  async list(cwd?: string): Promise<SessionData[]> {
    const dir = sessionsDir(cwd);
    if (!existsSync(dir)) return [];
    const names = await readdir(dir);
    const sessions: SessionData[] = [];
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const session = await this.get(name.replace(/\.json$/, ""), cwd);
      if (session) sessions.push(session);
    }
    return sessions.sort((a, b) => updatedAt(b) - updatedAt(a));
  }

  /** La session la plus récemment active. */
  async newest(cwd?: string): Promise<SessionData | null> {
    const all = await this.list(cwd);
    return all[0] ?? null;
  }

  /** Écriture atomique (tmp + rename) — jamais de fichier partiel. */
  async save(session: SessionData, cwd?: string): Promise<string> {
    const dir = sessionsDir(cwd);
    await mkdir(dir, { recursive: true });
    const file = fileFor(session.id, cwd);
    // Nom de fichier temporaire UNIQUE par écriture : deux écritures
    // concurrentes sur la même session ne peuvent pas s'écraser (rename
    // ENOENT) ni perdre la version la plus récente.
    const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(session, null, 2), "utf8");
      await rename(tmp, file);
    } catch (err) {
      await rm(tmp, { force: true });
      throw err;
    }
    return file;
  }

  /** Supprime une session du disque. */
  async remove(id: string, cwd?: string): Promise<boolean> {
    const file = fileFor(id, cwd);
    if (!existsSync(file)) return false;
    await rm(file, { force: true });
    return true;
  }

  /** Export JSON transportable (session complète). */
  async exportSession(id: string, cwd?: string): Promise<SessionData | null> {
    return this.get(id, cwd);
  }

  /**
   * Import d'un JSON de session. Retourne la session importée, ou null si le
   * JSON est invalide. Un id déjà présent est écrasé (ré-import explicite).
   */
  async importSession(data: unknown, cwd?: string): Promise<SessionData | null> {
    if (!data || typeof data !== "object") return null;
    const candidate = data as Partial<SessionData>;
    if (typeof candidate.id !== "string" || !candidate.id.trim()) return null;
    if (!Array.isArray(candidate.messages)) return null;
    const session: SessionData = {
      ...(candidate as SessionData),
      messages: candidate.messages.filter((m) => m && typeof m === "object"),
    };
    await this.save(session, cwd);
    return session;
  }
}

export const cliSessionStore = new CliSessionStore();

/**
 * Adaptateur `SessionSource` du store disque — permet d'utiliser la résolution
 * partagée (`resolveSessionTarget` de @soryos/session) avec les sessions CLI.
 */
export const cliSessionSource: SessionSource = {
  async get(id: string): Promise<SessionData | null> {
    return cliSessionStore.get(id);
  },
  async list(): Promise<SessionData[]> {
    return cliSessionStore.list();
  },
  create(data: Partial<SessionData>): SessionData {
    const id = data.id ?? `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: SessionData = {
      id,
      title: data.title ?? "CLI Session",
      sandbox_id: data.sandbox_id ?? `sandbox-${id}`,
      sandbox_state: data.sandbox_state ?? "running",
      environment: data.environment ?? "local",
      providerId: data.providerId ?? "local",
      model: data.model ?? "gemini-2.5-flash",
      provider: data.provider ?? "Google Gemini",
      created_at: data.created_at ?? new Date().toISOString(),
      messages: data.messages ?? [],
      files: data.files ?? {},
      openFiles: data.openFiles ?? [],
      activeFile: data.activeFile ?? "",
      preview_url: data.preview_url ?? null,
      needs_run: data.needs_run ?? false,
      agent_running: data.agent_running ?? false,
      cwd: data.cwd ?? process.cwd(),
      ...data,
    };
    return session;
  },
  async persist(session: SessionData): Promise<void> {
    await cliSessionStore.save(session);
  },
};
