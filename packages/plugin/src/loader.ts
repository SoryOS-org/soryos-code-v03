/**
 * Plugin loader — resolve and load plugins from local paths or package names.
 * Simplified from opencode's host.ts: dynamic import, validate default export, call setup.
 */

import { resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { access, constants } from "node:fs/promises";
import {
  isPlugin,
  type Cleanup,
  type Plugin,
  type PluginContext,
} from "./index.js";
import { createPluginStorage } from "./storage.js";

export interface LoadPluginResult {
  id: string;
  cleanup: Cleanup | null;
  source: string;
}

export interface PluginLoaderOptions {
  /** Base directory for resolving relative plugin paths. */
  directory: string;
  /** Per-plugin configuration keyed by plugin id (or source string). */
  config?: Record<string, Record<string, unknown>>;
}

/** Candidate entry files to try when resolving a local plugin directory. */
const ENTRY_CANDIDATES = ["index.ts", "index.js", "plugin.ts", "plugin.js", "mod.ts", "mod.js"];

/** Resolve a plugin source (path or package name) to an absolute file URL. */
export async function resolvePluginEntry(source: string, directory: string): Promise<string> {
  const local = source.startsWith(".") || isAbsolute(source);
  if (local) {
    const base = isAbsolute(source) ? source : resolve(directory, source);
    // Direct file?
    if (await fileExists(base)) return pathToFileURL(base).href;
    // Directory → try candidate entry files
    for (const candidate of ENTRY_CANDIDATES) {
      const entry = resolve(base, candidate);
      if (await fileExists(entry)) return pathToFileURL(entry).href;
    }
    throw new Error(`Plugin "${source}": no entry file found in ${base}`);
  }
  // npm package — let Node's resolver handle it
  return source;
}

/** Load a plugin module, validate its default export, and call setup(). */
export async function loadPlugin(
  source: string,
  context: PluginContext,
  options: PluginLoaderOptions,
): Promise<LoadPluginResult> {
  const entry = await resolvePluginEntry(source, options.directory);

  let mod: Record<string, unknown>;
  try {
    mod = (await import(entry)) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to import plugin "${source}": ${message}`, { cause: error });
  }

  const plugin = mod.default ?? mod.plugin;
  if (!isPlugin(plugin)) {
    throw new Error(
      `Plugin "${source}" must have a default export with { id: string, setup: function }. Got: ${typeof plugin}`,
    );
  }

  // Merge per-plugin config from loader options
  const pluginConfig = options.config?.[plugin.id] ?? options.config?.[source] ?? {};
  // Bind per-plugin filesystem storage (`.soryos/plugin-storage/<id>.json`)
  const boundContext: PluginContext = {
    ...context,
    options: pluginConfig,
    storage: createPluginStorage(plugin.id),
  };

  const cleanup = await plugin.setup(boundContext);

  return {
    id: plugin.id,
    cleanup: typeof cleanup === "function" ? cleanup : null,
    source,
  };
}

/** Unload a plugin by calling its cleanup. */
export async function unloadPlugin(result: LoadPluginResult): Promise<void> {
  if (result.cleanup) {
    await result.cleanup();
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
