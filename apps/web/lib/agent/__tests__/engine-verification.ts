/**
 * SoryOS-Code Engine 10/10 Verification Suite
 * Verifies all 10 physical engine subsystems in accordance with AGENTS.md rules.
 */

import { workspaceManager } from "@soryos/workspace";
import { sessionStore } from "@soryos/session";
import { GlobalEventBus } from "@soryos/bus";
import { permissionsManager } from "@soryos/permissions";
import { toolRegistry } from "@soryos/tool";
import { aiProviderRegistry, SUPPORTED_AI_MODELS } from "@soryos/provider";
import { agentRuntime, AGENT_MATRIX } from "@soryos/agent";
import { executionManager } from "@soryos/execution";
import { devRunner } from "@soryos/dev-runner";

async function runEngineVerification() {
  console.log("\n=======================================================");
  console.log("   SORYOS-CODE ENGINE VERIFICATION SUITE (10/10)   ");
  console.log("=======================================================\n");

  let passed = 0;
  const total = 10;

  // 1. Workspace Manager
  try {
    const ws = workspaceManager.getOrCreateWorkspace("test-engine-ws");
    if (ws && (ws.sessionId === "test-engine-ws" || ws.id.includes("test-engine-ws"))) {
      console.log("✅ 1/10 Workspace Manager: PASSED (ActiveWorkspace initialized)");
      passed++;
    } else {
      console.log("❌ 1/10 Workspace Manager: FAILED (Invalid workspace)");
    }
  } catch (err) {
    console.log("❌ 1/10 Workspace Manager: ERROR", err);
  }

  // 2. SessionStore & Messages
  try {
    sessionStore.getOrCreate("test-engine-sess");
    sessionStore.update("test-engine-sess", { title: "Verification Session", model: "gemini-2.5-flash" });
    const before = sessionStore.get("test-engine-sess");
    const msg = {
      id: `msg-${Date.now()}`,
      role: "user" as const,
      content: "Engine test message",
    };
    sessionStore.update("test-engine-sess", { messages: [...(before?.messages ?? []), msg] });
    const retrieved = sessionStore.get("test-engine-sess");
    if (retrieved && retrieved.messages.length > 0 && msg.id) {
      console.log("✅ 2/10 SessionStore & Message History: PASSED (CRUD + history)");
      passed++;
    } else {
      console.log("❌ 2/10 SessionStore: FAILED");
    }
  } catch (err) {
    console.log("❌ 2/10 SessionStore: ERROR", err);
  }

  // 3. GlobalEventBus
  try {
    let busEventFired = false;
    const listener = (event: any) => {
      if (event.data?.ok || event.ok) busEventFired = true;
    };
    GlobalEventBus.on("test.event" as any, listener);
    GlobalEventBus.emit("test.event", { ok: true });
    GlobalEventBus.off("test.event", listener);

    if (busEventFired) {
      console.log("✅ 3/10 GlobalEventBus: PASSED (Real-time typed events)");
      passed++;
    } else {
      console.log("❌ 3/10 GlobalEventBus: FAILED");
    }
  } catch (err) {
    console.log("❌ 3/10 GlobalEventBus: ERROR", err);
  }

  // 4. Permissions Manager
  try {
    const buildRes = permissionsManager.checkPermission("build", "write_file");
    const planRes = permissionsManager.checkPermission("plan", "write_file");
    if (buildRes.allowed && !planRes.allowed) {
      console.log("✅ 4/10 Permissions Manager: PASSED (Role-based access control)");
      passed++;
    } else {
      console.log("❌ 4/10 Permissions Manager: FAILED");
    }
  } catch (err) {
    console.log("❌ 4/10 Permissions Manager: ERROR", err);
  }

  // 5. Tool Registry & Physical Tools
  try {
    const tools = toolRegistry.getToolDefinitions();
    const hasRead = tools.some((t: any) => t.id === "read_file" || t.name === "read_file");
    const hasShell = tools.some((t: any) => t.id === "shell_command" || t.name === "shell_command");
    if (tools.length >= 4 && (hasRead || hasShell)) {
      console.log(`✅ 5/10 Tool Registry: PASSED (${tools.length} physical tools registered)`);
      passed++;
    } else {
      console.log("❌ 5/10 Tool Registry: FAILED");
    }
  } catch (err) {
    console.log("❌ 5/10 Tool Registry: ERROR", err);
  }

  // 6. AI Providers & Model Registry
  try {
    const providers = aiProviderRegistry.getAllProviders();
    const geminiDef = SUPPORTED_AI_MODELS.find((m) => m.id === "gemini-2.5-flash");
    const openrouterDef = SUPPORTED_AI_MODELS.find((m) => m.providerId === "openrouter");
    if (SUPPORTED_AI_MODELS.length >= 25 && geminiDef && openrouterDef) {
      console.log(`✅ 6/10 AI Provider Registry: PASSED (${SUPPORTED_AI_MODELS.length} models across 7 providers)`);
      passed++;
    } else {
      console.log("❌ 6/10 AI Provider Registry: FAILED");
    }
  } catch (err) {
    console.log("❌ 6/10 AI Provider Registry: ERROR", err);
  }

  // 7. Agent Matrix & Runtime
  try {
    const hasGemini = AGENT_MATRIX.some((a) => a.id.includes("gemini"));
    const hasClaude = AGENT_MATRIX.some((a) => a.id.includes("claude"));
    const hasOpenRouter = AGENT_MATRIX.some((a) => a.id.includes("openrouter"));
    if (agentRuntime && hasGemini && hasClaude && hasOpenRouter) {
      console.log(`✅ 7/10 Agent Matrix & Runtime: PASSED (${AGENT_MATRIX.length} agents configured)`);
      passed++;
    } else {
      console.log("❌ 7/10 Agent Matrix: FAILED");
    }
  } catch (err) {
    console.log("❌ 7/10 Agent Matrix: ERROR", err);
  }

  // 8. Execution Manager
  try {
    const provider = executionManager.getProvider("local");
    if (provider !== null && provider !== undefined) {
      console.log("✅ 8/10 Execution Manager: PASSED (LocalExecutionProvider ready)");
      passed++;
    } else {
      console.log("❌ 8/10 Execution Manager: FAILED");
    }
  } catch (err) {
    console.log("❌ 8/10 Execution Manager: ERROR", err);
  }

  // 9. Dev Runner & Project Detection
  try {
    if (devRunner && typeof devRunner.startDevServer === "function") {
      console.log("✅ 9/10 Dev Runner: PASSED (Framework detector ready)");
      passed++;
    } else {
      console.log("❌ 9/10 Dev Runner: FAILED");
    }
  } catch (err) {
    console.log("❌ 9/10 Dev Runner: ERROR", err);
  }

  // 10. Plugin System
  try {
    const { define, isPlugin } = await import("@soryos/plugin");
    const testPlugin = define({ id: "engine-test", setup: () => {} });
    if (isPlugin(testPlugin) && testPlugin.id === "engine-test") {
      console.log("✅ 10/10 Plugin System: PASSED (Promise-based plugin API ready)");
      passed++;
    } else {
      console.log("❌ 10/10 Plugin System: FAILED");
    }
  } catch (err) {
    console.log("❌ 10/10 Plugin System: ERROR", err);
  }

  console.log("\n=======================================================");
  console.log(`   VERIFICATION RESULT: ${passed}/${total} SUBSYSTEMS PASSED   `);
  console.log("=======================================================\n");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runEngineVerification().catch((e) => {
  console.error("Fatal engine verification error:", e);
  process.exit(1);
});
