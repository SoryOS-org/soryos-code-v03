import { toolRegistry, ToolExecutor, WorktreeTools } from '@soryos/tool';
import { executionManager, LocalExecutionProvider, ExecutionProvider } from '@soryos/execution';
import { globalEventBus } from '@soryos/bus';
import { sessionStore } from '@soryos/session';
import { SessionData, ToolDefinition, ToolExecutionResult } from '@soryos/schema';
import { llmClient, LlmClient } from './llm-client';
import { SubagentDefinition, SubagentRunResult } from './types';

const MAX_TOOL_OUTPUT_CHARS = 6000;
const MAX_TRANSCRIPT_MESSAGES = 24;

export const SUBAGENT_DEFINITIONS: SubagentDefinition[] = [
  {
    id: 'explore',
    name: 'Explore',
    description:
      'Read-only codebase exploration specialist. Use for: finding files, understanding structure, answering "where/how is X implemented" questions. Never modifies anything.',
    defaultPrompt:
      'You are an explore agent. Investigate the codebase using your read-only tools (read_file, list_files, glob_files, grep_search, codebase_search). Report precise file paths and line references. Never attempt to modify files.',
    inputSchema: {},
    outputSchema: {},
    requiredTools: ['read_file', 'list_files', 'glob_files', 'grep_search'],
    mode: 'explore',
    maxToolCalls: 12,
  },
  {
    id: 'plan',
    name: 'Plan',
    description:
      'Architecture and planning specialist. Use for: designing implementation strategies, analyzing trade-offs, producing step-by-step plans. Read-only.',
    defaultPrompt:
      'You are a planning agent. Analyze the request and the codebase (read-only tools) and produce a concrete, ordered implementation plan with file paths and responsibilities. Do not modify files.',
    inputSchema: {},
    outputSchema: {},
    requiredTools: ['read_file', 'list_files', 'glob_files', 'grep_search', 'webfetch'],
    mode: 'plan',
    maxToolCalls: 10,
  },
  {
    id: 'coder',
    name: 'Coder',
    description:
      'Implementation specialist. Use for: focused coding tasks (write/edit files, run commands). Has full build-mode tool access scoped to the delegated task.',
    defaultPrompt:
      'You are a coder agent. Implement the delegated task using your tools (read/write/edit files, shell). Verify your changes. Keep the change minimal and focused on the task.',
    inputSchema: {},
    outputSchema: {},
    requiredTools: ['read_file', 'write_file', 'edit_file', 'shell_command'],
    mode: 'build',
    maxToolCalls: 15,
  },
];

export function getSubagentDefinition(id: string): SubagentDefinition | undefined {
  return SUBAGENT_DEFINITIONS.find((d) => d.id === id);
}

export function listSubagentIds(): string[] {
  return SUBAGENT_DEFINITIONS.map((d) => d.id);
}

function truncate(text: string): string {
  if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n… [truncated after ${MAX_TOOL_OUTPUT_CHARS} characters]`;
}

interface ParsedSubagentReply {
  toolCalls?: Array<{ tool?: string; parameters?: Record<string, any> }>;
  final?: string | null;
}

function parseReply(text: string): ParsedSubagentReply | null {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!objectMatch) return null;
  try {
    const parsed = JSON.parse(objectMatch[0]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ParsedSubagentReply;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * REAL subagent runner: a bounded LLM + tool loop.
 * The subagent talks to the LLM, executes its allowed tools through the
 * real ToolExecutor (permissions enforced per subagent mode), and returns
 * a real final answer — or an honest error/partial result.
 */
export class SubagentManager {
  private llm: LlmClient;
  private executor: ToolExecutor;

  constructor(llm?: LlmClient, executor?: ToolExecutor) {
    this.llm = llm ?? llmClient;
    this.executor = executor ?? new ToolExecutor(toolRegistry);
  }

  async run(input: {
    definitionId: string;
    prompt: string;
    session: SessionData;
    model?: string;
    /** Run all tool calls inside an isolated git worktree (local providers only; kept + reported). */
    isolate?: boolean;
  }): Promise<SubagentRunResult> {
    const { prompt, session } = input;
    const definition = getSubagentDefinition(input.definitionId);
    if (!definition) {
      return {
        success: false,
        output: '',
        error: `Unknown subagent "${input.definitionId}". Available: ${listSubagentIds().join(', ')}.`,
        iterations: 0,
        toolCalls: 0,
      };
    }
    if (!prompt?.trim()) {
      return { success: false, output: '', error: 'Subagent prompt must not be empty.', iterations: 0, toolCalls: 0 };
    }

    const callId = `subagent-${definition.id}-${Date.now()}`;
    globalEventBus.emit('subagent.started', {
      subagentId: definition.id,
      sessionId: session.id,
      callId,
      prompt: truncate(prompt),
    });

    const model = input.model || session.model;
    const maxCalls = definition.maxToolCalls ?? 10;
    const mode = definition.mode || 'build';

    // Optional worktree isolation: all tool calls run inside a fresh git
    // worktree so parallel subagents never fight over the same files.
    // The worktree is KEPT and reported (never silently discarded).
    let provider: ExecutionProvider = await executionManager.getProvider(
      session.id,
      session.providerId || 'local'
    );
    let worktreeInfo: { path: string; branch: string } | undefined;
    const isolationNotes: string[] = [];
    if (input.isolate) {
      if (provider.type !== 'local') {
        isolationNotes.push(
          `[isolation] Worktree isolation requires a local provider (got "${provider.type}"); running in the main workspace.`
        );
      } else {
        const created = await new WorktreeTools(provider).createWorktree({
          name: `${definition.id}-${Date.now()}`,
        });
        const wtPath = created.metadata?.path;
        const wtBranch = created.metadata?.branch;
        if (created.success && typeof wtPath === 'string' && typeof wtBranch === 'string') {
          worktreeInfo = { path: wtPath, branch: wtBranch };
          // No init(): the worktree already contains the checked-out files.
          provider = new LocalExecutionProvider(wtPath);
          isolationNotes.push(`[isolation] Running inside worktree ${wtPath} (branch ${wtBranch}).`);
        } else {
          isolationNotes.push(
            `[isolation] Worktree creation failed: ${created.error ?? 'unknown error'}; running in the main workspace.`
          );
        }
      }
    }
    const withWorktree = (result: SubagentRunResult): SubagentRunResult => ({
      ...result,
      ...(worktreeInfo
        ? { worktreePath: worktreeInfo.path, worktreeBranch: worktreeInfo.branch }
        : {}),
    });

    const systemPrompt = [
      definition.defaultPrompt,
      '',
      'You can call tools. To call tools, respond with ONLY a JSON object:',
      '{"toolCalls":[{"tool":"<tool_name>","parameters":{...}}],"final":null}',
      'After receiving tool results, either call more tools or answer with:',
      '{"toolCalls":[],"final":"<your final answer>"}',
      'If you do not need any tools, respond directly with the final answer text (no JSON).',
      '',
      `Tools you may use (enforced): ${definition.requiredTools.join(', ')}.`,
    ].join('\n');

    const transcript: string[] = [`Task: ${prompt}`, ...isolationNotes];
    let toolCalls = 0;
    let iterations = 0;

    try {
      while (iterations < maxCalls) {
        const fresh = sessionStore.get(session.id);
        if (fresh && fresh.agent_running === false) {
          globalEventBus.emit('subagent.failed', {
            subagentId: definition.id,
            sessionId: session.id,
            callId,
            error: 'Paused by user.',
          });
          return withWorktree({
            success: false,
            output: '',
            error: 'Subagent paused: the session was stopped by the user.',
            iterations,
            toolCalls,
          });
        }

        iterations++;
        const res = await this.llm.generate({
          prompt: transcript.join('\n\n'),
          systemPrompt,
          model,
          sessionId: session.id,
        });

        if (res.error) {
          globalEventBus.emit('subagent.failed', {
            subagentId: definition.id,
            sessionId: session.id,
            callId,
            error: res.error,
          });
          return withWorktree({ success: false, output: '', error: `Subagent LLM error: ${res.error}`, iterations, toolCalls });
        }

        const reply = parseReply(res.text);
        const calls = (reply?.toolCalls ?? []).filter((c) => c && typeof c.tool === 'string');

        if (calls.length === 0) {
          const finalText = (reply?.final && String(reply.final)) || res.text;
          globalEventBus.emit('subagent.completed', {
            subagentId: definition.id,
            sessionId: session.id,
            callId,
            iterations,
            toolCalls,
          });
          return withWorktree({ success: true, output: finalText, iterations, toolCalls });
        }

        for (const call of calls) {
          toolCalls++;
          const toolName = call.tool as string;
          const parameters = call.parameters ?? {};
          let resultLine: string;
          try {
            if (!toolRegistry.has(toolName)) {
              throw new Error(
                `Subagent tried to use unknown tool "${toolName}". Allowed tools: ${definition.requiredTools.join(', ')}.`
              );
            }
            const result: ToolExecutionResult = await this.executor.execute(
              toolName,
              parameters,
              provider,
              session,
              mode
            );
            resultLine = `## Tool result: ${toolName}\n${truncate(
              typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)
            )}${result.isError ? '\n(this call FAILED)' : ''}`;
          } catch (error) {
            resultLine = `## Tool result: ${toolName}\nERROR: ${error instanceof Error ? error.message : String(error)}`;
          }
          transcript.push(`Called tool: ${toolName} ${JSON.stringify(parameters)}\n${resultLine}`);
        }

        while (transcript.length > MAX_TRANSCRIPT_MESSAGES + 1) {
          transcript.splice(1, 1);
        }
      }

      globalEventBus.emit('subagent.completed', {
        subagentId: definition.id,
        sessionId: session.id,
        callId,
        iterations,
        toolCalls,
        partial: true,
      });
      return withWorktree({
        success: true,
        partial: true,
        output:
          `Subagent "${definition.id}" reached its ${maxCalls}-tool-call limit. ` +
          `Tool outputs so far:\n\n${truncate(transcript.slice(1).join('\n\n'))}`,
        iterations,
        toolCalls,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit('subagent.failed', {
        subagentId: definition.id,
        sessionId: session.id,
        callId,
        error: message,
      });
      return withWorktree({ success: false, output: '', error: `Subagent crashed: ${message}`, iterations, toolCalls });
    }
  }
}

export const TASK_TOOL_DEFINITION: ToolDefinition = {
  id: 'task',
  name: 'task',
  description:
    'Delegates a focused subtask to a specialist subagent and returns its final answer. ' +
    'Subagents are: explore (read-only codebase investigation), plan (read-only architecture/planning), ' +
    'coder (focused implementation with write/shell access). ' +
    'Use task when a subtask benefits from an isolated context window; include ALL necessary details in the prompt.',
  category: 'agent',
  parameters: {
    type: 'object',
    properties: {
      subagent: {
        type: 'string',
        description: `Subagent id. One of: ${listSubagentIds().join(', ')}.`,
      },
      prompt: {
        type: 'string',
        description: 'Complete, self-contained task prompt for the subagent (file paths, goal, constraints).',
      },
      isolate: {
        type: 'boolean',
        description:
          'Run the subagent inside an isolated git worktree (local providers only). The worktree is kept and its path is reported for later inspection/merge.',
      },
    },
    required: ['subagent', 'prompt'],
  },
};

/**
 * Injects the `task` tool into the global registry + executor override map.
 * Called at @soryos/agent import time; calling again re-points the handler
 * (e.g. tests injecting a stub LLM) — registration is idempotent.
 */
export function registerTaskTool(llm?: LlmClient): void {
  toolRegistry.add(TASK_TOOL_DEFINITION);
  const manager = new SubagentManager(llm);

  ToolExecutor.registerHandler('task', async (args, ctx) => {
    const subagent = typeof args.subagent === 'string' ? args.subagent.trim() : '';
    const prompt = typeof args.prompt === 'string' ? args.prompt : '';
    if (!subagent) {
      return {
        toolName: 'task',
        output: `Missing required parameter "subagent". Available: ${listSubagentIds().join(', ')}.`,
        isError: true,
      };
    }
    if (!prompt.trim()) {
      return { toolName: 'task', output: 'Parameter "prompt" must not be empty.', isError: true };
    }

    const result = await manager.run({
      definitionId: subagent,
      prompt,
      session: ctx.session,
      model: ctx.session.model,
      isolate: args.isolate === true,
    });

    if (!result.success) {
      const failExtra = result.worktreePath
        ? `\n(Worktree kept at ${result.worktreePath} on branch ${result.worktreeBranch})`
        : '';
      return { toolName: 'task', output: (result.error ?? 'Subagent failed.') + failExtra, isError: true };
    }

    const header = result.partial
      ? `[PARTIAL] Subagent "${subagent}" output (tool-call limit reached):\n`
      : `[SUBAGENT ${subagent}] output:\n`;
    const worktreeNote = result.worktreePath
      ? `\n\n[worktree] Changes are isolated in ${result.worktreePath} (branch ${result.worktreeBranch}). Inspect with git diff there, then merge or discard.`
      : '';
    return {
      toolName: 'task',
      output: header + result.output + worktreeNote,
      isError: false,
      metadata: {
        subagent: subagent,
        iterations: result.iterations,
        toolCalls: result.toolCalls,
        partial: result.partial ?? false,
        ...(result.worktreePath
          ? { worktreePath: result.worktreePath, worktreeBranch: result.worktreeBranch }
          : {}),
      },
    };
  });
}
