import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LocalExecutionProvider } from "@soryos/execution";
import { ToolExecutor, toolRegistry } from "@soryos/tool";
import {
  resolvePermissionRequest,
  hasPendingPermissionRequest,
  createPermissionRequest,
  PERMISSION_ASK_TIMEOUT_MS,
} from "@soryos/permissions";
import { globalEventBus } from "@soryos/bus";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import type { SessionData } from "@soryos/schema";

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);
let unsubscribe: (() => void) | null = null;
let askEvents: any[] = [];

function makeSession(id: string, opts: Partial<SessionData> = {}): SessionData {
  const session = sessionStore.getOrCreate(id);
  session.agent_running = true;
  session.providerId = "local";
  session.environment = "local";
  session.cwd = tmp;
  session.model = "gemini-3.8-flash";
  Object.assign(session, opts);
  sessionStore.save(session);
  workspaceManager.getOrCreateWorkspace(id, { providerId: "local", workspacePath: tmp });
  return sessionStore.get(id)!;
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-ask-test-"));
  fs.writeFileSync(path.join(tmp, "seed.txt"), "seed");
  provider = new LocalExecutionProvider(tmp);
  await provider.init(tmp);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(() => {
  askEvents = [];
  unsubscribe = globalEventBus.on("permission.requested", (e: any) => {
    askEvents.push(e);
  });
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
});

describe("Porte ask — build plein accès par défaut", () => {
  it("confirmDangerous non défini : shell_command exécuté sans ask", async () => {
    const session = makeSession("ask-default");
    const r = await executor.execute(
      "shell_command",
      { command: "echo plein-acces" },
      provider, session, "build"
    );
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("plein-acces");
    expect(askEvents).toHaveLength(0);
  });
});

describe("Porte ask — confirmDangerous activé", () => {
  it("allow-once : outil exécuté, aucun grant persisté, redemande à la fois suivante", async () => {
    const session = makeSession("ask-allow-once", { confirmDangerous: true });
    const execPromise = executor.execute(
      "shell_command",
      { command: "echo allow-once-ok" },
      provider, session, "build"
    );

    await new Promise((r) => setTimeout(r, 30));
    expect(askEvents).toHaveLength(1);
    const { requestId, toolName, sessionId } = askEvents[0].data;
    expect(toolName).toBe("shell_command");
    expect(sessionId).toBe("ask-allow-once");
    expect(hasPendingPermissionRequest(requestId)).toBe(true);

    expect(resolvePermissionRequest(requestId, "allow-once")).toBe(true);
    const r = await execPromise;
    expect(r.isError).toBe(false);
    expect(String(r.output)).toContain("allow-once-ok");
    expect(sessionStore.get("ask-allow-once")?.permissionGrants?.shell_command).toBeUndefined();

    // Second appel → redemande (pas de grant)
    const execPromise2 = executor.execute(
      "shell_command",
      { command: "echo deux" },
      provider, sessionStore.get("ask-allow-once")!, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(askEvents).toHaveLength(2);
    resolvePermissionRequest(askEvents[1].data.requestId, "allow-once");
    const r2 = await execPromise2;
    expect(r2.isError).toBe(false);
  });

  it("deny-once : refus honnête, pas de grant, redemande ensuite", async () => {
    const session = makeSession("ask-deny-once", { confirmDangerous: true });
    const execPromise = executor.execute(
      "shell_command",
      { command: "echo refuse" },
      provider, session, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    resolvePermissionRequest(askEvents[0].data.requestId, "deny-once");

    const r = await execPromise;
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("Permission denied by user");
    expect(sessionStore.get("ask-deny-once")?.permissionGrants?.shell_command).toBeUndefined();

    const execPromise2 = executor.execute(
      "shell_command",
      { command: "echo encore" },
      provider, sessionStore.get("ask-deny-once")!, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(askEvents).toHaveLength(2);
    resolvePermissionRequest(askEvents[1].data.requestId, "deny-once");
    expect((await execPromise2).isError).toBe(true);
  });

  it("deny-always : grant persisté, second appel refusé SANS redemander", async () => {
    const session = makeSession("ask-deny-always", { confirmDangerous: true });
    const execPromise = executor.execute(
      "shell_command",
      { command: "echo jamais" },
      provider, session, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    resolvePermissionRequest(askEvents[0].data.requestId, "deny-always");
    expect((await execPromise).isError).toBe(true);
    expect(sessionStore.get("ask-deny-always")?.permissionGrants?.shell_command).toBe("deny");

    const r2 = await executor.execute(
      "shell_command",
      { command: "echo retry" },
      provider, sessionStore.get("ask-deny-always")!, "build"
    );
    expect(r2.isError).toBe(true);
    expect(String(r2.output)).toContain("always deny");
    expect(askEvents).toHaveLength(1); // aucune seconde demande
  });

  it("allow-always : grant persisté, second appel exécuté SANS redemander", async () => {
    const session = makeSession("ask-allow-always", { confirmDangerous: true });
    const execPromise = executor.execute(
      "shell_command",
      { command: "echo toujours-ok" },
      provider, session, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    resolvePermissionRequest(askEvents[0].data.requestId, "allow-always");
    expect((await execPromise).isError).toBe(false);
    expect(sessionStore.get("ask-allow-always")?.permissionGrants?.shell_command).toBe("allow");

    const r2 = await executor.execute(
      "shell_command",
      { command: "echo sans-ask" },
      provider, sessionStore.get("ask-allow-always")!, "build"
    );
    expect(r2.isError).toBe(false);
    expect(String(r2.output)).toContain("sans-ask");
    expect(askEvents).toHaveLength(1);
  });

  it("delete_file et git_commit sont aussi gated, pas read_file", async () => {
    const session = makeSession("ask-gated", { confirmDangerous: true });
    fs.writeFileSync(path.join(tmp, "victim.txt"), "x");

    const execPromise = executor.execute(
      "delete_file",
      { path: "victim.txt" },
      provider, session, "build"
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(askEvents).toHaveLength(1);
    expect(askEvents[0].data.toolName).toBe("delete_file");
    resolvePermissionRequest(askEvents[0].data.requestId, "deny-once");
    await execPromise;
    expect(fs.existsSync(path.join(tmp, "victim.txt"))).toBe(true);

    const rr = await executor.execute(
      "read_file",
      { path: "seed.txt" },
      provider, session, "build"
    );
    expect(rr.isError).toBe(false);
    expect(askEvents).toHaveLength(1); // read_file ne demande jamais
  });

  it("mode plan : shell refusé par permissions avant la porte ask", async () => {
    const session = makeSession("ask-plan", { confirmDangerous: true });
    const r = await executor.execute(
      "shell_command",
      { command: "echo x" },
      provider, session, "plan"
    );
    expect(r.isError).toBe(true);
    expect(String(r.output)).toContain("PERMISSION DENIED");
    expect(askEvents).toHaveLength(0);
  });
});

describe("createPermissionRequest — timeout & expiration", () => {
  it("timeout court → deny-once (safe default)", async () => {
    const { requestId, decision } = createPermissionRequest("s", "shell_command", {}, 100);
    expect(hasPendingPermissionRequest(requestId)).toBe(true);
    const d = await decision;
    expect(d).toBe("deny-once");
    expect(hasPendingPermissionRequest(requestId)).toBe(false);
  });

  it("resolvePermissionRequest sur requestId expiré/inconnu → false", () => {
    expect(resolvePermissionRequest("perm-inconnu", "allow-once")).toBe(false);
  });

  it("la constante de timeout par défaut vaut 30s", () => {
    expect(PERMISSION_ASK_TIMEOUT_MS).toBe(30_000);
  });
});
