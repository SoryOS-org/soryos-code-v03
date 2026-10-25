import { describe, it, expect, beforeEach } from "vitest";
import { SessionData } from "@soryos/schema";
import {
  resolveSessionTarget,
  newestSession,
  defaultSessionId,
  type SessionSource,
} from "../src/target";

/** Store in-memory de test (implémente le contrat SessionSource). */
class FakeSource implements SessionSource {
  private sessions = new Map<string, SessionData>();
  private counter = 0;

  async get(id: string): Promise<SessionData | null> {
    return this.sessions.get(id) ?? null;
  }

  async list(): Promise<SessionData[]> {
    return Array.from(this.sessions.values());
  }

  create(data: Partial<SessionData>): SessionData {
    this.counter++;
    const id = data.id ?? `sess-${this.counter}`;
    const session: SessionData = {
      id,
      title: data.title ?? "Session",
      sandbox_id: `sandbox-${id}`,
      sandbox_state: "running",
      environment: "local",
      providerId: "local",
      model: data.model ?? "gemini-2.5-flash",
      provider: data.provider ?? "Google Gemini",
      created_at: data.created_at ?? new Date().toISOString(),
      messages: data.messages ?? [],
      files: {},
      openFiles: [],
      activeFile: "",
      preview_url: null,
      needs_run: false,
      agent_running: false,
      cwd: data.cwd ?? "/tmp",
      ...data,
    };
    this.sessions.set(id, session);
    return session;
  }
}

function msg(content: string, at: string) {
  return { id: `m-${at}`, role: "user" as const, content, created_at: at };
}

describe("resolveSessionTarget", () => {
  let source: FakeSource;

  beforeEach(() => {
    source = new FakeSource();
  });

  it("creates a new session by default", async () => {
    const { target, session } = await resolveSessionTarget({}, source);
    expect(target.kind).toBe("new");
    expect(session.id).toBeTruthy();
    expect(session.messages).toHaveLength(0);
  });

  it("applies the template to a new session", async () => {
    const { session } = await resolveSessionTarget(
      { title: "My title", template: { model: "gpt-4", cwd: "/work" } },
      source,
    );
    expect(session.title).toBe("My title");
    expect(session.model).toBe("gpt-4");
    expect(session.cwd).toBe("/work");
  });

  it("resumes an existing session by id", async () => {
    const existing = source.create({ id: "abc", title: "Existing" });
    const { target, session } = await resolveSessionTarget({ sessionId: "abc" }, source);
    expect(target).toEqual({ kind: "resume", id: "abc" });
    expect(session.id).toBe("abc");
    expect(session.title).toBe("Existing");
    expect(existing.id).toBe("abc");
  });

  it("creates the session with the requested id when it does not exist", async () => {
    const { target, session } = await resolveSessionTarget({ sessionId: "ghost" }, source);
    expect(target).toEqual({ kind: "new", id: "ghost" });
    expect(session.id).toBe("ghost");
  });

  it("resumes the most recent session with continueLast", async () => {
    source.create({ id: "old", messages: [msg("a", "2024-01-01T00:00:00.000Z")] });
    source.create({ id: "new", messages: [msg("b", "2024-06-01T00:00:00.000Z")] });
    const { target, session } = await resolveSessionTarget({ continueLast: true }, source);
    expect(target).toEqual({ kind: "resume", id: "new" });
    expect(session.id).toBe("new");
  });

  it("creates a new session with continueLast when no session exists", async () => {
    const { target } = await resolveSessionTarget({ continueLast: true }, source);
    expect(target.kind).toBe("new");
  });

  it("filters continueLast by cwd", async () => {
    source.create({ id: "here", cwd: "/work", messages: [msg("a", "2024-01-01T00:00:00.000Z")] });
    source.create({ id: "there", cwd: "/other", messages: [msg("b", "2024-06-01T00:00:00.000Z")] });
    const { session } = await resolveSessionTarget({ continueLast: true, cwd: "/work" }, source);
    expect(session.id).toBe("here");
  });

  it("forks a session with a new id and the same history", async () => {
    source.create({
      id: "src",
      title: "Original",
      messages: [msg("hello", "2024-01-01T00:00:00.000Z")],
    });
    const { target, session } = await resolveSessionTarget({ fork: true, sessionId: "src" }, source);
    expect(target.kind).toBe("fork");
    if (target.kind !== "fork") throw new Error("unreachable");
    expect(target.sourceId).toBe("src");
    expect(session.id).not.toBe("src");
    expect(session.title).toBe("Original (fork)");
    expect(session.messages).toHaveLength(1);
    expect(session.messages[0].content).toBe("hello");
    // La source n'est pas modifiée
    expect((await source.get("src"))!.title).toBe("Original");
  });

  it("forks the most recent session with fork + continueLast", async () => {
    source.create({ id: "a", messages: [msg("x", "2024-01-01T00:00:00.000Z")] });
    const { target } = await resolveSessionTarget({ fork: true, continueLast: true }, source);
    expect(target.kind).toBe("fork");
    if (target.kind !== "fork") throw new Error("unreachable");
    expect(target.sourceId).toBe("a");
  });

  it("fails honestly when fork has no source", async () => {
    await expect(resolveSessionTarget({ fork: true }, source)).rejects.toThrow(
      /--fork requires --session or --continue/,
    );
  });

  it("fails honestly when the fork source does not exist", async () => {
    await expect(resolveSessionTarget({ fork: true, sessionId: "ghost" }, source)).rejects.toThrow(
      /Session not found: ghost/,
    );
  });

  it("uses the provided id factory", async () => {
    const { session } = await resolveSessionTarget({ generateId: () => "fixed-id" }, source);
    expect(session.id).toBe("fixed-id");
  });
});

describe("newestSession", () => {
  it("returns the most recently active session", async () => {
    const source = new FakeSource();
    source.create({ id: "a", messages: [msg("x", "2024-01-01T00:00:00.000Z")] });
    source.create({ id: "b", messages: [msg("y", "2024-09-01T00:00:00.000Z")] });
    const latest = await newestSession(source);
    expect(latest?.id).toBe("b");
  });

  it("returns null when the store is empty", async () => {
    expect(await newestSession(new FakeSource())).toBeNull();
  });
});

describe("defaultSessionId", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => defaultSessionId()));
    expect(ids.size).toBe(50);
  });
});
