import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalExecutionProvider } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";
import type { AgentEventPayload, McpServerConfig, SessionData } from "@soryos/schema";
import {
  ToolExecutor,
  toolRegistry,
  mcpManager,
  mcpToolName,
} from "@soryos/tool";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";

const FIXTURE = fileURLToPath(new URL("./fixtures/mcp-echo-server.mjs", import.meta.url));

let tmp: string;
let provider: LocalExecutionProvider;
const executor = new ToolExecutor(toolRegistry);

const fixtureConfig: McpServerConfig = {
  type: "local",
  command: process.execPath,
  args: [FIXTURE],
  startupTimeoutMs: 10_000,
  executionTimeoutMs: 10_000,
};

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

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "soryos-mcp-test-"));
  provider = new LocalExecutionProvider(tmp);
});

afterEach(async () => {
  mcpManager.reset();
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("mcpToolName — sanitization", () => {
  it("préfixe mcp_ et sépare serveur/outil par double underscore", () => {
    expect(mcpToolName("github", "create_issue")).toBe("mcp_github__create_issue");
  });

  it("neutralise les caractères non alphanumériques", () => {
    expect(mcpToolName("my server!", "do/it")).toBe("mcp_my_server___do_it");
  });
});

describe("MCP — connexion réelle (serveur stdio @modelcontextprotocol/sdk)", () => {
  it("connecte le fixture, enregistre ses outils, événements bus émis", async () => {
    const events: AgentEventPayload[] = [];
    const off = globalEventBus.on("*", (e: AgentEventPayload) => events.push(e));

    const status = await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    off();

    expect(status.state).toBe("connected");
    expect(status.toolCount).toBe(4);
    expect(toolRegistry.has("mcp_fixture__echo")).toBe(true);
    expect(toolRegistry.has("mcp_fixture__add")).toBe(true);
    expect(toolRegistry.has("mcp_fixture__boom")).toBe(true);
    expect(toolRegistry.has("mcp_fixture__pixel")).toBe(true);
    expect(ToolExecutor.hasOverride("mcp_fixture__echo")).toBe(true);

    const connected = events.filter((e) => e.type === "mcp.server.connected");
    const registered = events.filter((e) => e.type === "mcp.tools.registered");
    expect(connected.length).toBe(1);
    expect(registered.length).toBe(1);
  }, 20_000);

  it("appel de bout en bout via ToolExecutor : echo", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-echo");

    const r = await executor.execute(
      "mcp_fixture__echo",
      { text: "hello mcp" },
      provider,
      session,
      "build"
    );

    expect(r.isError).toBe(false);
    expect(r.output).toBe("hello mcp");
    expect(r.metadata).toMatchObject({ server: "fixture", mcpTool: "echo" });
  }, 20_000);

  it("add : calcul réel côté serveur MCP", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-add");

    const r = await executor.execute("mcp_fixture__add", { a: 2, b: 40 }, provider, session, "build");

    expect(r.isError).toBe(false);
    expect(r.output).toBe("42");
  }, 20_000);

  it("isError du serveur → résultat isError honnête", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-boom");

    const r = await executor.execute("mcp_fixture__boom", {}, provider, session, "build");

    expect(r.isError).toBe(true);
    expect(r.output).toContain("fixture exploded");
  }, 20_000);

  it("partie média → décrite (base64 elided), pas injectée en masse", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-media");

    const r = await executor.execute("mcp_fixture__pixel", {}, provider, session, "build");

    expect(r.isError).toBe(false);
    expect(r.output).toContain("[media content: image/png");
    expect(r.output).toContain("base64 elided");
    expect(r.metadata).toMatchObject({ mediaCount: 1 });
  }, 20_000);

  it("paramètre requis manquant → validation executor honnête", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-required");

    const r = await executor.execute("mcp_fixture__echo", {}, provider, session, "build");

    expect(r.isError).toBe(true);
    expect(r.output).toContain('Missing required parameter "text"');
  }, 20_000);

  it("mode plan → PERMISSION DENIED (outils MCP non read-only)", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const session = makeSession("mcp-plan");

    const r = await executor.execute(
      "mcp_fixture__echo",
      { text: "x" },
      provider,
      session,
      "plan"
    );

    expect(r.isError).toBe(true);
    expect(r.output).toContain("PERMISSION DENIED");
  }, 20_000);

  it("connectServer idempotent : second appel réutilise la connexion", async () => {
    const first = await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    const second = await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    expect(second.state).toBe("connected");
    expect(second.toolCount).toBe(first.toolCount);
    expect(mcpManager.listServers().length).toBe(1);
  }, 20_000);
});

describe("MCP — disconnect", () => {
  it("retire les outils du registry et de l'executor", async () => {
    await mcpManager.connectServer("fixture", fixtureConfig, { directory: tmp });
    expect(toolRegistry.has("mcp_fixture__echo")).toBe(true);

    const removed = await mcpManager.disconnectServer("fixture");

    expect(removed).toBe(true);
    expect(toolRegistry.has("mcp_fixture__echo")).toBe(false);
    expect(ToolExecutor.hasOverride("mcp_fixture__echo")).toBe(false);
    expect(mcpManager.getServer("fixture")).toBeUndefined();

    const session = makeSession("mcp-disc");
    const r = await executor.execute(
      "mcp_fixture__echo",
      { text: "x" },
      provider,
      session,
      "build"
    );
    expect(r.isError).toBe(true);
    expect(r.output).toContain("Unknown tool");
  }, 20_000);

  it("serveur inconnu → false", async () => {
    expect(await mcpManager.disconnectServer("nope")).toBe(false);
  });
});

describe("MCP — échecs honnêtes", () => {
  it("commande inexistante → status failed + événement + zéro outil", async () => {
    const events: AgentEventPayload[] = [];
    const off = globalEventBus.on("mcp.server.failed", (e: AgentEventPayload) => events.push(e));

    const status = await mcpManager.connectServer(
      "broken",
      { type: "local", command: "definitely-not-a-real-binary-xyz-123", startupTimeoutMs: 5_000 },
      { directory: tmp }
    );
    off();

    expect(status.state).toBe("failed");
    expect(status.error).toBeTruthy();
    expect(status.toolCount).toBe(0);
    expect(events.length).toBe(1);
    expect(toolRegistry.has("mcp_broken__anything")).toBe(false);
  }, 20_000);

  it("URL invalide → failed avec message explicite", async () => {
    const status = await mcpManager.connectServer(
      "badurl",
      { type: "remote", url: "not a url" },
      { directory: tmp }
    );
    expect(status.state).toBe("failed");
    expect(status.error).toContain("Invalid MCP URL");
  }, 15_000);

  it("scheme non supporté → failed", async () => {
    const status = await mcpManager.connectServer(
      "ftpsrv",
      { type: "remote", url: "ftp://example.com/mcp" },
      { directory: tmp }
    );
    expect(status.state).toBe("failed");
    expect(status.error).toContain("Unsupported MCP URL scheme");
  }, 15_000);
});

describe("MCP — ensureConnected (SessionData.mcpServers)", () => {
  it("connecte tous les serveurs déclarés sur la session", async () => {
    const session = makeSession("mcp-ensure");
    session.mcpServers = { fixture: fixtureConfig };
    sessionStore.save(session);

    const statuses = await mcpManager.ensureConnected(session);

    expect(statuses.length).toBe(1);
    expect(statuses[0]!.state).toBe("connected");
    expect(mcpManager.isConnected("fixture")).toBe(true);

    const r = await executor.execute(
      "mcp_fixture__echo",
      { text: "via-session" },
      provider,
      session,
      "build"
    );
    expect(r.output).toBe("via-session");
  }, 20_000);

  it("session sans mcpServers → liste vide, aucun connection attempt", async () => {
    const session = makeSession("mcp-noservers");
    session.mcpServers = undefined;
    sessionStore.save(session);
    const statuses = await mcpManager.ensureConnected(session);
    expect(statuses).toEqual([]);
  });
});
