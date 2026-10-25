import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  SessionCompactor,
  COMPACTION_THRESHOLD,
  KEEP_RECENT_MESSAGES,
  contextBuilder,
  Planner,
} from "@soryos/agent";
import type { LlmClient } from "@soryos/agent";
import { globalEventBus } from "@soryos/bus";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { toolRegistry } from "@soryos/tool";

const originalCwd = process.cwd();
let tmp: string;

class StubLlm implements LlmClient {
  queue: Array<{ text?: string; error?: string }> = [];
  calls = 0;
  prompts: string[] = [];
  async generate(options: { prompt: string }): Promise<{ text: string; error?: string }> {
    this.calls++;
    this.prompts.push(options.prompt);
    const next = this.queue.shift();
    if (!next) return { text: "", error: `Stub vide (appel n°${this.calls})` };
    return next;
  }
  async *streamChat(): AsyncGenerator<{ text: string; error?: string }> {
    yield { text: "stub" };
  }
}

function makeSession(id: string, messageCount = 0) {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  session.model = "gemini-3.8-flash";
  session.messages = [];
  for (let i = 0; i < messageCount; i++) {
    session.messages.push({
      id: `m-${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message numéro ${i}`,
      created_at: new Date().toISOString(),
    });
  }
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-memory-test-"));
  fs.writeFileSync(path.join(tmp, "AGENTS.md"), "# Règles projet\nToujours écrire des tests.");
  fs.writeFileSync(path.join(tmp, "README.md"), "# Mon projet\nDescription.");
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "index.ts"), "export {};");
  fs.mkdirSync(path.join(tmp, "node_modules"), { recursive: true });
  process.chdir(tmp);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("SessionCompactor", () => {
  it("no-op sous le seuil", async () => {
    const stub = new StubLlm();
    const compactor = new SessionCompactor(stub);
    const session = makeSession("mem-a", 10);

    const result = await compactor.maybeCompact("mem-a");
    expect(result.compacted).toBe(false);
    expect(stub.calls).toBe(0);
    expect(sessionStore.get("mem-a")?.messages).toHaveLength(10);
  });

  it("au-dessus du seuil : archive en résumé, garde les 15 derniers", async () => {
    const stub = new StubLlm();
    stub.queue = [{ text: "Résumé structuré : l'utilisateur a inspecté le paquet tool." }];
    const compactor = new SessionCompactor(stub);
    const total = COMPACTION_THRESHOLD + 10;
    const session = makeSession("mem-b", total);
    const events: any[] = [];
    const off = globalEventBus.on("*", (e: any) => events.push(e));

    const result = await compactor.maybeCompact("mem-b");
    off();

    expect(result.compacted).toBe(true);
    expect(result.archivedCount).toBe(total - KEEP_RECENT_MESSAGES);
    expect(result.remainingCount).toBe(KEEP_RECENT_MESSAGES);

    const fresh = sessionStore.get("mem-b")!;
    expect(fresh.messages).toHaveLength(KEEP_RECENT_MESSAGES);
    expect(fresh.messages[0].id).toBe(`m-${total - KEEP_RECENT_MESSAGES}`);
    expect(fresh.memorySummary).toContain("paquet tool");
    expect(events.some((e) => e.type === "session.compacted")).toBe(true);
  });

  it("échec LLM : messages INTACTS + erreur honnête", async () => {
    const stub = new StubLlm();
    stub.queue = [{ error: "503 unavailable" }];
    const compactor = new SessionCompactor(stub);
    makeSession("mem-c", COMPACTION_THRESHOLD + 5);

    const result = await compactor.maybeCompact("mem-c");
    expect(result.compacted).toBe(false);
    expect(result.error).toContain("503 unavailable");
    expect(result.error).toContain("untouched");
    expect(sessionStore.get("mem-c")?.messages).toHaveLength(COMPACTION_THRESHOLD + 5);
    expect(sessionStore.get("mem-c")?.memorySummary).toBeUndefined();
  });

  it("résumé vide du modèle : refus, messages intacts", async () => {
    const stub = new StubLlm();
    stub.queue = [{ text: "   " }];
    const compactor = new SessionCompactor(stub);
    makeSession("mem-d", COMPACTION_THRESHOLD + 2);

    const result = await compactor.maybeCompact("mem-d");
    expect(result.compacted).toBe(false);
    expect(sessionStore.get("mem-d")?.messages).toHaveLength(COMPACTION_THRESHOLD + 2);
  });

  it("les résumés s'accumulent lors de compactions successives", async () => {
    const stub = new StubLlm();
    stub.queue = [
      { text: "Premier résumé A." },
      { text: "Deuxième résumé B." },
    ];
    const compactor = new SessionCompactor(stub);
    makeSession("mem-e", COMPACTION_THRESHOLD + 5);
    await compactor.maybeCompact("mem-e");

    // Re-grown history → second compaction merges summaries
    const s = sessionStore.get("mem-e")!;
    for (let i = 0; i < COMPACTION_THRESHOLD + 5; i++) {
      s.messages.push({ id: `x-${i}`, role: "user", content: `encore ${i}`, created_at: new Date().toISOString() });
    }
    sessionStore.save(s);

    const result = await compactor.maybeCompact("mem-e");
    expect(result.compacted).toBe(true);
    const summary = sessionStore.get("mem-e")!.memorySummary!;
    expect(summary).toContain("Premier résumé A.");
    expect(summary).toContain("Deuxième résumé B.");
  });
});

describe("ContextBuilder — instruction discovery", () => {
  it("charge AGENTS.md, README.md et l'arborescence du workspace", async () => {
    makeSession("ctx-a");
    const context = await contextBuilder.buildContext({ sessionId: "ctx-a", userRequest: "Salut" });

    const instructions = context.contextItems.filter((i) => i.type === "instructions");
    expect(instructions.map((i) => i.source).sort()).toEqual(["AGENTS.md", "README.md"]);
    expect(instructions[0].content).toContain("Toujours écrire des tests");

    const tree = context.contextItems.find((i) => i.type === "tree");
    expect(tree).toBeDefined();
    expect(tree!.content).toContain("src/");
    expect(tree!.content).toContain("index.ts");
    expect(tree!.content).not.toContain("node_modules");

    expect(context.contextItems[0].type).toBe("user_request");
  });

  it("tolère un workspace sans fichiers d'instructions", async () => {
    const emptyWs = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-ctx-empty-"));
    const s = sessionStore.getOrCreate("ctx-b");
    s.agent_running = true;
    s.providerId = "local";
    s.environment = "local";
    sessionStore.save(s);
    workspaceManager.getOrCreateWorkspace("ctx-b", { providerId: "local", workspacePath: emptyWs });

    const context = await contextBuilder.buildContext({ sessionId: "ctx-b", userRequest: "ok" });
    expect(context.contextItems.filter((i) => i.type === "instructions")).toHaveLength(0);
    fs.rmSync(emptyWs, { recursive: true, force: true });
  });

  it("reste sous la limite MAX_CONTEXT_ITEMS", async () => {
    const session = makeSession("ctx-c");
    session.openFiles = Array.from({ length: 25 }, (_, i) => `f${i}.txt`);
    sessionStore.save(session);

    const context = await contextBuilder.buildContext({ sessionId: "ctx-c", userRequest: "x" });
    expect(context.contextItems.length).toBeLessThanOrEqual(20);
    expect(context.contextItems[0].type).toBe("user_request");
  });
});

describe("Planner + mémoire", () => {
  it("le prompt du planner inclut le memorySummary compacté", async () => {
    const stub = new StubLlm();
    stub.queue = [
      { text: JSON.stringify([{ type: "task", name: "T", description: "d" }]) },
      { text: JSON.stringify({ status: "done", message: "OK." }) },
    ];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const session = makeSession("mem-planner", 1);
    session.memorySummary = "ARCHIVE: l'utilisateur voulait créer un composant Button.";
    sessionStore.save(session);

    await planner.planAndExecute(session, () => {}, { agentId: "build", modelId: "gemini-3.8-flash" });

    expect(stub.prompts[0]).toContain("Earlier conversation (compacted memory)");
    expect(stub.prompts[0]).toContain("composant Button");
  });
});
