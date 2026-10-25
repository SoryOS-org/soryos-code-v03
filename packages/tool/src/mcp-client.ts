/**
 * MCP client connection (Model Context Protocol, https://modelcontextprotocol.io).
 * Wraps the official @modelcontextprotocol/sdk Client over stdio (local server
 * spawned as a child process) or Streamable HTTP (remote server). Ported from
 * OpenCode's mcp/client.ts design, adapted to plain async/await.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "@soryos/schema";

export const DEFAULT_MCP_STARTUP_TIMEOUT_MS = 15_000;
export const DEFAULT_MCP_EXECUTION_TIMEOUT_MS = 60_000;

export interface McpToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface McpResourceInfo {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceTemplateInfo {
  uriTemplate: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

export interface McpListResourcesResult {
  resources: McpResourceInfo[];
  templates: McpResourceTemplateInfo[];
}

export interface McpCallToolResult {
  isError: boolean;
  /** All text parts joined with newlines; media parts are described, not inlined. */
  text: string;
  mediaCount: number;
  structured?: unknown;
}

export class McpConnectError extends Error {
  constructor(
    public readonly server: string,
    message: string
  ) {
    super(message);
    this.name = "McpConnectError";
  }
}

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string, server: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new McpConnectError(server, `${what} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

export class McpConnection {
  private constructor(
    public readonly server: string,
    public readonly client: Client,
    public readonly instructions: string | undefined,
    private readonly executionTimeoutMs: number
  ) {}

  static async connect(
    server: string,
    config: McpServerConfig,
    directory: string
  ): Promise<McpConnection> {
    const startupTimeout = config.startupTimeoutMs ?? DEFAULT_MCP_STARTUP_TIMEOUT_MS;
    const executionTimeout = config.executionTimeoutMs ?? DEFAULT_MCP_EXECUTION_TIMEOUT_MS;
    const client = new Client({ name: "soryos-code", version: "1.0.0" });

    let transport;
    if (config.type === "local") {
      transport = new StdioClientTransport({
        command: config.command,
        args: config.args ?? [],
        cwd: config.cwd ? `${directory}/${config.cwd}`.replace(/\/+/g, "/") : directory,
        env: { ...(config.environment ?? {}) },
        stderr: "pipe",
      });
    } else {
      let url: URL;
      try {
        url = new URL(config.url);
      } catch {
        throw new McpConnectError(server, `Invalid MCP URL for "${server}": ${config.url}`);
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new McpConnectError(
          server,
          `Unsupported MCP URL scheme "${url.protocol}" for "${server}" (http/https only)`
        );
      }
      transport = new StreamableHTTPClientTransport(url, {
        requestInit: config.headers ? { headers: config.headers } : undefined,
      });
    }

    try {
      await withTimeout(
        client.connect(transport),
        startupTimeout,
        `MCP connect to "${server}"`,
        server
      );
    } catch (error) {
      try {
        await transport.close();
      } catch {
        /* best-effort cleanup */
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new McpConnectError(server, `Failed to connect MCP server "${server}": ${message}`);
    }

    const instructions = client.getInstructions()?.trim() || undefined;
    return new McpConnection(server, client, instructions, executionTimeout);
  }

  async listTools(): Promise<McpToolInfo[]> {
    try {
      const result = await this.client.listTools(undefined, {
        timeout: DEFAULT_MCP_STARTUP_TIMEOUT_MS,
      });
      return (result.tools ?? []).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
        outputSchema: (tool as { outputSchema?: Record<string, unknown> }).outputSchema,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpConnectError(this.server, `Failed to list tools of "${this.server}": ${message}`);
    }
  }

  async listResources(): Promise<McpListResourcesResult> {
    try {
      const [resourcesResult, templatesResult] = await Promise.all([
        this.client.listResources(undefined, { timeout: DEFAULT_MCP_STARTUP_TIMEOUT_MS }).catch(() => ({ resources: [] })),
        this.client.listResourceTemplates(undefined, { timeout: DEFAULT_MCP_STARTUP_TIMEOUT_MS }).catch(() => ({ resourceTemplates: [] })),
      ]);

      const resources: McpResourceInfo[] = (resourcesResult.resources ?? []).map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));

      const templates: McpResourceTemplateInfo[] = (templatesResult.resourceTemplates ?? []).map((t) => ({
        uriTemplate: t.uriTemplate,
        name: t.name,
        description: t.description,
        mimeType: t.mimeType,
      }));

      return { resources, templates };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpConnectError(this.server, `Failed to list resources of "${this.server}": ${message}`);
    }
  }

  async readResource(uri: string): Promise<McpResourceContent[]> {
    try {
      const result = await this.client.readResource(
        { uri },
        { timeout: this.executionTimeoutMs }
      );

      return (result.contents ?? []).map((content) => {
        const c = content as { uri: string; mimeType?: string; text?: string; blob?: string };
        return {
          uri: c.uri,
          mimeType: c.mimeType,
          text: c.text,
          blob: c.blob,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpConnectError(this.server, `Failed to read resource "${uri}" on "${this.server}": ${message}`);
    }
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallToolResult> {
    const result = await this.client.callTool({ name, arguments: args }, undefined, {
      timeout: this.executionTimeoutMs,
    });
    const parts = (result.content ?? []) as Array<
      | { type: "text"; text: string }
      | { type: "image" | "audio"; data: string; mimeType: string }
      | { type: "resource"; resource: { text?: string; blob?: string; mimeType?: string; uri?: string } }
      | { type: "resource_link"; uri: string }
      | { type: string; [key: string]: unknown }
    >;
    const textParts: string[] = [];
    let mediaCount = 0;
    for (const part of parts) {
      if (part.type === "text" && typeof part.text === "string") {
        textParts.push(part.text);
      } else if (part.type === "image" || part.type === "audio") {
        mediaCount += 1;
        const bytes = typeof part.data === "string" ? Math.floor((part.data.length * 3) / 4) : 0;
        textParts.push(`[media content: ${String(part.mimeType ?? part.type)}, ~${bytes} bytes base64 elided]`);
      } else if (part.type === "resource_link" && typeof part.uri === "string") {
        textParts.push(part.uri);
      } else if (part.type === "resource") {
        const resource = (part as { resource?: Record<string, unknown> }).resource;
        if (resource && typeof resource === "object") {
          if (typeof resource.text === "string") {
            textParts.push(resource.text);
          } else if (typeof resource.blob === "string") {
            mediaCount += 1;
            const mimeType =
              typeof resource.mimeType === "string" ? resource.mimeType : "application/octet-stream";
            textParts.push(
              `[media content: ${mimeType}, ~${Math.floor((resource.blob.length * 3) / 4)} bytes base64 elided]`
            );
          } else if (typeof resource.uri === "string") {
            textParts.push(resource.uri);
          }
        }
      }
    }
    const structured = (result as { structuredContent?: unknown }).structuredContent;
    return {
      isError: result.isError === true,
      text: textParts.join("\n"),
      mediaCount,
      structured,
    };
  }

  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      /* transport already gone */
    }
  }
}
