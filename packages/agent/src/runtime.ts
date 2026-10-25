
import { AgentRunOptions, AgentState } from './types';
import { contextBuilder } from './context-builder';
import { Planner } from './planner';
import { sessionStore } from '@soryos/session';
import { toolRegistry } from '@soryos/tool';
import { globalEventBus } from '@soryos/bus';
import { llmClient, LlmClient } from './llm-client';
import { EventEmitter } from 'events';

export interface AgentRuntimeDeps {
  llmClient?: LlmClient;
}

export class AgentRuntime extends EventEmitter {
  private state: AgentState = { isRunning: false, isStreaming: false };
  private runningSessions: Set<string> = new Set();
  private planner: Planner | undefined;
  private deps: AgentRuntimeDeps;

  constructor(deps: AgentRuntimeDeps = {}) {
    super();
    this.deps = deps;
  }

  private getPlanner(): Planner {
    if (this.planner) {
      return this.planner;
    }
    this.planner = new Planner(contextBuilder, toolRegistry, this.deps.llmClient ?? llmClient);
    return this.planner;
  }

  async run(options: AgentRunOptions): Promise<'completed' | 'failed' | 'paused'> {
    if (this.runningSessions.has(options.sessionId)) {
      throw new Error('Agent is already running for this session.');
    }

    this.runningSessions.add(options.sessionId);
    this.state.isRunning = true;
    this.state.currentSessionId = options.sessionId;
    this.state.currentMessageId = options.messageId;
    this.emit('start', options);
    globalEventBus.emit('agent.started', {
      sessionId: options.sessionId,
      agentId: options.agentId,
      messageId: options.messageId,
    });

    try {
      const planner = this.getPlanner();
      const session = sessionStore.get(options.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${options.sessionId}`);
      }
      const result = await planner.planAndExecute(session, (event) => {
        this.emit('event', event);
        options.emit?.(event);
      }, { agentId: options.agentId, modelId: options.modelId });

      if (result === 'failed') {
        globalEventBus.emit('agent.failed', {
          sessionId: options.sessionId,
          message: "L'agent n'a pas pu terminer cette demande — voir les erreurs de la session.",
        });
      } else if (result === 'completed') {
        globalEventBus.emit('agent.completed', { sessionId: options.sessionId });
      }
      return result;
    } catch (error) {
      if (error instanceof Error) {
        this.state.lastError = error;
      }
      globalEventBus.emit('agent.failed', {
        sessionId: options.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
      this.emit('error', error);
      throw error;
    } finally {
      this.runningSessions.delete(options.sessionId);
      this.state.isRunning = this.runningSessions.size > 0;
      this.emit('end');
    }
  }

  getState(): AgentState {
    return { ...this.state };
  }
}

export const agentRuntime = new AgentRuntime();
