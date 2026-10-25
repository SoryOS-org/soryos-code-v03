/**
 * Flags — groupes de flags partagés entre commandes (session-target, run, …).
 */

import type { FlagSpec } from "./spec";

export const SessionTargetFlags: FlagSpec[] = [
  { type: "string", name: "session", alias: "s", description: "Session id (created if missing)" },
  { type: "boolean", name: "continue", alias: "c", description: "Resume the most recent session" },
  { type: "boolean", name: "fork", description: "Fork a copy of the target session" },
];

export const ModelFlags: FlagSpec[] = [
  { type: "string", name: "model", alias: "m", description: "Model id (e.g. gemini-2.5-flash)" },
  { type: "string", name: "agent", description: "Agent role: build | plan | explore | code-reviewer" },
];

export const FormatFlags: FlagSpec[] = [
  {
    type: "string",
    name: "format",
    description: "Output format",
    choices: ["default", "json"],
    default: "default",
  },
];

export const PermissionFlags: FlagSpec[] = [
  { type: "boolean", name: "auto", description: "Auto-approve permission prompts (non-interactive runs)" },
];

/** Récupère une valeur de flag string ou null si absente/vide. */
export function str(flags: object, name: string): string | null {
  const v = (flags as Record<string, unknown>)[name];
  return typeof v === "string" && v.length ? v : null;
}

/** Récupère un flag boolean. */
export function bool(flags: object, name: string): boolean {
  return (flags as Record<string, unknown>)[name] === true;
}
