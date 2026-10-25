/**
 * Engine — logique d'exécution partagée entre le mode `run` et le REPL `interactive`.
 * Appelle le pipeline @soryos/agent (unique source de ce qui tourne) et rend
 * les événements CANONIQUES (`SoryOSEvent`) via framework/render.ts.
 */

import { SessionData } from "@soryos/schema";
import { workspaceManager } from "@soryos/workspace";
import { runPipeline, type RunPipelineResult } from "@soryos/agent";
import { createRenderer, writeTextDelta } from "./render";
import { handleInteraction } from "./interactions";

export interface RunInput {
  session: SessionData;
  prompt: string;
  agentId?: string;
  modelId?: string;
  apiKey?: string;
  formatJson: boolean;
  /** `--auto` : les permissions sont accordées automatiquement. */
  auto?: boolean;
  /** Notifié quand le run échoue (permet de fixer le code de sortie). */
  onFailure?: (message: string) => void;
}

export interface RunOutput {
  status: "completed" | "failed";
  error?: string;
  session: SessionData | null;
}

/** Assure que le workspace existe pour la session (une seule fois). */
function ensureWorkspace(session: SessionData): void {
  if (!workspaceManager.getWorkspace(session.id)) {
    workspaceManager.getOrCreateWorkspace(session.id, {
      environment: session.environment ?? "local",
      providerId: session.providerId ?? "local",
      workspacePath: process.cwd(),
    });
  }
}

/**
 * Lancement unique : rend le flux canonique, appelle le pipeline, nettoyage.
 */
export async function executeRun(input: RunInput): Promise<RunOutput> {
  const { session, prompt, agentId, modelId, apiKey, formatJson } = input;

  ensureWorkspace(session);

  const renderer = createRenderer({
    sessionId: session.id,
    formatJson,
    onFailure: input.onFailure,
  });
  try {
    const result: RunPipelineResult = await runPipeline(
      {
        sessionId: session.id,
        prompt,
        agentId: agentId ?? "build",
        modelId: modelId ?? session.model,
        apiKey,
      },
      (event) => {
        // 1. Les demandes d'interaction sont TOUJOURS traitées (jamais de hang).
        handleInteraction(event, {
          auto: input.auto,
          notify: (message) => {
            if (!formatJson) process.stderr.write(`${message}\n`);
          },
        });

        // 2. Le texte est en streaming : on l'écrit au fil de l'eau.
        if (event.type === "text" && event.delta && !formatJson) {
          writeTextDelta(event.delta);
        }

        // 3. Rendu de l'événement canonique.
        renderer.render(event);
      },
    );

    if (result.status === "failed") {
      return {
        status: "failed",
        error: result.error,
        session: result.session,
      };
    }

    return {
      status: "completed",
      session: result.session,
    };
  } finally {
    /* le renderer est sans état persistant : rien à libérer */
  }
}
