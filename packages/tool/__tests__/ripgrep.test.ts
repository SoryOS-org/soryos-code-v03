import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry, isRipgrepAvailable, resetRipgrepCache, buildRgArgs, ripgrepSearch } from "@soryos/tool";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import type { SessionData } from "@soryos/schema";

let tmp: string;
let fakeBin: string;
let originalPath: string;
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

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-rg-test-"));
  fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "src", "a.ts"), "const needle = 1;\nexport {};\n");
  fs.writeFileSync(path.join(tmp, "src", "b.ts"), "// needle again\nexport {};\n");
  fs.writeFileSync(path.join(tmp, "top.txt"), "needle au top\n");
  provider = new LocalExecutionProvider(tmp);
  await provider.init(tmp);

  // Faux binaire rg : sortie simulée au format path:line:content
  fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-rg-bin-"));
  fs.writeFileSync(
    path.join(fakeBin, "rg"),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo "ripgrep 14.1.0 (fake)"; exit 0; fi
echo "src/a.ts:1:const needle = 1;"
echo "src/b.ts:1:// needle again"
exit 0
`,
    { mode: 0o755 }
  );
  originalPath = process.env.PATH ?? "";
});

afterAll(() => {
  process.env.PATH = originalPath;
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(fakeBin, { recursive: true, force: true });
});

afterEach(() => {
  process.env.PATH = originalPath;
  resetRipgrepCache();
});

describe("buildRgArgs — arguments purs", () => {
  it("fixed-string + insensible à la casse par défaut", () => {
    const args = buildRgArgs({ pattern: "foo.bar", caseSensitive: false, useRegex: false, maxMatches: 50 });
    expect(args).toContain("-F");
    expect(args).toContain("-i");
    expect(args).toContain("--line-number");
    expect(args[args.length - 2]).toBe("-e");
    expect(args[args.length - 1]).toBe("foo.bar");
    expect(args).toContain("--max-count");
  });

  it("regex + sensible à la casse", () => {
    const args = buildRgArgs({ pattern: "f.o", caseSensitive: true, useRegex: true, maxMatches: 10, cwd: "src" });
    expect(args).not.toContain("-F");
    expect(args).not.toContain("-i");
    expect(args.at(-1)).toBe("src");
  });
});

describe("grep_search — fallback portable (pas de rg réel)", () => {
  it("trouve les correspondances y compris en sous-répertoires", async () => {
    const session = makeSession("rg-fallback");
    const r = await executor.execute(
      "grep_search",
      { query: "needle", path: "", caseSensitive: false, useRegex: false, maxMatches: 50 },
      provider, session, "explore"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("src/a.ts:1:");
    expect(String(r.output)).toContain("src/b.ts:1:");
    expect(String(r.output)).toContain("top.txt:1:");
  });

  it("regex invalide → tolérant (recherche simple)", async () => {
    const session = makeSession("rg-badregex");
    const r = await executor.execute(
      "grep_search",
      { query: "[invalid(", path: "", useRegex: true, maxMatches: 10 },
      provider, session, "explore"
    );
    expect(r.isError).toBe(false);
  });

  it("isRipgreyAvailable détecte la(non)-disponibilité et se met en cache", async () => {
    resetRipgrepCache();
    process.env.PATH = originalPath; // pas de rg réel dans cet env
    const first = await isRipgrepAvailable();
    const second = await isRipgrepAvailable();
    expect(typeof first).toBe("boolean");
    expect(second).toBe(first);
  });
});

describe("grep_search — fast path ripgrep (faux binaire rg)", () => {
  it("utilise rg quand disponible et parse sa sortie", async () => {
    process.env.PATH = `${fakeBin}:${originalPath}`;
    resetRipgrepCache();
    expect(await isRipgrepAvailable()).toBe(true);

    const session = makeSession("rg-fast");
    const r = await executor.execute(
      "grep_search",
      { query: "needle", path: "", maxMatches: 50 },
      provider, session, "explore"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("Found 2 matches");
    expect(String(r.output)).toContain("src/a.ts:1:");
    expect(r.metadata).toMatchObject({ engine: "ripgrep", count: 2 });
  });

  it("rg sans correspondance → message honnête", async () => {
    fs.writeFileSync(
      path.join(fakeBin, "rg"),
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "ripgrep 14.1.0 (fake)"; exit 0; fi
exit 1
`,
      { mode: 0o755 }
    );
    process.env.PATH = `${fakeBin}:${originalPath}`;
    resetRipgrepCache();

    const session = makeSession("rg-nomatch");
    const r = await executor.execute(
      "grep_search",
      { query: "absent", path: "", maxMatches: 10 },
      provider, session, "explore"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain('No occurrences of "absent"');
  });

  it("rg en erreur (exit 2) → fallback portable honnête", async () => {
    fs.writeFileSync(
      path.join(fakeBin, "rg"),
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "ripgrep 14.1.0 (fake)"; exit 0; fi
echo "fatal: simulated crash" >&2
exit 2
`,
      { mode: 0o755 }
    );
    process.env.PATH = `${fakeBin}:${originalPath}`;
    resetRipgrepCache();

    const session = makeSession("rg-crash");
    const r = await executor.execute(
      "grep_search",
      { query: "needle", path: "", maxMatches: 50 },
      provider, session, "explore"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("src/a.ts:1:"); // fallback a trouvé
    expect(r.metadata?.engine).toBeUndefined(); // pas le moteur ripgrep
  });

  it("ripgrepSearch tronque à maxMatches", async () => {
    fs.writeFileSync(
      path.join(fakeBin, "rg"),
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "ripgrep 14.1.0 (fake)"; exit 0; fi
echo "f:1:a"
echo "f:2:b"
echo "f:3:c"
exit 0
`,
      { mode: 0o755 }
    );
    process.env.PATH = `${fakeBin}:${originalPath}`;
    resetRipgrepCache();

    const result = await ripgrepSearch({ pattern: "x", caseSensitive: false, useRegex: false, maxMatches: 2, workdir: tmp });
    expect(result).not.toBeNull();
    expect(result!.matches.length).toBeLessThanOrEqual(2);
  });
});
