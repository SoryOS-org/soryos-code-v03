/**
 * mcp-resource — accède aux ressources exposées par les serveurs MCP.
 * List et read les ressources (documents, records, etc.) des serveurs connectés.
 */

import { mcpManager } from "./mcp-manager";
import { McpListResourcesResult, McpResourceContent, McpResourceInfo, McpResourceTemplateInfo } from "./mcp-client";
import { globalEventBus } from "@soryos/bus";

export interface McpResourceResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const MAX_RESOURCE_CHARS = 50000;

function formatResourceList(server: string, data: McpListResourcesResult): string {
  const parts: string[] = [];

  if (data.resources.length > 0) {
    parts.push(`Resources (${data.resources.length}):`);
    for (const r of data.resources) {
      const desc = r.description ? ` — ${r.description}` : "";
      const mime = r.mimeType ? ` [${r.mimeType}]` : "";
      parts.push(`  - ${r.uri}${desc}${mime}`);
    }
  }

  if (data.templates.length > 0) {
    parts.push(`\nResource Templates (${data.templates.length}):`);
    for (const t of data.templates) {
      const desc = t.description ? ` — ${t.description}` : "";
      parts.push(`  - ${t.uriTemplate}${desc}`);
    }
  }

  if (parts.length === 0) {
    return `Server "${server}" exposes no resources.`;
  }

  return parts.join("\n");
}

function formatResourceContent(server: string, contents: McpResourceContent[]): string {
  if (contents.length === 0) {
    return `Server "${server}" returned no content for the resource.`;
  }

  const parts: string[] = [];
  for (const content of contents) {
    if (content.text !== undefined) {
      let text = content.text;
      if (text.length > MAX_RESOURCE_CHARS) {
        text = `${text.slice(0, MAX_RESOURCE_CHARS)}\n… [truncated after ${MAX_RESOURCE_CHARS} characters]`;
      }
      parts.push(text);
    } else if (content.blob !== undefined) {
      const bytes = Math.floor((content.blob.length * 3) / 4);
      const mime = content.mimeType ?? "application/octet-stream";
      parts.push(`[binary content: ${mime}, ~${bytes} bytes base64]`);
    } else if (content.uri) {
      parts.push(`[empty resource: ${content.uri}]`);
    }
  }

  return parts.join("\n");
}

export class McpResourceTools {
  /**
   * List resources from one or all connected MCP servers.
   */
  async listResources(server?: string): Promise<McpResourceResult> {
    const callId = `mcp-resources-${Date.now()}`;

    globalEventBus.emit("tool.started", {
      toolName: "list_mcp_resources",
      input: { server: server ?? "all" },
      callId,
    });

    try {
      if (server) {
        const data = await mcpManager.listServerResources(server);
        const output = formatResourceList(server, data);
        const metadata = {
          server,
          resourceCount: data.resources.length,
          templateCount: data.templates.length,
        };
        globalEventBus.emit("tool.completed", { toolName: "list_mcp_resources", output, callId, metadata });
        return { success: true, output, metadata };
      }

      // List from all connected servers
      const allResults = await mcpManager.listAllResources();
      if (allResults.size === 0) {
        const output = "No MCP servers are connected or none expose resources.";
        globalEventBus.emit("tool.completed", { toolName: "list_mcp_resources", output, callId, metadata: { serverCount: 0 } });
        return { success: true, output, metadata: { serverCount: 0 } };
      }

      const sections: string[] = [];
      let totalResources = 0;
      let totalTemplates = 0;

      for (const [srv, data] of allResults) {
        sections.push(`## Server: ${srv}\n${formatResourceList(srv, data)}`);
        totalResources += data.resources.length;
        totalTemplates += data.templates.length;
      }

      const output = sections.join("\n\n");
      const metadata = { serverCount: allResults.size, totalResources, totalTemplates };
      globalEventBus.emit("tool.completed", { toolName: "list_mcp_resources", output, callId, metadata });
      return { success: true, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "list_mcp_resources", error: message, callId });
      return { success: false, error: `Failed to list MCP resources: ${message}` };
    }
  }

  /**
   * Read a resource from a specific MCP server.
   */
  async readResource(server: string, uri: string): Promise<McpResourceResult> {
    const callId = `mcp-resource-read-${Date.now()}`;

    if (!server || !uri) {
      return { success: false, error: "Both server and uri are required." };
    }

    globalEventBus.emit("tool.started", {
      toolName: "read_mcp_resource",
      input: { server, uri },
      callId,
    });

    try {
      const contents = await mcpManager.readServerResource(server, uri);
      const output = formatResourceContent(server, contents);
      const metadata = {
        server,
        uri,
        contentCount: contents.length,
      };
      globalEventBus.emit("tool.completed", { toolName: "read_mcp_resource", output, callId, metadata });
      return { success: true, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "read_mcp_resource", error: message, callId });
      return { success: false, error: `Failed to read MCP resource: ${message}` };
    }
  }
}
