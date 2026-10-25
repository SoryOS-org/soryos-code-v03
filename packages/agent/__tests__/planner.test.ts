import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AgentRuntime, Planner, contextBuilder } from "@soryos/agent";
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
  async generate(): Promise<{ text: string; error?: string }> {
    this.calls++;
    const next = this.queue.shift();
    if (!next) return { text: "", error: `Stub vide (appel n°${this.calls})` };
    return next;
  }
  async *streamChat(): AsyncGenerator<{ text: string; error?: string }> {
    yield { text: "stub" };
  }
}

function makeSession(id: string) {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  session.messages.push({
    id: `user-${id}`,
    role: "user",
    content: "Inspecte le paquet tool.",
    created_at: new Date().toISOString(),
  });
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

function assistants(id: string) {
  return (sessionStore.get(id)?.messages ?? []).filter((m) => m.role === "assistant");
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-agent-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed");
  process.chdir(tmp);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("Planner — boucle plan → outils → feedback", () => {
  it("scénario happy path : plan exécuté, outils réels, feedback done persisté", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify([
          { type: "task", name: "Comprendre", description: "Analyser" },
          {
            type: "tool", name: "Lister le workspace", toolName: "list_files",
            parameters: { path: "." },
          },
          {
            type: "tool", name: "Lire le manifeste", toolName: "read_file",
            parameters: { path: "seed.txt" },
          },
        ]),
      },
      { text: JSON.stringify({ status: "done", message: "Fichier inspecté avec succès." }) },
    ];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const events: any[] = [];
    const session = makeSession("planner-a");

    const result = await planner.planAndExecute(session, (e) => events.push(e), {
      agentId: "build",
      modelId: "gemini-3.8-flash",
    });
    expect(result).toBe("completed");

    const toolStarts = events.filter((e) => e.type === "tool_start");
    const toolEnds = events.filter((e) => e.type === "tool_end");
    expect(toolStarts).toHaveLength(2);
    expect(toolEnds).toHaveLength(2);
    expect(toolEnds.every((t) => t.isError === false)).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
    const textEvent = events.find((e) => e.type === "text");
    expect(textEvent.delta).toBe("Fichier inspecté avec succès.");

    const msgs = assistants("planner-a");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Fichier inspecté avec succès.");
    expect(stub.calls).toBe(2);

    const plan = planner.getAllPlans()[0];
    expect(plan?.status).toBe("completed");
    expect(plan?.mode).toBe("build");
    expect(plan?.progress).toBe(100);
    expect(sessionStore.get("planner-a")?.model).toBe("gemini-3.8-flash");
    expect(sessionStore.get("planner-a")?.agentId).toBe("build");
  });

  it("auto-correctif : étape en échec → feedback continue → étapes correctives exécutées réellement", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify([
          {
            type: "tool", name: "Écriture cassée", toolName: "write_file",
            parameters: { path: "loop-correction.txt" },
          },
        ]),
      },
      {
        text: JSON.stringify({
          status: "continue",
          steps: [
            {
              type: "tool", name: "Écrire le fichier", toolName: "write_file",
              parameters: { path: "loop-correction.txt", content: "corrigé par la boucle" },
            },
            {
              type: "tool", name: "Vérifier", toolName: "read_file",
              parameters: { path: "loop-correction.txt" },
            },
          ],
        }),
      },
      { text: JSON.stringify({ status: "done", message: "Fichier créé et vérifié." }) },
    ];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const events: any[] = [];
    const session = makeSession("planner-b");

    await planner.planAndExecute(session, (e) => events.push(e), { agentId: "build" });

    const failedEnd = events.find((e) => e.type === "tool_end" && e.isError);
    expect(failedEnd).toBeTruthy();
    expect(failedEnd.output).toMatch(/Missing required parameter/);

    const plan = planner.getAllPlans()[0];
    expect(plan?.steps[0].status).toBe("failed");
    expect(plan?.steps).toHaveLength(3);
    expect(plan?.steps[1].status).toBe("completed");
    expect(plan?.steps[2].status).toBe("completed");
    expect(plan?.status).toBe("completed");

    expect(fs.readFileSync(path.join(tmp, "loop-correction.txt"), "utf8")).toBe("corrigé par la boucle");
    expect(assistants("planner-b")[0].content).toBe("Fichier créé et vérifié.");
    expect(stub.calls).toBe(3);
  });

  it("erreur LLM : propagée honnêtement, aucun faux message assistant de succès", async () => {
    const stub = new StubLlm();
    stub.queue = [{ error: "401 unauthorized: clé invalide" }];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const events: any[] = [];
    const session = makeSession("planner-c");

    const result = await planner.planAndExecute(session, (e) => events.push(e), { agentId: "plan" });
    expect(result).toBe("failed");

    const err = events.find((e) => e.type === "error");
    expect(err.message).toContain("Failed to create plan");
    expect(err.message).toContain("401 unauthorized");
    expect(assistants("planner-c")).toHaveLength(0);
    expect(events.some((e) => e.type === "done")).toBe(false);

    const sessionErrors = sessionStore.get("planner-c")?.errors ?? [];
    expect(sessionErrors).toHaveLength(1);
    expect(sessionErrors[0].type).toBeTruthy();
    expect(sessionErrors[0].code).toBeTruthy();
    expect(sessionErrors[0].message).toContain("401 unauthorized");
    expect(Array.isArray(sessionErrors[0].recoverySuggestions)).toBe(true);
    expect(sessionErrors[0].recoverySuggestions!.length).toBeGreaterThan(0);
  });

  it("cancellation : agent_running=false → pause à l'étape suivante, pas de done", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify([
          {
            type: "tool", name: "Première étape", toolName: "write_file",
            parameters: { path: "pause-test.txt", content: "étape 1" },
          },
          {
            type: "tool", name: "Deuxième étape", toolName: "write_file",
            parameters: { path: "pause-test.txt", content: "étape 2" },
          },
        ]),
      },
      { text: JSON.stringify({ status: "done", message: "ne devrait pas être appelé" }) },
    ];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const events: any[] = [];
    const session = makeSession("planner-pause");

    const result = await planner.planAndExecute(session, (e) => {
      events.push(e);
      if (e.type === "tool_start") {
        sessionStore.update("planner-pause", { agent_running: false });
      }
    }, { agentId: "build" });
    expect(result).toBe("paused");

    expect(events.filter((e) => e.type === "tool_start")).toHaveLength(1);
    expect(events.some((e) => e.type === "done")).toBe(false);
    const statusMessages = events.filter((e) => e.type === "status").map((e) => e.message);
    expect(statusMessages).toContain("Exécution mise en pause.");

    const plan = planner.getAllPlans()[0];
    expect(plan?.status).toBe("paused");
    expect(plan?.steps[0].status).toBe("completed");
    expect(plan?.steps[1].status).toBe("pending");

    const msgs = assistants("planner-pause");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toMatch(/mise en pause à l'étape 2\/2/);
    expect(fs.readFileSync(path.join(tmp, "pause-test.txt"), "utf8")).toBe("étape 1");
    expect(stub.calls).toBe(1);
  });

  it("mode plan : tentative d'écriture refusée par permissions puis boucle de feedback", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify([
          {
            type: "tool", name: "Écrire", toolName: "write_file",
            parameters: { path: "plan-should-not-exist.txt", content: "x" },
          },
        ]),
      },
      { text: JSON.stringify({ status: "done", message: "Mode plan : aucune écriture possible." }) },
    ];
    const planner = new Planner(contextBuilder, toolRegistry, stub);
    const events: any[] = [];
    const session = makeSession("planner-plan-mode");

    await planner.planAndExecute(session, (e) => events.push(e), { agentId: "plan" });

    const failedEnd = events.find((e) => e.type === "tool_end" && e.isError);
    expect(failedEnd.output).toContain("PERMISSION DENIED");
    const plan = planner.getAllPlans()[0];
    expect(plan?.mode).toBe("plan");
    expect(plan?.steps[0].status).toBe("failed");
    expect(plan?.status).toBe("completed");
    expect(fs.existsSync(path.join(tmp, "plan-should-not-exist.txt"))).toBe(false);
    expect(assistants("planner-plan-mode")[0].content).toBe("Mode plan : aucune écriture possible.");
    expect(stub.calls).toBe(2);
  });

  it("isolation : deux sessions concurrentes n'écrasent ni messages ni plans", async () => {
    const stub1 = new StubLlm();
    stub1.queue = [
      { text: JSON.stringify([{ type: "task", name: "Tâche 1", description: "s1" }]) },
      { text: JSON.stringify({ status: "done", message: "Résultat session 1." }) },
    ];
    const stub2 = new StubLlm();
    stub2.queue = [
      { text: JSON.stringify([{ type: "task", name: "Tâche 2", description: "s2" }]) },
      { text: JSON.stringify({ status: "done", message: "Résultat session 2." }) },
    ];

    const planner1 = new Planner(contextBuilder, toolRegistry, stub1);
    const planner2 = new Planner(contextBuilder, toolRegistry, stub2);
    const session1 = makeSession("planner-s1");
    const session2 = makeSession("planner-s2");

    await Promise.all([
      planner1.planAndExecute(session1, () => {}, { agentId: "build" }),
      planner2.planAndExecute(session2, () => {}, { agentId: "explore" }),
    ]);

    expect(assistants("planner-s1")[0].content).toBe("Résultat session 1.");
    expect(assistants("planner-s2")[0].content).toBe("Résultat session 2.");
    expect(planner1.getAllPlans()).toHaveLength(1);
    expect(planner1.getAllPlans()[0].mode).toBe("build");
    expect(planner2.getAllPlans()[0].mode).toBe("explore");
    expect(sessionStore.get("planner-s1")?.agentId).toBe("build");
    expect(sessionStore.get("planner-s2")?.agentId).toBe("explore");
  });

  it("mémoire conversationnelle : l'historique est inclus dans le prompt de plan", async () => {
    const stub = new StubLlm();
    const capturedPrompts: string[] = [];
    const spy: LlmClient = {
      async generate(options: any) {
        capturedPrompts.push(options.prompt);
        stub.calls++;
        const next = stub.queue.shift();
        return next ?? { text: "", error: "vide" };
      },
      async *streamChat() {
        yield { text: "stub" };
      },
    };
    stub.queue = [
      { text: JSON.stringify([{ type: "task", name: "T", description: "d" }]) },
      { text: JSON.stringify({ status: "done", message: "ok" }) },
    ];

    const sid = "planner-history";
    const session = makeSession(sid);
    const prior = sessionStore.get(sid)!;
    prior.messages.unshift({
      id: "old-msg",
      role: "assistant",
      content: "Réponse précédente mémorisée.",
      created_at: new Date().toISOString(),
    });
    sessionStore.save(prior);

    const planner = new Planner(contextBuilder, toolRegistry, spy);
    await planner.planAndExecute(sessionStore.get(sid)!, () => {}, { agentId: "build" });

    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[0]).toContain("Réponse précédente mémorisée.");
    expect(capturedPrompts[0]).toContain("User Request:");
    expect(capturedPrompts[1]).toContain("Review the results");
    expect(stub.calls).toBe(2);
  });
});

describe("AgentRuntime — verrou par session et événements bus", () => {
  function collectBus(): { types: string[]; off: () => void } {
    const types: string[] = [];
    const off = globalEventBus.on("*", (e) => {
      types.push(e.type);
    });
    return { types, off };
  }

  it("succès : agent.started puis agent.completed sur le bus central", async () => {
    const stub = new StubLlm();
    stub.queue = [
      { text: JSON.stringify([{ type: "task", name: "T", description: "d" }]) },
      { text: JSON.stringify({ status: "done", message: "Runtime OK." }) },
    ];
    const runtime = new AgentRuntime({ llmClient: stub });
    makeSession("runtime-ok");
    const bus = collectBus();
    const emitterEvents: string[] = [];
    runtime.on("start", () => emitterEvents.push("start"));
    runtime.on("end", () => emitterEvents.push("end"));

    const uiEvents: any[] = [];
    await runtime.run({ sessionId: "runtime-ok", agentId: "build", emit: (e) => uiEvents.push(e) });
    bus.off();

    expect(bus.types).toContain("agent.started");
    expect(bus.types).toContain("agent.completed");
    expect(bus.types).not.toContain("agent.failed");
    expect(emitterEvents).toEqual(["start", "end"]);
    expect(uiEvents.some((e) => e.type === "done")).toBe(true);
    expect(assistants("runtime-ok")[0].content).toBe("Runtime OK.");
  });

  it("verrou : un second run sur la même session est refusé tant que le premier tourne", async () => {
    let releasePlan!: () => void;
    const gate = new Promise<void>((r) => {
      releasePlan = r;
    });
    const responses = [
      { text: JSON.stringify([{ type: "task", name: "T", description: "d" }]) },
      { text: JSON.stringify({ status: "done", message: "fini après libération." }) },
    ];
    let call = 0;
    const slowLlm: LlmClient = {
      async generate() {
        const current = responses[call++];
        if (call === 1) await gate;
        return current;
      },
      async *streamChat() {
        yield { text: "stub" };
      },
    };

    const runtime = new AgentRuntime({ llmClient: slowLlm });
    makeSession("runtime-lock");
    const first = runtime.run({ sessionId: "runtime-lock", agentId: "build" });
    await new Promise((r) => setTimeout(r, 20));
    await expect(runtime.run({ sessionId: "runtime-lock" })).rejects.toThrow(/already running/);
    releasePlan();
    await first;
    expect(assistants("runtime-lock")[0].content).toBe("fini après libération.");
  });

  it("échec LLM : agent.failed sur le bus, pas de agent.completed, run se termine proprement", async () => {
    const stub = new StubLlm();
    stub.queue = [{ error: "429 rate limit" }];
    const runtime = new AgentRuntime({ llmClient: stub });
    makeSession("runtime-fail");
    const bus = collectBus();
    await runtime.run({ sessionId: "runtime-fail", agentId: "build" });
    bus.off();

    expect(bus.types).toContain("agent.started");
    expect(bus.types).toContain("agent.failed");
    expect(bus.types).not.toContain("agent.completed");
    expect(runtime.getState().isRunning).toBe(false);
  });

  it("session inexistante : rejet explicite + agent.failed", async () => {
    const runtime = new AgentRuntime({ llmClient: new StubLlm() });
    const bus = collectBus();
    await expect(runtime.run({ sessionId: "runtime-absent" })).rejects.toThrow(/Session not found/);
    bus.off();

    expect(bus.types).toContain("agent.failed");
    expect(bus.types).not.toContain("agent.completed");
    expect(runtime.getState().isRunning).toBe(false);
  });
});
