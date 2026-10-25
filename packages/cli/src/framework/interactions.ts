/**
 * Interactions — politique CLI face aux demandes de l'agent (permissions,
 * questions). Le CLI n'est pas (ou pas encore) une UI interactive : il doit
 * TOUJOURS répondre pour ne jamais rester bloqué (jamais de hang).
 *
 * Le flux reçu est canonique (`SoryOSEvent`), identique à celui de la GUI.
 */

import type { SoryOSEvent } from "@soryos/schema";
import { resolvePermissionRequest } from "@soryos/permissions";
import { cancelQuestionRequest } from "@soryos/tool";

export interface InteractionOptions {
  /** `--auto` : les permissions sont accordées automatiquement. */
  auto?: boolean;
  /** Feedback lisible (stderr). */
  notify?: (message: string) => void;
}

/** Résumé lisible d'une liste de questions. */
function describe(questions: unknown[]): string {
  if (!questions.length) return "";
  const first = questions[0] as { question?: string };
  const text = first?.question ?? "";
  return questions.length > 1 ? `${text} (+${questions.length - 1})` : text;
}

/**
 * Répond aux événements qui demandent une interaction humaine.
 * - `permission_requested` : `--auto` ⇒ allow-once, sinon deny-once (jamais de hang)
 * - `question_asked` : annulée avec un feedback honnête (jamais de hang)
 */
export function handleInteraction(event: SoryOSEvent, opts: InteractionOptions = {}): void {
  if (event.type === "permission_requested") {
    if (opts.auto) {
      opts.notify?.(`⚡ Auto-allow: ${event.toolName}`);
      resolvePermissionRequest(event.requestId, "allow-once");
    } else {
      opts.notify?.(`✖ Permission denied (non-interactive): ${event.toolName}`);
      resolvePermissionRequest(event.requestId, "deny-once");
    }
    return;
  }

  if (event.type === "question_asked") {
    opts.notify?.(`✖ Question cancelled (non-interactive): ${describe(event.questions)}`);
    cancelQuestionRequest(event.requestId);
  }
}
