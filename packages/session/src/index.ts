
import { SessionData, ProviderId } from "@soryos/schema";
import type { SessionSource } from "./target";

export * from "./target";

declare global {
  // Survives Next.js route-bundle module duplication (dev + prod chunks)
  var __soryos_sessions_store: Map<string, SessionData> | undefined;
}

let sessions: Map<string, SessionData> =
  globalThis.__soryos_sessions_store ?? new Map<string, SessionData>();
globalThis.__soryos_sessions_store = sessions;

export class SessionStore {
  create(sessionData: Partial<SessionData>): SessionData {
    const newSession: SessionData = {
      id: sessionData.id || crypto.randomUUID(),
      title: sessionData.title || "Untitled Session",
      sandbox_id: sessionData.sandbox_id || "",
      sandbox_state: sessionData.sandbox_state || "dead",
      environment: sessionData.environment || "local",
      providerId: sessionData.providerId || "local",
      model: sessionData.model || "gemini-3.8-flash",
      provider: sessionData.provider || "google",
      created_at: new Date().toISOString(),
      messages: [],
      files: {},
      openFiles: [],
      activeFile: "",
      preview_url: null,
      needs_run: false,
      agent_running: false,
      cwd: "/",
      ...sessionData,
    };
    sessions.set(newSession.id, newSession);
    return newSession;
  }

  get(sessionId: string): SessionData | undefined {
    return sessions.get(sessionId);
  }

  getOrCreate(sessionId: string): SessionData {
    let session = this.get(sessionId);
    if (!session) {
        session = this.create({ id: sessionId });
    }
    return session;
  }

  update(sessionId: string, sessionData: Partial<SessionData>): SessionData {
    const existingSession = this.get(sessionId);
    if (!existingSession) {
      throw new Error(`Session with id ${sessionId} not found`);
    }
    const updatedSession = { ...existingSession, ...sessionData };
    sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  save(sessionData: SessionData): SessionData {
      return this.update(sessionData.id, sessionData);
  }

  delete(sessionId: string): void {
    sessions.delete(sessionId);
  }

  getAll(): SessionData[] {
    return Array.from(sessions.values());
  }

  list(): SessionData[] {
      return this.getAll();
  }
}

export const sessionStore = new SessionStore();

/**
 * Adaptateur `SessionSource` du store in-memory — permet d'utiliser la
 * résolution partagée (`resolveSessionTarget`) avec le store par défaut.
 */
export const memorySessionSource: SessionSource = {
  async get(id: string): Promise<SessionData | null> {
    return sessionStore.get(id) ?? null;
  },
  async list(): Promise<SessionData[]> {
    return sessionStore.getAll();
  },
  create(data: Partial<SessionData>): SessionData {
    return sessionStore.create(data);
  },
};
