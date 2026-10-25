
export interface AgentRunOptions {
  sessionId: string;
  messageId?: string;
  streaming?: boolean;
  modelId?: string;
  agentId?: string;
  apiKey?: string;
  emit?: (event: any) => void;
}

export interface AgentRunResult {
  sessionId: string;
  messageId: string;
  output: string;
  exitCode: number;
  stderr?: string;
}

export interface AgentStep {
  type: 'tool-call' | 'tool-result' | 'message';
  content: any;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  toolName: string;
  args: any;
}

export interface ToolResult {
  toolName: string;
  result: any;
}

export interface AgentState {
  isRunning: boolean;
  currentSessionId?: string;
  currentMessageId?: string;
  isStreaming: boolean;
  lastError?: Error;
  lastErrorClassification?: any;
}

export interface SubagentDefinition {
  id: string;
  name: string;
  description: string;
  defaultPrompt: string;
  inputSchema: any;
  outputSchema: any;
  requiredTools: string[];
  /** Execution mode used for permission checks while the subagent runs its own tools. */
  mode?: string;
  /** Max LLM/tool iterations before returning a partial result. */
  maxToolCalls?: number;
}

export interface SubagentRunResult {
  success: boolean;
  output: string;
  error?: string;
  iterations: number;
  toolCalls: number;
  partial?: boolean;
  /** When isolation was requested and succeeded: kept worktree path (user can inspect/merge). */
  worktreePath?: string;
  worktreeBranch?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  model: string;
  provider: string;
  capabilities: string[];
  systemPrompt: string;
}

export interface BuiltContext {
  messages: any[];
  contextItems: ContextItem[];
  tokenCount: number;
}

export interface ContextItem {
  type: string;
  content: string;
  source: string;
}

export interface ContextOptions {
  maxTokens?: number;
  maxItems?: number;
  include?: string[];
  exclude?: string[];
}

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  type: 'task' | 'tool';
  tool?: string;
  parameters?: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  retryOnFailure?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  sessionId: string;
  userRequest?: string;
  workspaceId?: string;
  projectId?: string;
  mode?: string;
  model?: string;
  steps: PlanStep[];
  currentStepIndex: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  results: Record<string, any>;
  errors: Record<string, string>;
}

export interface PlannerConfig {
  maxSteps: number;
  maxParallelSteps: number;
  defaultTimeoutMs: number;
  defaultMaxRetries: number;
  retryOnFailure: boolean;
}

export interface PlannerOptions {
  sessionId: string;
  userRequest: string;
  model?: string;
  mode?: string;
  /** Vision input from the triggering user message (multimodal planning). */
  userImages?: Array<{ mimeType: string; data: string }>;
}

export interface PlanResult {
  plan?: Plan;
  success: boolean;
  message?: string;
  error?: string;
}
