/**
 * MCP manager: connects configured Model Context Protocol servers and exposes
 * their tools as first-class registry tools (mcp_<server>__<tool>).
 * One connection per server name, process-global (like OpenCode's global MCP
 * registry); sessions declare which servers they use via SessionData.mcpServers.
 */
import type { McpServerConfig, McpServerStatus, SessionData, ToolDefinition, ToolExecutionResult } from "@soryos/schema";
import { globalEventBus } from "@soryos/bus";
import { McpConnection, McpConnectError, McpListResourcesResult, McpResourceContent } from "./mcp-client";
import { ToolExecutor, toolRegistry } from "./index";

/** Registry-safe name for an MCP tool: mcp_<server>__<tool>, sanitized. */
export function mcpToolName(server: string, tool: string): string {
  const san = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `mcp_${san(server)}__${san(tool)}`;
}

interface McpServerEntry {
  connection: McpConnection;
  toolNames: string[];
  status: McpServerStatus;
}

class McpManager {
  private servers = new Map<string, McpServerEntry>();
  private connecting = new Map<string, Promise<McpServerEntry>>();

  /**
   * Connects a server and registers its tools into the global registry.
   * Idempotent per server name: an already-connected server is reused.
   * Never throws: failures are reported as a "failed" status + bus event.
   */
  async connectServer(
    server: string,
    config: McpServerConfig,
    options: { directory: string }
  ): Promise<McpServerStatus> {
    const existing = this.servers.get(server);
    if (existing) return existing.status;

    const inFlight = this.connecting.get(server);
    if (inFlight) {
      const entry = await inFlight;
      return entry.status;
    }

    const attempt = this.connectAndRegister(server, config, options.directory);
    this.connecting.set(server, attempt);
    try {
      const entry = await attempt;
      return entry.status;
    } finally {
      this.connecting.delete(server);
    }
  }

  private async connectAndRegister(
    server: string,
    config: McpServerConfig,
    directory: string
  ): Promise<McpServerEntry> {
    try {
      const connection = await McpConnection.connect(server, config, directory);
      const tools = await connection.listTools();
      const toolNames: string[] = [];

      for (const tool of tools) {
        const fullName = mcpToolName(server, tool.name);
        const rawSchema = (tool.inputSchema ?? {}) as Record<string, unknown>;
        const definition: ToolDefinition = {
          id: fullName,
          name: fullName,
          description: `[MCP:${server}] ${tool.description ?? tool.name}`,
          category: "mcp",
          // JSON Schema passthrough for LLM visibility; executor only enforces `required`.
          // Real-world servers often omit `required`/`properties` — normalize defensively.
          parameters: {
            type: "object",
            properties: (rawSchema.properties ?? {}) as ToolDefinition["parameters"]["properties"],
            required: Array.isArray(rawSchema.required) ? (rawSchema.required as string[]) : [],
          },
        };
        toolRegistry.add(definition);
        toolNames.push(fullName);

        ToolExecutor.registerHandler(fullName, async (args: Record<string, unknown>): Promise<ToolExecutionResult> => {
          try {
            const result = await connection.callTool(tool.name, args ?? {});
            const output = result.isError
              ? result.text || `MCP tool "${tool.name}" on server "${server}" returned an error`
              : result.text || "OK";
            return {
              toolName: fullName,
              output,
              isError: result.isError,
              metadata: {
                server,
                mcpTool: tool.name,
                mediaCount: result.mediaCount,
                ...(result.structured !== undefined ? { structured: true } : {}),
              },
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
              toolName: fullName,
              output: `MCP tool call failed on server "${server}" (tool "${tool.name}"): ${message}`,
              isError: true,
            };
          }
        });
      }

      const status: McpServerStatus = {
        server,
        state: "connected",
        toolCount: tools.length,
        instructions: connection.instructions,
      };
      const entry: McpServerEntry = { connection, toolNames, status };
      this.servers.set(server, entry);

      globalEventBus.emit("mcp.server.connected", { server, toolCount: tools.length });
      globalEventBus.emit("mcp.tools.registered", { server, tools: toolNames });
      return entry;
    } catch (error) {
      const message =
        error instanceof McpConnectError
          ? error.message
          : error instanceof Error
            ? error.message
            : String(error);
      const status: McpServerStatus = {
        server,
        state: "failed",
        toolCount: 0,
        error: message,
      };
      globalEventBus.emit("mcp.server.failed", { server, error: message });
      // Failed entries are kept so ensureConnected reports honestly without retry storms;
      // disconnectServer clears them and allows a fresh attempt.
      const failedEntry: McpServerEntry = {
        connection: null as unknown as McpConnection,
        toolNames: [],
        status,
      };
      this.servers.set(server, failedEntry);
      return failedEntry;
    }
  }

  /**
   * Disconnects a server, removing its tools from the registry and executor.
   * Returns false when the server is unknown.
   */
  async disconnectServer(server: string): Promise<boolean> {
    const entry = this.servers.get(server);
    if (!entry) return false;
    this.servers.delete(server);
    for (const toolName of entry.toolNames) {
      toolRegistry.remove(toolName);
      ToolExecutor.unregisterHandler(toolName);
    }
    if (entry.connection) {
      await entry.connection.close();
    }
    globalEventBus.emit("mcp.server.disconnected", { server, removedTools: entry.toolNames.length });
    return true;
  }

  /** Connects every server declared in session.mcpServers that is not yet connected. */
  async ensureConnected(session: SessionData): Promise<McpServerStatus[]> {
    const configs = session.mcpServers ?? {};
    const statuses: McpServerStatus[] = [];
    for (const [server, config] of Object.entries(configs)) {
      statuses.push(await this.connectServer(server, config, { directory: session.cwd || process.cwd() }));
    }
    return statuses;
  }

  listServers(): McpServerStatus[] {
    return Array.from(this.servers.values(), (entry) => entry.status);
  }

  getServer(server: string): McpServerStatus | undefined {
    return this.servers.get(server)?.status;
  }

  isConnected(server: string): boolean {
    return this.servers.get(server)?.status.state === "connected";
  }

  /** Lists resources from a specific connected server. */
  async listServerResources(server: string): Promise<McpListResourcesResult> {
    const entry = this.servers.get(server);
    if (!entry || !entry.connection) {
      throw new McpConnectError(server, `MCP server "${server}" is not connected`);
    }
    return entry.connection.listResources();
  }

  /** Lists resources from all connected servers. */
  async listAllResources(): Promise<Map<string, McpListResourcesResult>> {
    const results = new Map<string, McpListResourcesResult>();
    for (const [server, entry] of this.servers) {
      if (entry.connection && entry.status.state === "connected") {
        try {
          results.set(server, await entry.connection.listResources());
        } catch {
          // Server doesn't support resources or failed; skip silently
        }
      }
    }
    return results;
  }

  /** Reads a resource from a specific server. */
  async readServerResource(server: string, uri: string): Promise<McpResourceContent[]> {
    const entry = this.servers.get(server);
    if (!entry || !entry.connection) {
      throw new McpConnectError(server, `MCP server "${server}" is not connected`);
    }
    return entry.connection.readResource(uri);
  }

  /** Test hook: clears all connections without graceful close. */
  reset(): void {
    for (const entry of this.servers.values()) {
      for (const toolName of entry.toolNames) {
        toolRegistry.remove(toolName);
        ToolExecutor.unregisterHandler(toolName);
      }
      if (entry.connection) {
        void entry.connection.close();
      }
    }
    this.servers.clear();
    this.connecting.clear();
  }
}

export const mcpManager = new McpManager();
