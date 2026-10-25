import { describe, it, expect, vi, beforeEach } from "vitest";
import { define, isPlugin, type Plugin, type PluginContext, type PermissionEvaluation, type PluginBusEvent } from "../src/index";
import { createPluginContext } from "../src/host";
import { resolvePluginEntry, loadPlugin, unloadPlugin } from "../src/loader";
import { toolRegistry, ToolExecutor } from "@soryos/tool";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";

// Mock the tool registry
const originalToolRegistry = toolRegistry;

describe("@soryos/plugin", () => {
  beforeEach(() => {
    // Clear any existing handler overrides
    (ToolExecutor as any).handlerOverrides.clear();
  });

  it("defines a plugin with type inference", () => {
    const plugin = define({
      id: "test-plugin",
      setup: () => {},
    });
    expect(plugin.id).toBe("test-plugin");
    expect(typeof plugin.setup).toBe("function");
  });

  it("validates a plugin", () => {
    expect(isPlugin({ id: "test", setup: () => {} })).toBe(true);
    expect(isPlugin({ id: "test", setup: "not a function" })).toBe(false);
    expect(isPlugin({ setup: () => {} })).toBe(false);
    expect(isPlugin(null)).toBe(false);
  });

  it("creates a plugin context", () => {
    const ctx = createPluginContext({
      id: "session-123",
      title: "Test Session",
      model: "gpt-4o",
      provider: "openai",
    } as any);
    expect(ctx.session).toBeDefined();
    expect(ctx.tool).toBeDefined();
    expect(ctx.permission).toBeDefined();
    expect(ctx.event).toBeDefined();
    expect(ctx.storage).toBeDefined();
  });

  it("adds a tool via plugin context", () => {
    const ctx = createPluginContext();
    const originalCount = toolRegistry.getToolDefinitions().length;
    
    // Mock the handler registration
    const mockHandler = vi.fn(async () => ({ toolName: "test_tool", output: "success", isError: false }));
    
    ctx.tool.add({
      id: "test_tool",
      name: "test_tool",
      description: "A test tool",
      category: "filesystem", // Using a valid category
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Input parameter" },
        },
        required: ["input"],
      },
    }, mockHandler);
    
    expect(toolRegistry.getToolDefinitions().length).toBe(originalCount + 1);
    expect(toolRegistry.has("test_tool")).toBe(true);
    expect((ToolExecutor as any).handlerOverrides.has("test_tool")).toBe(true);
  });

  it("hooks into permission evaluation", async () => {
    const ctx = createPluginContext();
    const hook = vi.fn();
    const registration = await ctx.permission.hook(hook);
    
    // Mock a permission evaluation
    const evaluation: PermissionEvaluation = {
      toolName: "test_tool",
      mode: "build",
      args: {},
      effect: "allow",
    };
    
    // Call the hook directly
    await hook(evaluation);
    expect(evaluation.effect).toBe("allow");
    
    // Cleanup
    await registration.dispose();
  });

  it("subscribes to bus events", async () => {
    const ctx = createPluginContext();
    const callback = vi.fn();
    const registration = await ctx.event.subscribe(callback);
    
    // Mock a bus event
    const busEvent: PluginBusEvent = {
      type: "test.event",
      payload: { foo: "bar" },
    };
    
    // Call the callback directly
    callback(busEvent);
    expect(callback).toHaveBeenCalledWith(busEvent);
    
    // Cleanup
    await registration.dispose();
  });

  it("loads a plugin (mocked)", async () => {
    // Create a temporary plugin file
    const tempDir = await fs.mkdtemp(path.join(__dirname, "temp-plugin-"));
    const mockFile = path.join(tempDir, "index.ts");
    await fs.writeFile(
      mockFile,
      `export default { id: "test-plugin", setup: () => {} };`
    );
    
    try {
      const result = await loadPlugin("./index.ts", createPluginContext(), {
        directory: tempDir,
      });
      expect(result.id).toBe("test-plugin");
      expect(result.source).toBe("./index.ts");
      expect(result.cleanup).toBeNull();
    } finally {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("unloads a plugin", async () => {
    const result = {
      id: "test-plugin",
      source: "test",
      cleanup: vi.fn(),
    };
    
    await unloadPlugin(result);
    expect(result.cleanup).toHaveBeenCalled();
  });
});

describe("@soryos/plugin storage backend", () => {
  it("persists get/set/remove/scan to disk (real filesystem)", async () => {
    const { createPluginStorage } = await import("../src/storage");
    const tempDir = await fs.mkdtemp(path.join(__dirname, "temp-storage-"));
    try {
      const storage = createPluginStorage("test-plugin", tempDir);

      // Initially empty
      expect(await storage.scan()).toEqual([]);
      expect(await storage.get("missing")).toBeNull();

      // set + get round-trip
      await storage.set("config", { theme: "dark", retries: 3 });
      expect(await storage.get("config")).toEqual({ theme: "dark", retries: 3 });
      expect(await storage.scan()).toEqual(["config"]);

      // Physically written to disk
      const file = path.join(tempDir, "test-plugin.json");
      expect(fsSync.existsSync(file)).toBe(true);
      const raw = JSON.parse(fsSync.readFileSync(file, "utf8"));
      expect(raw.config).toEqual({ theme: "dark", retries: 3 });

      // remove
      await storage.remove("config");
      expect(await storage.get("config")).toBeNull();
      expect(await storage.scan()).toEqual([]);
      // Empty namespace file is cleaned up
      expect(fsSync.existsSync(file)).toBe(false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("isolates storage per namespace", async () => {
    const { createPluginStorage } = await import("../src/storage");
    const tempDir = await fs.mkdtemp(path.join(__dirname, "temp-ns-"));
    try {
      const a = createPluginStorage("plugin-a", tempDir);
      const b = createPluginStorage("plugin-b", tempDir);

      await a.set("key", "value-a");
      await b.set("key", "value-b");

      expect(await a.get("key")).toBe("value-a");
      expect(await b.get("key")).toBe("value-b");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("memory storage works without touching disk", async () => {
    const { createMemoryStorage } = await import("../src/storage");
    const mem = createMemoryStorage();
    await mem.set("k", 42);
    expect(await mem.get("k")).toBe(42);
    expect(await mem.scan()).toEqual(["k"]);
    await mem.remove("k");
    expect(await mem.get("k")).toBeNull();
  });

  it("plugin context uses filesystem storage when namespace provided", async () => {
    const { createPluginContext } = await import("../src/host");
    const ctx = createPluginContext(undefined, "ctx-test-plugin");
    // Default root is cwd/.soryos/plugin-storage — verify real persistence
    await ctx.storage.set("probe", "persisted");
    expect(await ctx.storage.get("probe")).toBe("persisted");
    await ctx.storage.remove("probe");
    // Cleanup: ensure no leftover file
    const file = path.join(process.cwd(), ".soryos/plugin-storage/ctx-test-plugin.json");
    expect(fsSync.existsSync(file)).toBe(false);
  });

  it("plugin context uses isolated memory storage without namespace", async () => {
    const { createPluginContext } = await import("../src/host");
    const ctx = createPluginContext();
    await ctx.storage.set("k", "v");
    expect(await ctx.storage.get("k")).toBe("v");
    // Not written to disk
    const file = path.join(process.cwd(), ".soryos/plugin-storage/default.json");
    expect(fsSync.existsSync(file)).toBe(false);
  });
});