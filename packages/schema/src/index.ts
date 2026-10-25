/**
 * @soryos/schema
 * Central types and domain contracts for SoryOS-Code.
 */

export * from "./events";

// 1. Workspace Contracts
export type ProviderId = "local" | "github-codespaces" | "github-repository" | "e2b" | "vercel" | "google-cloud-run";

export type WorkspaceStatus = "NO_WORKSPACE" | "WORKSPACE_LOADING" | "WORKSPACE_READY" | "WORKSPACE_ERROR";

export interface ActiveWorkspace {
  id: string;
  projectId: string;
  sessionId: string;
  title: string;
  environment: "local" | "sandbox";
  providerId: ProviderId;
  workspacePath: string;
  repository?: string;
  branch?: string;
  commit?: string;
  codespaceId?: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

// 2. Execution Contracts
export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  background?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface FileEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  sizeBytes: number;
  updatedAt: string;
}

// 3. Tool Contracts
export interface ToolPropertySchema {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: "filesystem" | "shell" | "process" | "git" | "planning" | "web" | "agent" | "mcp";
  parameters: {
    type: "object";
    properties: Record<string, ToolPropertySchema>;
    required: string[];
  };
}

export interface ToolExecutionResult {
  toolName: string;
  output: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
  verified?: boolean;
}

export interface ToolStep {
  id: string;
  name: string;
  input: Record<string, unknown> | any;
  output?: string;
  error?: string;
  status: "pending" | "running" | "done" | "error" | "success" | "cancelled";
  startedAt?: string;
  completedAt?: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
}

// 4. Message & Session Contracts
export interface MessageBlock {
  type: "text" | "tool" | "thought" | "error" | "question";
  content?: string;
  step?: ToolStep;
  question?: {
    id: string;
    text: string;
    options?: string[];
    answered?: boolean;
    answer?: string;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  blocks?: MessageBlock[];
  created_at?: string;
  /** Image attachments (vision input); base64 raw data, no data: prefix. */
  images?: ChatImageAttachment[];
}

export interface ChatImageAttachment {
  mimeType: string;
  /** Raw base64 (no `data:` prefix). Capped by MAX_IMAGE_ATTACHMENT_BYTES. */
  data: string;
}

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

/** Per-image cap (~3 MB base64 ≈ 2.25 MB binary). */
export const MAX_IMAGE_ATTACHMENT_BYTES = 3_000_000;

/**
 * Validates image attachments at the boundary that owns them (chat route).
 * Returns a human-readable error, or null when valid.
 */
export function validateChatImages(images: unknown): string | null {
  if (!Array.isArray(images)) return "images must be an array";
  if (images.length > 4) return "At most 4 image attachments are allowed";
  for (const image of images) {
    if (!image || typeof image !== "object") return "Each image must be an object {mimeType, data}";
    const { mimeType, data } = image as { mimeType?: unknown; data?: unknown };
    if (typeof mimeType !== "string" || !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return `Unsupported image mimeType "${String(mimeType)}" (allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")})`;
    }
    if (typeof data !== "string" || data.length === 0) {
      return "Each image must include non-empty base64 data";
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return "Image data is not valid base64";
    }
    if (data.length > MAX_IMAGE_ATTACHMENT_BYTES) {
      return `Image too large (${data.length} base64 chars, max ${MAX_IMAGE_ATTACHMENT_BYTES})`;
    }
  }
  return null;
}

export interface SessionError {
  timestamp: string;
  type: string;
  code: string;
  message: string;
  userMessage?: string;
  recoverySuggestions?: string[];
}

export interface TodoItem {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed";
}

// 4b. MCP (Model Context Protocol) Server Contracts
export type McpServerConfig =
  | {
      /** Local stdio server: spawned as a child process wherever execution runs. */
      type: "local";
      command: string;
      args?: string[];
      environment?: Record<string, string>;
      cwd?: string;
      /** Handshake timeout (default 15 000 ms). */
      startupTimeoutMs?: number;
      /** Per tool-call timeout (default 60 000 ms). */
      executionTimeoutMs?: number;
    }
  | {
      /** Remote Streamable HTTP server. OAuth is not supported yet; use static headers. */
      type: "remote";
      url: string;
      headers?: Record<string, string>;
      startupTimeoutMs?: number;
      executionTimeoutMs?: number;
    };

export type McpServerState = "connecting" | "connected" | "failed" | "disconnected";

export interface McpServerStatus {
  server: string;
  state: McpServerState;
  toolCount: number;
  instructions?: string;
  error?: string;
}

export interface SessionData {
  id: string;
  title: string;
  sandbox_id: string;
  sandbox_state: "running" | "paused" | "dead";
  environment: "sandbox" | "local";
  providerId: ProviderId;
  codespaceId?: string;
  repository?: string;
  branch?: string;
  workspaceState?: WorkspaceStatus;
  workspaceError?: string;
  model: string;
  provider: string;
  created_at: string;
  messages: ChatMessage[];
  files: Record<string, string>;
  openFiles: string[];
  activeFile: string;
  preview_url: string | null;
  needs_run: boolean;
  agent_running: boolean;
  agentId?: string;
  cwd: string;
  errors?: SessionError[];
  todos?: TodoItem[];
  /** Compact summary of archived conversation history (see SessionCompactor). */
  memorySummary?: string;
  /** Per-session tool grants written by the "ask" flow (allow-always / deny-always). */
  permissionGrants?: Record<string, "allow" | "deny">;
  /** When true, dangerous tools (shell_command, delete_file, git_commit) trigger a permission ask. */
  confirmDangerous?: boolean;
  /** MCP servers this session may use; connected on demand by the agent planner. */
  mcpServers?: Record<string, McpServerConfig>;
}

// 5. Event Bus Contracts
export type AgentEventType =
  | "session.created"
  | "session.updated"
  | "agent.started"
  | "agent.thinking"
  | "agent.text"
  | "agent.completed"
  | "agent.failed"
  | "agent.status"
  | "agent.streaming.started"
  | "agent.streaming.text"
  | "agent.streaming.ended"
  | "agent.streaming.error"
  | "agent.tool.started"
  | "agent.tool.completed"
  | "agent.tool.failed"
  | "agent.tool.call"
  | "agent.tool.result"
  | "agent.tool.write"
  | "agent.tool.edit"
  | "agent.tool.read"
  | "agent.tool.bash"
  | "agent.tool.todo"
  | "agent.error"
  | "tool.started"
  | "tool.output"
  | "tool.completed"
  | "tool.failed"
  | "file.changed"
  | "process.started"
  | "process.output"
  | "process.ready"
  | "process.failed"
  | "process.exited"
  | "permission.requested"
  | "permission.granted"
  | "permission.denied"
  | "subagent.started"
  | "subagent.completed"
  | "subagent.failed"
  | "session.compacted"
  | "question.asked"
  | "mcp.server.connected"
  | "mcp.server.failed"
  | "mcp.server.disconnected"
  | "mcp.tools.registered"
  | "status";

export interface AgentEventPayload {
  sessionId: string;
  timestamp: string;
  type: AgentEventType;
  data: Record<string, unknown>;
}

// 6. Legacy SSE event types — DEPRECATED since Phase 3 (shared CLI/GUI interface).
// Use the canonical contract instead: `SoryOSEvent` (see ./events.ts).
/** @deprecated Use `SoryOSEvent` from `@soryos/schema` (canonical contract). */
export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "preview"; url: string }
  | { type: "files_changed"; paths: string[] }
  | { type: "status"; message: string }
  | { type: "done"; usage?: { input: number; output: number; cacheRead: number; cacheMiss: number } }
  | { type: "error"; message: string };

// 7. Agent Mode & Permissions
export type AgentRoleMode = "build" | "plan" | "explore" | "code-reviewer" | "web-researcher" | "live-voice" | "custom";

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  badge: string;
  icon: string;
  color: string;
  mode: "primary" | "subagent" | "all";
  tools: string[];
  systemPrompt: string;
  whenToUse: string;
  capabilities: string[];
}

// 8. Environment Types
export type EnvironmentType = "sandbox" | "local";
