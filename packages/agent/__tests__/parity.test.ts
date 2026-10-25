import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentRuntime } from "../src/runtime";
import { createRunPipeline } from "../src/run-pipeline";
import type { LlmClient } from "../src/llm-client";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import type { SoryOSEvent } from "@soryos/schema";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/**
 * Faux LLM déterministe : renvoie toujours le même plan.
 * Aucune réseau, aucun appel réel — la parité est testée sur le FLUX.
 */
function fakeLlmClient(plan: string): LlmClient {
  return {
    async generate() {
      return { text: plan };
    },
    async *streamChat() {
      yield { text: "réponse déterministe" };
    },
  };
}

const FAKE_PLAN = JSON.stringify([
  {
    name: "Read the file",
    description: "Read the target file",
    type: "tool",
    toolName: "read_file",
    parameters: { path: "package.json" },
  },
]);

/** Prépare une session + workspace pour le pipeline. */
function prepareSession(id: string): void {
  sessionStore.getOrCreate(id);
  const session = sessionStore.get(id)!;
  session.model = "gemini-2.5-flash";
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, {
    environment: "local",
    providerId: "local",
    workspacePath: process.cwd(),
  });
}

/** Signature stable d'un flux canonique (type + champs discriminants). */
function signature(events: SoryOSEvent[]): string[] {
  return events.map((e) => {
    switch (e.type) {
      case "status":
        return `status:${e.message}`;
      case "text":
        return `text:${e.delta}`;
      case "tool_use":
        return `tool_use:${e.name}`;
      case "tool_end":
        return `tool_end:${e.id}`;
      case "error":
        return `error:${e.message}`;
      case "done":
        return "done";
      case "file_changed":
        return `file_changed:${e.path}`;
      case "permission_requested":
        return `permission_requested:${e.toolName}`;
      case "question_asked":
        return "question_asked";
      case "preview":
        return `preview:${e.url}`;
      case "reasoning":
        return `reasoning:${e.delta}`;
    }
  });
}

describe("parité du flux canonique", () => {
  beforeEach(() => {
    // Chaque test a sa propre session (le store est un singleton en mémoire).
  });

  it("produit le même flux pour deux consommateurs différents", async () => {
    const runtime = new AgentRuntime({ llmClient: fakeLlmClient(FAKE_PLAN) });
    const pipeline = createRunPipeline(runtime);

    // Adaptateur A : collecte brute (comme le NDJSON du CLI).
    const collectedA: SoryOSEvent[] = [];
    prepareSession("parity-a");
    await pipeline({ sessionId: "parity-a", prompt: "hello", apiKey: "test" }, (e) => {
      collectedA.push(e);
    });

    // Adaptateur B : transforme (comme le rendu de la GUI).
    const collectedB: SoryOSEvent[] = [];
    prepareSession("parity-b");
    await pipeline({ sessionId: "parity-b", prompt: "hello", apiKey: "test" }, (e) => {
      // Un adaptateur GUI ignore ce qui ne l'intéresse pas : le flux reste
      // identique côté moteur.
      if (e.type === "status" && e.message === "Agent started") return;
      collectedB.push(e);
    });

    // Mêmes événements, dans le même ordre (hors le filtre propre à B).
    const sigA = signature(collectedA);
    const sigB = signature(collectedB);
    expect(sigB).toEqual(sigA.filter((s) => s !== "status:Agent started"));
  });

  it("n'émet que des événements canoniques connus", async () => {
    const runtime = new AgentRuntime({ llmClient: fakeLlmClient(FAKE_PLAN) });
    const pipeline = createRunPipeline(runtime);
    const events: SoryOSEvent[] = [];

    prepareSession("parity-contract");
    await pipeline({ sessionId: "parity-contract", prompt: "hello", apiKey: "test" }, (e) => {
      events.push(e);
    });

    const allowed = new Set([
      "status",
      "text",
      "reasoning",
      "tool_use",
      "tool_end",
      "permission_requested",
      "question_asked",
      "file_changed",
      "preview",
      "error",
      "done",
    ]);
    for (const e of events) {
      expect(allowed.has(e.type)).toBe(true);
    }
    // Le flux contient au moins le début du run.
    expect(events.some((e) => e.type === "status")).toBe(true);
  });

  it("échoue honnêtement si la session n'existe pas", async () => {
    const runtime = new AgentRuntime({ llmClient: fakeLlmClient(FAKE_PLAN) });
    const pipeline = createRunPipeline(runtime);
    const result = await pipeline({ sessionId: "does-not-exist", prompt: "x" }, () => {});
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/Session not found/);
  });
});

/* -------------------------------------------------------------------------- */
/* Garde-fou : les adaptateurs ne doivent PAS appeler le runtime directement.  */
/* -------------------------------------------------------------------------- */

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".next" || entry === ".turbo") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("garde-fou CI", () => {
  const adapters = ["apps/web", "packages/cli"];

  it("aucun adaptateur n'appelle agentRuntime.run() directement", () => {
    const offenders: string[] = [];
    for (const adapter of adapters) {
      const dir = join(repoRoot, adapter);
      for (const file of collectSourceFiles(dir)) {
        const content = readFileSync(file, "utf8");
        if (/agentRuntime\s*\.\s*run\s*\(/.test(content)) {
          offenders.push(relative(repoRoot, file));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("les adaptateurs passent par runPipeline", () => {
    for (const adapter of adapters) {
      const dir = join(repoRoot, adapter);
      const files = collectSourceFiles(dir);
      const usesPipeline = files.some((f) => /runPipeline\s*\(/.test(readFileSync(f, "utf8")));
      expect(usesPipeline, `${adapter} should call runPipeline()`).toBe(true);
    }
  });
});
