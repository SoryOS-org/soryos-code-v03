/**
 * @soryos/pty
 * PTY and Interactive Process streaming linked to the active ExecutionProvider.
 */

import { ExecutionProvider } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";

export class PTYManager {
  public async executeCommandStream(
    sessionId: string,
    provider: ExecutionProvider,
    command: string,
    onData: (chunk: string) => void
  ): Promise<{ exitCode: number; durationMs: number }> {
    globalEventBus.emit(sessionId, "process.started", { command });
    const res = await provider.executeCommand(command);

    if (res.stdout) onData(res.stdout);
    if (res.stderr) onData(res.stderr);

    globalEventBus.emit(sessionId, "process.exited", {
      command,
      exitCode: res.exitCode,
      durationMs: res.durationMs,
    });

    return {
      exitCode: res.exitCode,
      durationMs: res.durationMs,
    };
  }
}

export const ptyManager = new PTYManager();
