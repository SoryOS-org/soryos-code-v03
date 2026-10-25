/**
 * Plugin host — wires the plugin system to Soryos's existing registries.
 * Creates a PluginContext with tool, permission, event, and storage domains.
 */

import { globalEventBus } from "@soryos/bus";
import { permissionsManager, type PermissionDecision } from "@soryos/permissions";
import { toolRegistry, ToolExecutor } from "@soryos/tool";
import type {
  ToolDefinition,
  ToolExecutionResult,
  SessionData,
} from "@soryos/schema";
import type {
  PluginContext,
  PluginToolDomain,
  PluginPermissionDomain,
  PluginEventDomain,
  PluginStorageDomain,
  PermissionEvaluation,
  PluginBusEvent,
  Registration,
} from "./index.js";
import { createPluginStorage, createMemoryStorage } from "./storage.js";

/**
 * Create a PluginContext bound to Soryos's registries.
 * @param session Optional session data exposed to plugins.
 * @param storageNamespace Plugin id — enables per-plugin filesystem storage
 *   at `.soryos/plugin-storage/<id>.json`. Omit for isolated in-memory storage.
 */
export function createPluginContext(
  session?: SessionData,
  storageNamespace?: string,
): PluginContext {
    const toolDomain: PluginToolDomain = {
      add(definition, handler) {
        toolRegistry.add(definition);
        if (handler) {
          // Register handler override
          const handlerName = definition.name;
          // Use the static method directly
          ToolExecutor.registerHandler(handlerName, handler);
        }
      },
    remove(name) {
      return toolRegistry.remove(name);
    },
    list() {
      return toolRegistry.getToolDefinitions().map((t) => t.name);
    },
  };

  const permissionDomain: PluginPermissionDomain = {
    hook(callback) {
      // Hook into permission evaluation
      const originalCheck = permissionsManager.checkPermission;
      
      permissionsManager.checkPermission = (mode: string, toolName: string, args: Record<string, unknown> | undefined) => {
        const evaluation: PermissionEvaluation = {
          toolName,
          mode,
          args: args || {},
          effect: "allow",
        };
        
        try {
          callback(evaluation);
        } catch (error) {
          // Ignore errors from the hook
        }
        
        return {
          allowed: evaluation.effect === "allow",
          reason: evaluation.reason,
        };
      };

      return Promise.resolve({
        dispose: () => {
          permissionsManager.checkPermission = originalCheck;
        },
      } as Registration);
    },
  };

  const eventDomain: PluginEventDomain = {
    subscribe(callback) {
      const unsubscribe = globalEventBus.on("*", (event) => {
        callback({
          type: event.type,
          payload: event.data,
        } as PluginBusEvent);
      });
      
      return Promise.resolve({
        dispose: () => unsubscribe(),
      } as Registration);
    },
  };

  const storageDomain: PluginStorageDomain = storageNamespace
    ? createPluginStorage(storageNamespace)
    : createMemoryStorage();

  return {
    options: {},
    session,
    tool: toolDomain,
    permission: permissionDomain,
    event: eventDomain,
    storage: storageDomain,
  };
}
