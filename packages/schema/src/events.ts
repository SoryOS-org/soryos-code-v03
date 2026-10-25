/**
 * Canonical event contract — the SINGLE vocabulary shared by the CLI and the GUI.
 *
 * Before this module, two incompatible vocabularies coexisted:
 *  - the planner stream (`status`, `text`, `tool_start`, `tool_end`, …) emitted
 *    through `AgentRuntime.run({ emit })`,
 *  - the bus vocabulary (`agent.started`, `tool.completed`, `permission.requested`, …).
 *
 * `toSoryOSEvent()` translates BOTH into one canonical shape, so every adapter
 * (terminal, SSE, NDJSON) renders the same facts.
 */

export type SoryOSEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_end"; id: string; output: string; isError: boolean }
  | { type: "permission_requested"; requestId: string; toolName: string }
  | { type: "question_asked"; requestId: string; questions: unknown[] }
  | { type: "file_changed"; path: string; action: string }
  | { type: "preview"; url: string }
  | { type: "error"; message: string }
  | { type: "done"; usage?: { input: number; output: number } };

export type SoryOSEventType = SoryOSEvent["type"];

/** Enveloppe d'un événement canonique (horodatage + session). */
export interface SoryOSEventEnvelope {
  sessionId: string;
  timestamp: string;
  event: SoryOSEvent;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * Traduit un événement brut (planner OU bus) en événement canonique.
 * @returns null si l'événement n'a pas d'équivalent canonique (ex. `tool.started`,
 * qui doublonne `tool_use` du plan).
 */
export function toSoryOSEvent(raw: unknown): SoryOSEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const event = raw as Record<string, unknown>;
  const type = asString(event.type);
  if (!type) return null;

  // ---- 1. Flux du planner (événements plats) --------------------------------
  switch (type) {
    case "status":
      return { type: "status", message: asString(event.message) ?? "" };

    case "text":
      return { type: "text", delta: asString(event.delta) ?? "" };

    case "reasoning":
      return { type: "reasoning", delta: asString(event.delta) ?? "" };

    case "tool_start":
      return {
        type: "tool_use",
        id: asString(event.id) ?? "",
        name: asString(event.name) ?? "",
        input: event.input ?? {},
      };

    case "tool_end":
      return {
        type: "tool_end",
        id: asString(event.id) ?? "",
        output: asString(event.output) ?? "",
        isError: event.isError === true,
      };

    case "files_changed": {
      const paths = Array.isArray(event.paths) ? event.paths : [];
      const first = asString(paths[0]);
      return first ? { type: "file_changed", path: first, action: "changed" } : null;
    }

    case "preview":
      return { type: "preview", url: asString(event.url) ?? "" };

    case "error":
      return { type: "error", message: asString(event.message) ?? "Unknown error" };

    case "done":
      // Le `done` du planner signifie « ce tour LLM est fini », PAS « le run
      // est fini ». Le `done` canonique est réservé à la fin du run
      // (`agent.completed` du bus) : on ne le duplique donc pas.
      return null;
  }

  // ---- 2. Vocabulaire du bus ({ type, sessionId, timestamp, data }) ---------
  const data = asRecord(event.data);
  switch (type) {
    case "agent.started":
      return { type: "status", message: "Agent started" };

    case "agent.completed":
      return { type: "done" };

    case "agent.failed":
      return { type: "error", message: asString(data.message) ?? "Agent failed" };

    case "permission.requested":
      return {
        type: "permission_requested",
        requestId: asString(data.requestId) ?? "",
        toolName: asString(data.toolName) ?? "",
      };

    case "question.asked":
      return {
        type: "question_asked",
        requestId: asString(data.requestId) ?? "",
        questions: Array.isArray(data.questions) ? data.questions : [],
      };

    case "file.changed":
      return {
        type: "file_changed",
        path: asString(data.path) ?? "",
        action: asString(data.action) ?? "changed",
      };

    case "preview.ready":
      return { type: "preview", url: asString(data.url) ?? "" };

    case "process.started":
      return { type: "status", message: `▶ ${asString(data.command) ?? "process"}` };

    case "process.exited": {
      const code = typeof data.exitCode === "number" ? data.exitCode : 0;
      return { type: "status", message: `◀ process exited (${code})` };
    }

    case "session.compacted":
      return { type: "status", message: "Conversation compacted (memory summary)" };

    case "subagent.started":
      return { type: "status", message: `Subagent started: ${asString(data.subagent) ?? ""}` };

    case "subagent.completed":
      return { type: "status", message: `Subagent completed: ${asString(data.subagent) ?? ""}` };

    case "subagent.failed":
      return { type: "status", message: `Subagent failed: ${asString(data.subagent) ?? ""}` };

    // `tool.started` / `tool.completed` / `tool.failed` du bus doublonnent le
    // `tool_use` / `tool_end` du plan : on les ignore volontairement.
    default:
      return null;
  }
}

/** Traduit un flux d'événements bruts (en ne gardant que le canonique). */
export function translateEvents(rawEvents: unknown[]): SoryOSEvent[] {
  const out: SoryOSEvent[] = [];
  for (const raw of rawEvents) {
    const canonical = toSoryOSEvent(raw);
    if (canonical) out.push(canonical);
  }
  return out;
}
