import { SessionData, ChatImageAttachment, toSoryOSEvent, type SoryOSEvent } from "@soryos/schema";
import { sessionStore } from "@soryos/session";
import { workspaceManager } from "@soryos/workspace";
import { globalEventBus } from "@soryos/bus";
import { agentRuntime, type AgentRuntime } from "./runtime";
import type { AgentRunOptions } from "./types";

export interface RunPipelineOptions {
  sessionId: string;
  /** Requête utilisateur (ajoutée à la session si fournie). */
  prompt?: string;
  /** Pièces jointes (vision) attachées au message utilisateur. */
  images?: ChatImageAttachment[];
  agentId?: string;
  modelId?: string;
  apiKey?: string;
}

export type RunPipelineResult =
  | { status: "completed"; session: SessionData }
  | { status: "failed"; session: SessionData | null; error: string };

/**
 * Crée un pipeline branché sur un runtime donné.
 * Utile pour les tests (runtime avec un faux LLM) : l'API publique
 * `runPipeline()` reste liée au runtime global.
 */
export function createRunPipeline(runtime: AgentRuntime) {
  return async function runPipelineWith(
    options: RunPipelineOptions,
    emit: (event: SoryOSEvent) => void,
  ): Promise<RunPipelineResult> {
    return runPipelineInternal(runtime, options, emit);
  };
}

export async function runPipeline(
  options: RunPipelineOptions,
  emit: (event: SoryOSEvent) => void,
): Promise<RunPipelineResult> {
  return runPipelineInternal(agentRuntime, options, emit);
}

async function runPipelineInternal(
  runtime: AgentRuntime,
  options: RunPipelineOptions,
  emit: (event: SoryOSEvent) => void,
): Promise<RunPipelineResult> {
  const { sessionId, prompt, images, agentId, modelId, apiKey } = options;
  let lastErrorMessage: string | undefined;

  const session = sessionStore.get(sessionId);
  if (!session) {
    return {
      status: "failed",
      session: null,
      error: `Session not found: ${sessionId}`,
    };
  }

  // Le message utilisateur fait partie du pipeline : les adaptateurs (CLI, web)
  // ne font que le fournir, jamais l'ajouter eux-mêmes.
  if (prompt) {
    session.messages.push({
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
      created_at: new Date().toISOString(),
      ...(images && images.length > 0 ? { images } : {}),
    });
  }

  session.confirmDangerous = session.confirmDangerous ?? false;
  sessionStore.save(session);

  if (!workspaceManager.getWorkspace(sessionId)) {
    workspaceManager.getOrCreateWorkspace(sessionId, {
      environment: session.environment ?? "local",
      providerId: session.providerId ?? "local",
      workspacePath: process.cwd(),
    });
  }

  // Flux CANONIQUE : le planner ET le bus sont traduits dans le même
  // vocabulaire (`SoryOSEvent`) — les adaptateurs (CLI, SSE, NDJSON)
  // rendent donc exactement les mêmes faits.
  const emitCanonical = (event: unknown) => {
    const canonical = toSoryOSEvent(event);
    if (canonical) emit(canonical);
  };

  // Les événements du bus que le planner n'émet pas (permissions, questions,
  // fichiers, processus…) remontent dans le même flux canonique.
  const unsubscribeBus = globalEventBus.on("*", (busEvent: any) => {
    if (busEvent?.sessionId && busEvent.sessionId !== sessionId) return;

    // `agent.failed` porte un message générique : si le planner a déjà
    // remonté une erreur précise, on ne la duplique pas.
    if (busEvent?.type === "agent.failed" && lastErrorMessage) return;

    emitCanonical(busEvent);
  });

  const runOptions: AgentRunOptions = {
    sessionId,
    modelId: modelId ?? session.model,
    agentId: agentId ?? "build",
    apiKey,
    // On intercepte les événements d'erreur pour remonter le VRAI message
    // (le planner échoue sans lever d'exception : il émet `error` puis
    // retourne 'failed').
    emit: (event: any) => {
      if (event?.type === "error" && typeof event.message === "string" && event.message.trim()) {
        lastErrorMessage = event.message;
      }
      emitCanonical(event);
    },
  };

  try {
    const outcome = await runtime.run(runOptions);
    const updated = sessionStore.get(sessionId);

    if (outcome === "failed") {
      return {
        status: "failed",
        session: updated ?? session,
        error: lastErrorMessage ?? "L'agent n'a pas pu terminer cette demande — voir les erreurs de la session.",
      };
    }

    return {
      status: "completed",
      session: updated ?? session,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      session: sessionStore.get(sessionId) ?? null,
      error,
    };
  } finally {
    unsubscribeBus();
  }
}