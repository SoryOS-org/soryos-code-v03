import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  SubagentManager,
  SUBAGENT_DEFINITIONS,
  getSubagentDefinition,
  listSubagentIds,
  registerTaskTool,
  TASK_TOOL_DEFINITION,
} from "@soryos/agent";
import type { LlmClient } from "@soryos/agent";
import { globalEventBus } from "@soryos/bus";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { toolRegistry, ToolExecutor } from "@soryos/tool";
import { executionManager } from "@soryos/execution";

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

function makeSession(id: string) {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  session.model = "gemini-3.8-flash";
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-subagent-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed content");
  process.chdir(tmp);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("SUBAGENT_DEFINITIONS — explore / plan / coder", () => {
  it("expose les trois sous-agents réels", () => {
    expect(listSubagentIds()).toEqual(["explore", "plan", "coder"]);
    expect(getSubagentDefinition("explore")?.mode).toBe("explore");
    expect(getSubagentDefinition("plan")?.mode).toBe("plan");
    expect(getSubagentDefinition("coder")?.mode).toBe("build");
    expect(getSubagentDefinition("nope")).toBeUndefined();
    expect(SUBAGENT_DEFINITIONS.every((d) => d.defaultPrompt.length > 40)).toBe(true);
  });
});

describe("SubagentManager.run — boucle LLM + outils réelle", () => {
  it("réponse finale directe (sans outils) : succès, 0 appel d'outil", async () => {
    const stub = new StubLlm();
    stub.queue = [{ text: "Le codebase utilise Turbo." }];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-a");
    const events: any[] = [];
    const off = globalEventBus.on("*", (e: any) => events.push(e));

    const result = await manager.run({
      definitionId: "explore",
      prompt: "Quel monorepo tool est utilisé ?",
      session,
    });
    off();

    expect(result.success).toBe(true);
    expect(result.output).toBe("Le codebase utilise Turbo.");
    expect(result.toolCalls).toBe(0);
    expect(result.iterations).toBe(1);
    expect(events.some((e) => e.type === "subagent.started")).toBe(true);
    expect(events.some((e) => e.type === "subagent.completed")).toBe(true);
  });

  it("boucle outils : lit un vrai fichier puis répond avec le contenu", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [{ tool: "read_file", parameters: { path: "seed.txt" } }],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "Le fichier contient : seed content" }) },
    ];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-b");

    const result = await manager.run({
      definitionId: "explore",
      prompt: "Que contient seed.txt ?",
      session,
    });

    expect(result.success).toBe(true);
    expect(result.toolCalls).toBe(1);
    expect(result.iterations).toBe(2);
    expect(result.output).toContain("seed content");
    expect(stub.prompts[1]).toContain("seed content");
  });

  it("explore ne peut PAS écrire (permissions du mode enforceées)", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [{ tool: "write_file", parameters: { path: "evil.txt", content: "x" } }],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "Tentative terminée." }) },
    ];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-c");

    const result = await manager.run({
      definitionId: "explore",
      prompt: "Écris un fichier.",
      session,
    });

    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(tmp, "evil.txt"))).toBe(false);
    expect(stub.prompts[1]).toMatch(/PERMISSION DENIED/i);
  });

  it("coder peut réellement écrire via son outil", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [
            { tool: "write_file", parameters: { path: "coder-out.txt", content: "écrit par coder" } },
          ],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "Fichier écrit." }) },
    ];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-d");

    const result = await manager.run({ definitionId: "coder", prompt: "Écris coder-out.txt.", session });

    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(tmp, "coder-out.txt"), "utf8")).toBe("écrit par coder");
  });

  it("outil inconnu demandé : erreur honnête dans le transcript", async () => {
    const stub = new StubLlm();
    stub.queue = [
      {
        text: JSON.stringify({
          toolCalls: [{ tool: "ghost_tool", parameters: {} }],
          final: null,
        }),
      },
      { text: JSON.stringify({ toolCalls: [], final: "Terminé." }) },
    ];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-e");

    await manager.run({ definitionId: "explore", prompt: "Liste.", session });
    expect(stub.prompts[1]).toContain('unknown tool "ghost_tool"');
  });

  it("erreur LLM : échec honnête + bus subagent.failed", async () => {
    const stub = new StubLlm();
    stub.queue = [{ error: "429 rate limit" }];
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-f");
    const events: any[] = [];
    const off = globalEventBus.on("*", (e: any) => events.push(e));

    const result = await manager.run({ definitionId: "explore", prompt: "x", session });
    off();

    expect(result.success).toBe(false);
    expect(result.error).toContain("429 rate limit");
    expect(events.some((e) => e.type === "subagent.failed")).toBe(true);
  });

  it("id inconnu / prompt vide : refus explicite", async () => {
    const stub = new StubLlm();
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-g");

    const r1 = await manager.run({ definitionId: "ghost", prompt: "x", session });
    expect(r1.success).toBe(false);
    expect(r1.error).toContain("explore, plan, coder");

    const r2 = await manager.run({ definitionId: "coder", prompt: "   ", session });
    expect(r2.success).toBe(false);
    expect(r2.error).toMatch(/empty/i);
    expect(stub.calls).toBe(0);
  });

  it("limite d'itérations atteinte : résultat PARTIEL honnête", async () => {
    const stub = new StubLlm();
    const explore = getSubagentDefinition("explore")!;
    for (let i = 0; i < (explore.maxToolCalls ?? 10); i++) {
      stub.queue.push({
        text: JSON.stringify({
          toolCalls: [{ tool: "read_file", parameters: { path: "seed.txt" } }],
          final: null,
        }),
      });
    }
    const manager = new SubagentManager(stub);
    const session = makeSession("sub-h");

    const result = await manager.run({ definitionId: "explore", prompt: "Boucle.", session });

    expect(result.success).toBe(true);
    expect(result.partial).toBe(true);
    expect(result.toolCalls).toBe(explore.maxToolCalls);
    expect(result.output).toContain("tool-call limit");
    expect(result.output).toContain("seed content");
  });
});

describe("outil task injecté (registerTaskTool)", () => {
  it("task est enregistré + handler override actif", () => {
    expect(toolRegistry.has("task")).toBe(true);
    expect(ToolExecutor.hasOverride("task")).toBe(true);
    expect(TASK_TOOL_DEFINITION.category).toBe("agent");
    expect(TASK_TOOL_DEFINITION.parameters.required).toEqual(["subagent", "prompt"]);
  });

  it("exécution réelle via ToolExecutor avec LLM stubé", async () => {
    const stub = new StubLlm();
    stub.queue = [{ text: "Réponse du sous-agent." }];
    registerTaskTool(stub);

    const executor = new ToolExecutor(toolRegistry);
    const session = makeSession("sub-task");
    const provider = await executionManager.getProvider("sub-task", "local");

    const r = await executor.execute(
      "task",
      { subagent: "explore", prompt: "Question ?" },
      provider,
      session,
      "build"
    );

    expect(r.isError).toBe(false);
    expect(r.output).toContain("Réponse du sous-agent.");
    expect(r.metadata).toMatchObject({ subagent: "explore", toolCalls: 0 });
  });

  it("sous-agent inconnu via task : erreur honnête listant les options", async () => {
    const stub = new StubLlm();
    registerTaskTool(stub);
    const executor = new ToolExecutor(toolRegistry);
    const session = makeSession("sub-task2");
    const provider = await executionManager.getProvider("sub-task2", "local");

    const r = await executor.execute("task", { subagent: "ghost", prompt: "x" }, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("explore, plan, coder");
  });

  it("mode plan : task refusé par permissions (deny par défaut)", async () => {
    const stub = new StubLlm();
    registerTaskTool(stub);
    const executor = new ToolExecutor(toolRegistry);
    const session = makeSession("sub-task3");
    const provider = await executionManager.getProvider("sub-task3", "local");

    const r = await executor.execute("task", { subagent: "explore", prompt: "x" }, provider, session, "plan");
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("PERMISSION DENIED");
    expect(stub.calls).toBe(0);
  });
});

afterEach(() => {
  registerTaskTool();
});
