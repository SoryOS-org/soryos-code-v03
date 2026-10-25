/**
 * file-diff — calcul de diffs entre fichiers/contenus.
 * Aucune simulation : utilise la bibliothèque `diff` pour un calcul réel.
 */

import { createTwoFilesPatch, diffLines } from "diff";
import { globalEventBus } from "@soryos/bus";

export interface FileDiffResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface FileDiffInfo {
  file: string;
  patch: string;
  status: "added" | "deleted" | "modified";
  additions: number;
  deletions: number;
}

const MAX_PATCH_CHARS = 50000;

export function computeFileDiff(
  file: string,
  before: string,
  after: string,
  status: "added" | "deleted" | "modified" = "modified"
): FileDiffInfo {
  const counts = diffLines(before, after).reduce(
    (result, item) => ({
      additions: result.additions + (item.added ? (item.count ?? 0) : 0),
      deletions: result.deletions + (item.removed ? (item.count ?? 0) : 0),
    }),
    { additions: 0, deletions: 0 }
  );

  const patch = createTwoFilesPatch(file, file, before, after);

  return {
    file,
    patch,
    status,
    ...counts,
  };
}

export class FileDiffTool {
  /**
   * Compute a unified diff between two file contents.
   */
  diffContents(
    file: string,
    before: string,
    after: string,
    status?: "added" | "deleted" | "modified"
  ): FileDiffResult {
    const callId = `file-diff-${Date.now()}`;

    if (!file || typeof file !== "string") {
      return { success: false, error: "File path is required." };
    }

    globalEventBus.emit("tool.started", {
      toolName: "file_diff",
      input: { file, beforeLen: before.length, afterLen: after.length },
      callId,
    });

    try {
      const diffInfo = computeFileDiff(file, before, after, status);

      let patchOutput = diffInfo.patch;
      let truncated = false;
      if (patchOutput.length > MAX_PATCH_CHARS) {
        patchOutput = `${patchOutput.slice(0, MAX_PATCH_CHARS)}\n… [truncated after ${MAX_PATCH_CHARS} characters]`;
        truncated = true;
      }

      const header = [
        `File: ${diffInfo.file}`,
        `Status: ${diffInfo.status}`,
        `+${diffInfo.additions} additions, -${diffInfo.deletions} deletions`,
      ].join("\n");

      const output = `${header}\n\n${patchOutput}`;
      const metadata = {
        file: diffInfo.file,
        status: diffInfo.status,
        additions: diffInfo.additions,
        deletions: diffInfo.deletions,
        truncated,
      };

      globalEventBus.emit("tool.completed", { toolName: "file_diff", output, callId, metadata });
      return { success: true, output, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "file_diff", error: message, callId });
      return { success: false, error: `file_diff failed: ${message}` };
    }
  }
}
