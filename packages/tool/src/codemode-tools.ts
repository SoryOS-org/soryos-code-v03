/**
 * Codemode (inspired by OpenCode): the model writes ONE JavaScript program
 * that chains many tool calls in a single turn, executed in a restricted
 * node:vm context. Only the `tools` API and a `console` capture are exposed —
 * no require, no process, no fs, no network. Every tools.<name>(args) call
 * dispatches through the REAL ToolExecutor, so permissions, the ask gate and
 * physical execution are enforced per sub-call.
 */
import type { ToolExecutionResult } from "@soryos/schema";

declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

function dynamicRequire<T = any>(moduleName: string): T {
  const req =
    typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
  return req(moduleName);
}

export const DEFAULT_CODEMODE_TIMEOUT_MS = 30_000;
export const MAX_CODEMODE_TIMEOUT_MS = 120_000;

export interface CodemodeResult {
  success: boolean;
  output: string;
  error?: string;
  logs: string[];
  toolCalls: number;
}

export class CodemodeTools {
  constructor(
    private readonly dispatch: (
      toolName: string,
      args: Record<string, unknown>
    ) => Promise<ToolExecutionResult>
  ) {}

  async runScript(script: string, timeoutMs: number = DEFAULT_CODEMODE_TIMEOUT_MS): Promise<CodemodeResult> {
    const boundedTimeout = Math.min(Math.max(timeoutMs, 1_000), MAX_CODEMODE_TIMEOUT_MS);
    const logs: string[] = [];
    let toolCalls = 0;

    const tools = new Proxy(
      {} as Record<string, (args?: Record<string, unknown>) => Promise<ToolExecutionResult>>,
      {
        get: (_target, prop) => {
          if (typeof prop !== "string") return undefined;
          // Never look like a thenable or leak introspection.
          if (prop === "then" || prop === "constructor" || prop === "inspect") return undefined;
          return async (args?: Record<string, unknown>) => {
            toolCalls++;
            return this.dispatch(prop, args ?? {});
          };
        },
      }
    );

    const consoleShim = {
      log: (...parts: unknown[]) => logs.push(parts.map(String).join(" ")),
      warn: (...parts: unknown[]) => logs.push(parts.map(String).join(" ")),
      error: (...parts: unknown[]) => logs.push(parts.map(String).join(" ")),
      info: (...parts: unknown[]) => logs.push(parts.map(String).join(" ")),
    };

    const vm = dynamicRequire("node:vm");
    const context = vm.createContext(
      { tools, console: consoleShim },
      { codeGeneration: { strings: false, wasm: false } }
    );

    try {
      const wrapped = `"use strict";\n(async () => {\n${script}\n})()`;
      const vmScript = new vm.Script(wrapped, { filename: "codemode.js" });
      // The sync prefix of the script (before its first await) is bounded by
      // the vm timeout; the async remainder races a wall-clock timeout below.
      const promise: Promise<unknown> = vmScript.runInContext(context, {
        timeout: Math.min(boundedTimeout, 5_000),
      });
      const value = await Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Codemode script timed out after ${boundedTimeout}ms. In-flight tool side effects, if any, already happened.`
                )
              ),
            boundedTimeout
          )
        ),
      ]);

      const output =
        value === undefined || value === null
          ? logs.join("\n") || "OK"
          : typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2);
      return { success: true, output, logs, toolCalls };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        output: "",
        error: `Codemode script failed: ${message}`,
        logs,
        toolCalls,
      };
    }
  }
}
