/**
 * MCP server management for a session (pass-through).
 * Business logic lives in @soryos/tool (mcpManager).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@soryos/session";
import { mcpManager } from "@soryos/tool";
import type { McpServerConfig } from "@soryos/schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = sessionStore.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const configured = Object.keys(session.mcpServers ?? {});
  const servers = mcpManager
    .listServers()
    .filter((status) => configured.length === 0 || configured.includes(status.server));
  return NextResponse.json({ servers });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = sessionStore.get(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: {
    action?: "connect" | "disconnect" | "disconnect_all";
    server?: string;
    config?: McpServerConfig;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (action === "connect") {
    const server = body.server;
    if (!server) {
      return NextResponse.json({ error: "Missing \"server\"" }, { status: 400 });
    }
    const config = body.config ?? session.mcpServers?.[server];
    if (!config) {
      return NextResponse.json(
        { error: `No MCP config for "${server}" (provide body.config or set session.mcpServers)` },
        { status: 400 }
      );
    }
    if (config.type !== "local" && config.type !== "remote") {
      return NextResponse.json({ error: "Invalid MCP config type" }, { status: 400 });
    }
    const status = await mcpManager.connectServer(server, config, {
      directory: session.cwd || process.cwd(),
    });
    return NextResponse.json({ server: status }, { status: status.state === "failed" ? 502 : 200 });
  }

  if (action === "disconnect") {
    const server = body.server;
    if (!server) {
      return NextResponse.json({ error: "Missing \"server\"" }, { status: 400 });
    }
    const removed = await mcpManager.disconnectServer(server);
    return NextResponse.json({ removed });
  }

  if (action === "disconnect_all") {
    const configured = Object.keys(session.mcpServers ?? {});
    const results: Record<string, boolean> = {};
    for (const server of configured) {
      results[server] = await mcpManager.disconnectServer(server);
    }
    return NextResponse.json({ removed: results });
  }

  return NextResponse.json(
    { error: "Invalid action (expected connect | disconnect | disconnect_all)" },
    { status: 400 }
  );
}
