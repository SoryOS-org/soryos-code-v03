/**
 * Renderer — rendu des événements CANONIQUES (`SoryOSEvent`) vers le terminal.
 * UNIQUE renderer partagé par le mode `run` (non-interactif) et le mode
 * `interactive` (REPL). Le flux reçu est déjà traduit par
 * `@soryos/agent` (runPipeline) : aucun vocabulaire n'est inventé ici.
 */

import type { SoryOSEvent } from "@soryos/schema";
import { bold, blue, cyan, dim, emitNdjson, green, println, red, yellow } from "./ui";

export interface RendererOptions {
  sessionId: string;
  formatJson: boolean;
  /** Notifie l'échec (pour fixer le code de sortie). */
  onFailure?: (message: string) => void;
  /** Notifie la fin (pour fixer le code de sortie). */
  onDone?: () => void;
}

export interface Renderer {
  render(event: SoryOSEvent): void;
}

/**
 * Crée un renderer pour une session.
 * Le renderer mémorise le nom des tools (le contrat canonique porte le nom
 * dans `tool_use`, pas dans `tool_end`).
 */
export function createRenderer(opts: RendererOptions): Renderer {
  const toolNames = new Map<string, string>();

  return {
    render(event: SoryOSEvent): void {
      if (opts.formatJson) {
        // Le type canonique est dans l'enveloppe ; les champs de l'événement
        // sont àplaties à côté (comme le NDJSON opencode).
        const { type, ...rest } = event;
        emitNdjson({ type, sessionId: opts.sessionId, ...rest });
        // La notification d'échec est commune aux deux formats : l'adaptateur
        // ne doit pas réimprimer l'erreur (pas de doublon).
        if (event.type === "error") opts.onFailure?.(event.message);
        return;
      }

      switch (event.type) {
        case "status":
          if (event.message) println(dim(event.message));
          break;

        case "text":
          // Le texte est écrit en streaming par l'appelant (executeRun).
          break;

        case "reasoning":
          if (event.delta) println(dim(event.delta));
          break;

        case "tool_use":
          if (event.id) toolNames.set(event.id, event.name);
          println(yellow(`⚙ ${event.name}`));
          break;

        case "tool_end": {
          const name = toolNames.get(event.id) ?? "tool";
          println(event.isError ? red(`✖ ${name}`) : green(`✔ ${name}`));
          break;
        }

        case "permission_requested":
          println(dim(`⚡ Permission asked: ${event.toolName}`));
          break;

        case "question_asked":
          println(cyan(`❓ Question: ${describeQuestions(event.questions)}`));
          break;

        case "file_changed":
          println(cyan(`📄 ${event.path} (${event.action})`));
          break;

        case "preview":
          if (event.url) println(blue(`🖥  ${event.url}`));
          break;

        case "error":
          println(bold(red(`✖ ${event.message}`)));
          opts.onFailure?.(event.message);
          break;

        case "done":
          println("");
          println(bold(green("✔ Task finished")));
          opts.onDone?.();
          break;
      }
    },
  };
}

/** Résumé lisible d'une liste de questions. */
function describeQuestions(questions: unknown[]): string {
  if (!questions.length) return "(no detail)";
  const first = questions[0] as { question?: string };
  const text = first?.question ?? "";
  return questions.length > 1 ? `${text} (+${questions.length - 1})` : text;
}

/** Écrit un delta de texte en streaming (stderr en TTY, stdout sinon). */
export function writeTextDelta(delta: string): void {
  if (!process.stdout.isTTY) {
    process.stdout.write(delta);
  } else {
    process.stderr.write(delta);
  }
}
