import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry, CodemodeTools } from "@soryos/tool";
import type { SessionData } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

function makeSession(id: string): SessionData {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

function makeCodemode(mode = "build") {
  return new CodemodeTools((toolName, toolArgs) =>
    executor.execute(toolName, toolArgs, provider, makeSession("cm-dispatch"), mode)
  );
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-codemode-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed content");
  provider = new LocalExecutionProvider(tmp);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("CodemodeTools — scripts réels sur le ToolExecutor", () => {
  it("chaîne write_file × 3 + read_file dans UN appel, disque réel", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      for (const name of ["a.txt", "b.txt", "c.txt"]) {
        const w = await tools.write_file({ path: name, content: "from codemode: " + name });
        if (w.isError) throw new Error(w.output);
      }
      const read = await tools.read_file({ path: "b.txt" });
      return read.output;
    `);

    expect(r.success).toBe(true);
    expect(r.toolCalls).toBe(4);
    expect(String(r.output)).toContain("from codemode: b.txt");
    expect(fs.readFileSync(path.join(tmp, "a.txt"), "utf8")).toBe("from codemode: a.txt");
    expect(fs.readFileSync(path.join(tmp, "c.txt"), "utf8")).toBe("from codemode: c.txt");
  });

  it("console.log capturé + return undefined → logs comme sortie", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      console.log("hello", "codemode");
      const g = await tools.read_file({ path: "seed.txt" });
      console.log("read ok:", !g.isError);
    `);

    expect(r.success).toBe(true);
    expect(r.logs).toContain("hello codemode");
    expect(r.logs).toContain("read ok: true");
    expect(r.output).toBe("hello codemode\nread ok: true");
  });

  it("objet retourné → sérialisation JSON honnête", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      const g = await tools.read_file({ path: "seed.txt" });
      return { found: !g.isError, chars: g.output.length };
    `);

    expect(r.success).toBe(true);
    const parsed = JSON.parse(r.output);
    expect(parsed.found).toBe(true);
    expect(parsed.chars).toBeGreaterThan(0);
  });

  it("isError d'un outil détecté → échec honnête du script", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      const g = await tools.read_file({ path: "absent.txt" });
      if (g.isError) throw new Error("lecture impossible: " + g.output);
      return "inatteignable";
    `);

    expect(r.success).toBe(false);
    expect(r.error).toContain("lecture impossible");
    expect(r.toolCalls).toBe(1);
  });

  it("erreur de syntaxe JS → échec honnête", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`const x = ;`);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Codemode script failed");
  });

  it("outil inconnu dans le script → erreur executor honnête", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      const r = await tools.not_a_real_tool({ x: 1 });
      if (r.isError) throw new Error(r.output);
    `);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Unknown tool");
  });

  it("blocage synchrone infini → timeout vm honnête", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`while (true) { }`, 2_000);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/timed out|Script execution timed out/i);
  }, 15_000);

  it("pas de require/process/fetch dans le contexte", async () => {
    const cm = makeCodemode();
    const r = await cm.runScript(`
      const leaks = { require: typeof require, process: typeof process, fetch: typeof fetch };
      return leaks;
    `);
    expect(r.success).toBe(true);
    expect(JSON.parse(r.output)).toEqual({ require: "undefined", process: "undefined", fetch: "undefined" });
  });
});

describe("outil codemode via ToolExecutor", () => {
  it("exécution de bout en bout (build) avec metadata toolCalls", async () => {
    const session = makeSession("cm-exec");
    const r = await executor.execute(
      "codemode",
      {
        script: `
          await tools.write_file({ path: "via-codemode.txt", content: "réel" });
          return "done";
        `,
      },
      provider,
      session,
      "build"
    );

    expect(r.isError).toBe(false);
    expect(r.output).toBe("done");
    expect(r.metadata).toMatchObject({ toolCalls: 1 });
    expect(fs.readFileSync(path.join(tmp, "via-codemode.txt"), "utf8")).toBe("réel");
  });

  it("mode plan → PERMISSION DENIED (codemode n'est pas read-only)", async () => {
    const session = makeSession("cm-plan");
    const r = await executor.execute("codemode", { script: "return 1;" }, provider, session, "plan");
    expect(r.isError).toBe(true);
    expect(r.output).toContain("PERMISSION DENIED");
  });

  it("script requis → validation honnête", async () => {
    const session = makeSession("cm-req");
    const r = await executor.execute("codemode", {}, provider, session, "build");
    expect(r.isError).toBe(true);
    expect(r.output).toContain('Missing required parameter "script"');
  });

  it("les permissions restent appliquées SUR CHAQUE sous-appel (explore : write refusé)", async () => {
    const cm = makeCodemode("explore");
    const r = await cm.runScript(`
      const w = await tools.write_file({ path: "nope.txt", content: "x" });
      return { isError: w.isError, output: w.output };
    `);
    // explore refuse write_file → le script reçoit un résultat isError (pas de faux succès)
    expect(r.success).toBe(true);
    const parsed = JSON.parse(r.output);
    expect(parsed.isError).toBe(true);
    expect(parsed.output).toContain("PERMISSION DENIED");
    expect(fs.existsSync(path.join(tmp, "nope.txt"))).toBe(false);
  });
});
