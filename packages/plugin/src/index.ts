/**
 * @soryos/plugin — Promise-based plugin authoring API + loader.
 * Port of opencode's @opencode/plugin Promise API, adapted to SoryOS's
 * existing registries (ToolRegistry, EventBus, permissions).
 */

import type { ToolDefinition, SessionData, ToolExecutionResult } from "@soryos/schema";

export type Cleanup = () => Promise<void> | void;

export interface Registration {
  dispose(): Promise<void>;
}

/** Permission evaluation mutable state (hook can flip effect to allow/deny). */
export interface PermissionEvaluation {
  toolName: string;
  mode: string;
  args: Record<string, unknown>;
  effect: "allow" | "deny";
  reason?: string;
}

/** Bus event forwarded to plugin subscribers. */
export interface PluginBusEvent {
  type: string;
  payload: Record<string, unknown>;
}

/** Context domains a plugin can touch during setup. */
export interface PluginToolDomain {
  /** Register a new tool (or override an existing one by name). */
  add(definition: ToolDefinition, handler?: PluginToolHandler): void;
  /** Remove a tool by name. Returns true if removed. */
  remove(name: string): boolean;
  /** List currently registered tool names. */
  list(): string[];
}

export type PluginToolHandler = (
  args: Record<string, unknown>,
  ctx: { session: SessionData; mode: string },
) => Promise<ToolExecutionResult>;

export interface PluginPermissionDomain {
  /** Hook into permission decisions. Mutate `evaluation.effect` to override. */
  hook(callback: (evaluation: PermissionEvaluation) => void | Promise<void>): Promise<Registration>;
}

export interface PluginEventDomain {
  /** Subscribe to all bus events. Returns a registration. */
  subscribe(callback: (event: PluginBusEvent) => void): Promise<Registration>;
}

export interface PluginStorageDomain {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  scan(): Promise<string[]>;
}

/** The context passed to a plugin's setup function. */
export interface PluginContext {
  readonly options: Readonly<Record<string, unknown>>;
  readonly session?: SessionData;
  readonly tool: PluginToolDomain;
  readonly permission: PluginPermissionDomain;
  readonly event: PluginEventDomain;
  readonly storage: PluginStorageDomain;
}

/** A plugin is an id + a setup function that registers capabilities. */
export interface Plugin {
  readonly id: string;
  readonly setup: (context: PluginContext) => Promise<Cleanup | void> | Cleanup | void;
}

/** Author a plugin with type inference. */
export function define(plugin: Plugin): Plugin {
  return plugin;
}

/** Validate an unknown module export as a Plugin. */
export function isPlugin(value: unknown): value is Plugin {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === "string" && p.id.length > 0 && typeof p.setup === "function";
}

// Storage backends (no import cycle: storage.ts only imports types from here)
export { createPluginStorage, createMemoryStorage } from "./storage.js";
