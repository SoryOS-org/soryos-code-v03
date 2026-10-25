      
import { contextBuilder, ContextBuilder } from './context-builder';
import { ToolRegistry, ToolExecutor, mcpManager } from '@soryos/tool';
import { executionManager } from '@soryos/execution';
import { SessionData, ToolDefinition } from '@soryos/schema';
import { Plan, PlanStep, PlannerConfig, PlannerOptions, PlanResult } from './types';
import { sessionStore } from '@soryos/session';
import { LlmClient } from './llm-client';
import { PLANNER_SYSTEM_PROMPT, FEEDBACK_SYSTEM_PROMPT } from './prompts';
import { classifyError } from './error-handler';
import { SessionCompactor } from './session-compactor';

const DEFAULT_CONFIG: PlannerConfig = {
  maxSteps: 20,
  maxParallelSteps: 1,
  defaultTimeoutMs: 120000,
  defaultMaxRetries: 1,
  retryOnFailure: false,
};

const KNOWN_MODES = new Set([
  'build',
  'plan',
  'explore',
  'code-reviewer',
  'web-researcher',
  'live-voice',
  'custom',
]);

const MUTATING_TOOLS = new Set(['write_file', 'edit_file', 'delete_file', 'git_add', 'git_commit']);

const MAX_TOOL_OUTPUT_CHARS = 8000;
const MAX_FEEDBACK_ROUNDS = 3;
const MAX_TOTAL_STEPS = 40;
const FEEDBACK_RESULT_CHARS = 1500;

export interface AgentRunContext {
  mode: string;
  model?: string;
}

interface FeedbackResult {
  status: 'done' | 'continue';
  message?: string;
  steps?: Array<Record<string, any>>;
  error?: string;
}

type StepRunOutcome = 'completed' | 'failed' | 'paused';

function normalizeMode(agentId?: string): string {
  if (agentId && KNOWN_MODES.has(agentId)) return agentId;
  return 'build';
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_TOOL_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n… [output truncated after ${MAX_TOOL_OUTPUT_CHARS} characters]`;
}

function toPlanStep(step: Record<string, any>, planId: string, index: number): PlanStep {
  return {
    id: `${planId}-step-${index}`,
    name: step.name || `Step ${index + 1}`,
    description: step.description || '',
    type: step.type === 'tool' ? 'tool' : 'task',
    tool: step.toolName || step.tool,
    parameters: step.parameters,
    status: 'pending',
  };
}

export class Planner {
  private config: PlannerConfig;
  private contextBuilder: ContextBuilder;
  private toolRegistry: ToolRegistry;
  private llmClient: LlmClient;
  private toolExecutor: ToolExecutor;
  private compactor: SessionCompactor;
  private plans: Map<string, Plan> = new Map();

  constructor(
    contextBuilder: ContextBuilder,
    toolRegistry: ToolRegistry,
    llmClient: LlmClient,
    config: Partial<PlannerConfig> = {}
  ) {
    this.contextBuilder = contextBuilder;
    this.toolRegistry = toolRegistry;
    this.llmClient = llmClient;
    this.toolExecutor = new ToolExecutor(toolRegistry);
    this.compactor = new SessionCompactor(llmClient);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async planAndExecute(
    session: SessionData,
    emit: (event: any) => void,
    runOptions?: { agentId?: string; modelId?: string }
  ): Promise<'completed' | 'failed' | 'paused'> {
    const mode = normalizeMode(runOptions?.agentId);
    const model = runOptions?.modelId || session.model;

    if (runOptions?.modelId || runOptions?.agentId) {
      sessionStore.update(session.id, {
        ...(runOptions?.modelId ? { model: runOptions.modelId } : {}),
        ...(runOptions?.agentId ? { agentId: runOptions.agentId } : {}),
      });
    }

    const lastMessage = session.messages[session.messages.length - 1];
    if (!lastMessage || !lastMessage.content?.trim()) {
      emit({ type: 'error', message: 'Aucun message utilisateur à traiter.' });
      return 'failed';
    }
    const userRequest = lastMessage.content;

    // Connect configured MCP servers before planning so their tools are visible
    // to the LLM. Failures never block the run — connectServer reports a failed
    // status + bus event and returns honestly.
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      try {
        await mcpManager.ensureConnected(session);
      } catch {
        /* belt and braces: ensureConnected itself does not throw */
      }
    }

    // Compact long histories before planning (no-op under threshold;
    // on failure messages stay untouched — honest, never silent loss).
    await this.compactor.maybeCompact(session.id);

    emit({ type: 'status', message: 'Analyse de la demande…' });
    const planResult = await this.createPlan({
      sessionId: session.id,
      userRequest,
      model,
      mode,
      ...(lastMessage.images && lastMessage.images.length > 0
        ? { userImages: lastMessage.images }
        : {}),
    });

    if (!planResult.success || !planResult.plan) {
      const errorMessage = `Failed to create plan: ${planResult.error}`;
      emit({ type: 'error', message: errorMessage });

      const classification = classifyError(
        new Error(planResult.error || errorMessage),
        { sessionId: session.id }
      );
      const isTimeout = (planResult.error ?? '').toLowerCase().includes('timeout');
      const fresh = sessionStore.get(session.id) ?? session;
      const timeoutMessage = `⏱️ **Request Timed Out**\n\nThe AI took too long to respond. This can happen with complex tasks.\n\n**To continue:**\n• Send a new message to resume where we left off\n• Try breaking your request into smaller steps\n• Type "continue" to pick up from here\n\nYour progress has been saved.`;
      sessionStore.update(session.id, {
        errors: [
          ...(fresh.errors ?? []),
          {
            timestamp: new Date().toISOString(),
            type: classification.error.type,
            code: classification.error.code,
            message: classification.error.message,
            userMessage: classification.error.userMessage,
            recoverySuggestions: classification.error.recoverySuggestions,
          },
        ],
        ...(isTimeout
          ? { messages: [...fresh.messages, { id: `msg-${Date.now()}`, role: 'assistant' as const, content: timeoutMessage }] }
          : {}),
      });
      return 'failed';
    }

    const plan = planResult.plan;
    emit({ type: 'status', message: `Plan : ${plan.steps.length} étape(s). Exécution…` });

    return this.executePlan(plan.id, session.id, emit);
  }

  async createPlan(options: PlannerOptions): Promise<PlanResult> {
    const { sessionId, userRequest, model, mode } = options;
    const planId = `plan-${sessionId}-${Date.now()}`;

    try {
      const context = await this.contextBuilder.buildContext({ sessionId, userRequest });
      const tools: ToolDefinition[] = this.toolRegistry.getToolDefinitions();

      const toolDocs = tools
        .map((t) => {
          const params = Object.keys(t.parameters.properties);
          return `- ${t.name}: ${t.description}${params.length ? ` Parameters: ${params.join(', ')}.` : ''}`;
        })
        .join('\n');

      const systemPrompt = `${PLANNER_SYSTEM_PROMPT}\n\n# Available Tools\n${toolDocs}`;

      const history = sessionStore.get(sessionId)?.messages ?? [];
      const priorMessages = history
        .slice(0, -1)
        .slice(-12)
        .map((m) => `${m.role}: ${m.content.slice(0, 2000)}`)
        .join('\n\n');
      const contextBlock = context.contextItems.map(i => i.content).join('\n');
      const memorySummary = sessionStore.get(sessionId)?.memorySummary;
      const fullPrompt = [
        memorySummary ? `Earlier conversation (compacted memory):\n${memorySummary}\n` : '',
        priorMessages ? `Recent conversation:\n${priorMessages}\n` : '',
        `Context:\n${contextBlock}\n`,
        `User Request: ${userRequest}\n\nPlan:`,
      ].join('\n');

      const modelResponse = await this.llmClient.generate({
        prompt: fullPrompt,
        systemPrompt: systemPrompt,
        model: model || sessionStore.get(sessionId)?.model || 'claude-3-5-sonnet',
        sessionId,
        ...(options.userImages && options.userImages.length > 0 ? { images: options.userImages } : {}),
      });

      if (modelResponse.error) {
        throw new Error(modelResponse.error);
      }

      if (!modelResponse.text) {
        throw new Error('LLM failed to generate a plan. The response was empty.');
      }

      const jsonString = modelResponse.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const arrayMatch = jsonString.match(/\[[\s\S]*\]/);
      const rawSteps: Array<Record<string, any>> = JSON.parse(arrayMatch ? arrayMatch[0] : jsonString);

      if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
        throw new Error('LLM returned an empty plan (no steps).');
      }

      const steps: PlanStep[] = rawSteps
        .slice(0, this.config.maxSteps)
        .map((step, index) => toPlanStep(step, planId, index));

      const plan: Plan = {
        id: planId,
        name: userRequest.slice(0, 80),
        description: userRequest,
        sessionId,
        userRequest,
        mode: mode || 'build',
        model,
        steps,
        status: 'pending',
        currentStepIndex: 0,
        progress: 0,
        createdAt: Date.now(),
        results: {},
        errors: {},
      };

      this.plans.set(planId, plan);

      return { success: true, plan };

    } catch (error: any) {
      console.error(`[Planner] Error creating plan for session ${sessionId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async executePlan(planId: string, sessionId: string, emit: (event: any) => void): Promise<'completed' | 'failed' | 'paused'> {
    const plan = this.plans.get(planId);
    if (!plan) {
      emit({ type: 'error', message: `Plan ${planId} not found for execution.` });
      return 'failed';
    }

    const mode = plan.mode || 'build';

    for (let round = 0; round <= MAX_FEEDBACK_ROUNDS; round++) {
      plan.status = 'running';
      const outcome = await this.runPendingSteps(plan, sessionId, emit, mode);

      if (outcome === 'paused') {
        this.persistPause(plan, sessionId, emit);
        return 'paused';
      }

      const hasFailure = plan.steps.some((s) => s.status === 'failed');
      emit({ type: 'status', message: 'Analyse des résultats…' });
      const feedback = await this.requestFeedback(plan, sessionId);

      if (feedback.error) {
        if (outcome === 'completed' && !hasFailure) {
          this.finishPlan(plan, sessionId, emit, this.buildCompletionSummary(plan));
          return 'completed';
        }
        plan.status = 'failed';
        emit({ type: 'error', message: feedback.error });
        this.persistFailure(plan, sessionId, feedback.error);
        return 'failed';
      }

      if (feedback.status === 'done') {
        this.finishPlan(plan, sessionId, emit, feedback.message?.trim() || this.buildCompletionSummary(plan));
        return 'completed';
      }

      if (round >= MAX_FEEDBACK_ROUNDS) {
        const capped = `${feedback.message?.trim() || this.buildCompletionSummary(plan)}\n\n*(Limite d'itérations atteinte — résultats partiels.)*`;
        this.finishPlan(plan, sessionId, emit, capped);
        return 'completed';
      }

      const appended = this.appendFeedbackSteps(plan, feedback.steps);
      if (appended === 0) {
        this.finishPlan(plan, sessionId, emit, feedback.message?.trim() || this.buildCompletionSummary(plan));
        return 'completed';
      }
      emit({ type: 'status', message: `Plan révisé : ${appended} étape(s) supplémentaire(s).` });
    }

    this.persistFailure(plan, sessionId, 'Limite d\'itérations de feedback atteinte.');
    return 'failed';
  }

  private async runPendingSteps(
    plan: Plan,
    sessionId: string,
    emit: (event: any) => void,
    mode: string
  ): Promise<StepRunOutcome> {
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.status !== 'pending') continue;
      plan.currentStepIndex = i;

      const session = sessionStore.get(sessionId);
      if (!session || session.agent_running === false) {
        return 'paused';
      }

      const stepNumber = i + 1;
      step.status = 'running';
      emit({ type: 'status', message: `Étape ${stepNumber}/${plan.steps.length} — ${step.name}` });

      try {
        if (step.type === 'tool') {
          if (!step.tool) {
            throw new Error(`Tool step "${step.name}" is missing a tool name.`);
          }

          const toolInput = step.parameters ?? {};
          emit({ type: 'tool_start', id: step.id, name: step.tool, input: toolInput });

          const providerId = session.providerId || 'local';
          const provider = await executionManager.getProvider(sessionId, providerId);
          const result = await this.toolExecutor.execute(step.tool, toolInput, provider, session, mode);

          const outputText = truncateOutput(
            typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)
          );
          emit({ type: 'tool_end', id: step.id, output: outputText, isError: result.isError });

          if (result.isError) {
            throw new Error(outputText);
          }

          step.result = outputText;
          if (MUTATING_TOOLS.has(step.tool)) {
            emit({ type: 'files_changed', paths: [String(toolInput.path ?? toolInput.file ?? '')] });
          }
        } else if (step.type === 'task') {
          step.result = step.description
            ? `Étape de raisonnement : ${step.description}`
            : 'Étape de raisonnement complétée.';
        } else {
          throw new Error(`Unknown step type: "${step.type}"`);
        }

        step.status = 'completed';
        plan.results[step.id] = step.result;
        this.updateProgress(plan);

      } catch (error: any) {
        step.status = 'failed';
        step.error = error.message;
        plan.errors[step.id] = error.message;
        emit({
          type: 'status',
          message: `Étape « ${step.name} » échouée — analyse pour correction…`,
        });
        return 'failed';
      }
    }

    this.updateProgress(plan);
    return 'completed';
  }

  private async requestFeedback(plan: Plan, sessionId: string): Promise<FeedbackResult> {
    const resultsBlock = plan.steps
      .map((step, index) => {
        const body =
          step.status === 'failed'
            ? `ERROR: ${step.error || 'unknown failure'}`
            : String(step.result ?? step.description ?? '');
        const truncated =
          body.length > FEEDBACK_RESULT_CHARS
            ? `${body.slice(0, FEEDBACK_RESULT_CHARS)}…`
            : body;
        const toolInfo = step.tool ? ` tool=${step.tool}` : '';
        return `## Step ${index + 1}: ${step.name} [${step.status}]${toolInfo}\n${truncated}`;
      })
      .join('\n\n');

    const prompt =
      `Original user request:\n${plan.userRequest}\n\n` +
      `Execution results:\n${resultsBlock}\n\n` +
      `Review the results and respond with the JSON object only.`;

    const freshHistory = sessionStore.get(sessionId)?.messages ?? [];
    const lastUser = [...freshHistory].reverse().find((m) => m.role === 'user');
    const res = await this.llmClient.generate({
      prompt,
      systemPrompt: FEEDBACK_SYSTEM_PROMPT,
      model: plan.model || sessionStore.get(sessionId)?.model || 'claude-3-5-sonnet',
      sessionId,
      ...(lastUser?.images && lastUser.images.length > 0 ? { images: lastUser.images } : {}),
    });

    if (res.error) {
      return { status: 'done', error: res.error };
    }

    try {
      const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(objectMatch ? objectMatch[0] : cleaned);
      if (parsed.status !== 'done' && parsed.status !== 'continue') {
        return { status: 'done', error: 'Le modèle a renvoyé un statut invalide.' };
      }
      return {
        status: parsed.status,
        message: typeof parsed.message === 'string' ? parsed.message : undefined,
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { status: 'done', error: `Réponse illisible du modèle : ${message}` };
    }
  }

  private appendFeedbackSteps(plan: Plan, rawSteps?: Array<Record<string, any>>): number {
    if (!rawSteps || rawSteps.length === 0) return 0;
    let appended = 0;
    for (const raw of rawSteps) {
      if (plan.steps.length >= MAX_TOTAL_STEPS) break;
      if (!raw || typeof raw !== 'object') continue;
      const step = toPlanStep(raw, plan.id, plan.steps.length);
      plan.steps.push(step);
      appended++;
    }
    return appended;
  }

  private updateProgress(plan: Plan): void {
    const done = plan.steps.filter((s) => s.status === 'completed').length;
    plan.progress = plan.steps.length ? Math.round((done / plan.steps.length) * 100) : 0;
  }

  private finishPlan(plan: Plan, sessionId: string, emit: (event: any) => void, message: string): void {
    plan.status = 'completed';
    plan.completedAt = Date.now();
    this.updateProgress(plan);
    if (plan.progress < 100) plan.progress = 100;

    const fresh = sessionStore.get(sessionId);
    if (fresh) {
      sessionStore.update(sessionId, {
        messages: [
          ...fresh.messages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: message,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    emit({ type: 'text', delta: message });
    emit({ type: 'done' });
  }

  private persistPause(plan: Plan, sessionId: string, emit: (event: any) => void): void {
    plan.status = 'paused';
    const fresh = sessionStore.get(sessionId);
    if (fresh) {
      sessionStore.update(sessionId, {
        messages: [
          ...fresh.messages,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: `Exécution mise en pause à l'étape ${plan.currentStepIndex + 1}/${plan.steps.length} « ${plan.steps[plan.currentStepIndex]?.name ?? ''} ». Envoyez un message pour reprendre.`,
            created_at: new Date().toISOString(),
          },
        ],
      });
    }
    emit({ type: 'status', message: 'Exécution mise en pause.' });
  }

  private persistFailure(plan: Plan, sessionId: string, error: string): void {
    const fresh = sessionStore.get(sessionId);
    if (!fresh) return;
    const classification = classifyError(new Error(error), { sessionId });
    sessionStore.update(sessionId, {
      errors: [
        ...(fresh.errors ?? []),
        {
          timestamp: new Date().toISOString(),
          type: classification.error.type,
          code: classification.error.code,
          message: classification.error.message,
          userMessage: classification.error.userMessage || "L'agent n'a pas pu terminer cette demande.",
          recoverySuggestions: classification.error.recoverySuggestions,
        },
      ],
      messages: [
        ...fresh.messages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `L'agent n'a pas pu terminer cette demande. Voir les étapes exécutées pour le détail.`,
          created_at: new Date().toISOString(),
        },
      ],
    });
  }

  private buildCompletionSummary(plan: Plan): string {
    const failed = plan.steps.filter((s) => s.status === 'failed').length;
    const lines: string[] = [
      failed
        ? `Plan exécuté : ${plan.steps.length - failed}/${plan.steps.length} étape(s) réussie(s), ${failed} en échec.`
        : `Plan terminé : ${plan.steps.length} étape(s) exécutée(s).`,
    ];
    plan.steps.forEach((step, index) => {
      const mark = step.status === 'completed' ? '✓' : step.status === 'failed' ? '✗' : '○';
      const toolSuffix = step.tool ? ` — \`${step.tool}\`` : '';
      lines.push(`${index + 1}. ${mark} ${step.name}${toolSuffix}`);
      if (step.status === 'failed' && step.error) {
        lines.push(`   ↳ ${step.error.split('\n')[0]}`);
      }
    });
    return lines.join('\n');
  }

  async resumePlan(planId: string, sessionId: string, emit: (event: any) => void): Promise<'completed' | 'failed' | 'paused'> {
    const plan = this.plans.get(planId);
    if (!plan) {
      emit({ type: 'error', message: `Cannot resume: Plan ${planId} not found.` });
      return 'failed';
    }

    sessionStore.update(sessionId, { agent_running: true });
    return this.executePlan(plan.id, sessionId, emit);
  }

  getPlan(planId: string): Plan | undefined {
    return this.plans.get(planId);
  }

  getAllPlans(): Plan[] {
    return Array.from(this.plans.values());
  }
}
