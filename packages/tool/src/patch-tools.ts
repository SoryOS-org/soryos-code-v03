import { ExecutionProvider } from "@soryos/execution";
import { globalEventBus } from "@soryos/bus";
import { normalizeForMatch } from "./edit-matcher";

/**
 * Port of OpenCode's patch format (packages/util/src/patch.ts + core patch.txt).
 * A stripped-down, file-oriented diff envelope:
 *
 * *** Begin Patch
 * *** Add File: path        (every following line starts with '+')
 * *** Delete File: path     (nothing follows)
 * *** Update File: path     (optional "*** Move to: path", then @@ context chunks)
 *   @@ optional context label
 *   -removed
 *   +added
 *    context
 * *** End of File           (marks the last chunk as EOF-anchored)
 * *** End Patch
 */

export interface UpdateFileChunk {
  oldLines: string[];
  newLines: string[];
  changeContext?: string;
  endOfFile?: boolean;
}

export type PatchHunk =
  | { type: "add"; path: string; contents: string }
  | { type: "delete"; path: string }
  | { type: "update"; path: string; movePath?: string; chunks: UpdateFileChunk[] };

export type ParsePatchResult = { ok: true; hunks: PatchHunk[] } | { ok: false; error: string };

function stripHeredoc(input: string): string {
  return input.match(/^(?:cat\s+)?<<(['"]?)(\w+)\1\s*\n([\s\S]*?)\n\2\s*$/)?.[3] ?? input;
}

function isBoundary(line: string): boolean {
  return (
    line === "*** End Patch" ||
    line.startsWith("*** Add File: ") ||
    line.startsWith("*** Delete File: ") ||
    line.startsWith("*** Update File: ")
  );
}

export function parsePatch(patchText: string): ParsePatchResult {
  const lines = stripHeredoc(patchText.trim())
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
  const begin = lines[0]?.trim() === "*** Begin Patch" ? 0 : -1;
  const end = lines.at(-1)?.trim() === "*** End Patch" ? lines.length - 1 : -1;
  if (begin === -1) return { ok: false, error: "The first line of the patch must be '*** Begin Patch'" };
  if (end === -1 || begin >= end) return { ok: false, error: "The last line of the patch must be '*** End Patch'" };

  const hunks: PatchHunk[] = [];
  let index = begin + 1;
  while (index < end) {
    const line = lines[index]!;
    const header = line.trim();

    if (index === begin + 1 && header.startsWith("*** Environment ID:") && header.slice("*** Environment ID:".length).trim()) {
      index++;
      continue;
    }

    if (header.startsWith("*** Add File: ")) {
      const path = header.slice("*** Add File: ".length).trim();
      const contentLines: string[] = [];
      let i = index + 1;
      while (i < end && !isBoundary(lines[i]!.trim())) {
        if (!lines[i]!.startsWith("+")) {
          const bad = lines[i]!.trim();
          return {
            ok: false,
            error: `Invalid Add File line for '${path}' at line ${i + 1}: expected a line starting with '+', got '${bad}'`,
          };
        }
        contentLines.push(lines[i]!.slice(1));
        i++;
      }
      hunks.push({ type: "add", path, contents: contentLines.join("\n") });
      index = i;
      continue;
    }

    if (header.startsWith("*** Delete File: ")) {
      const path = header.slice("*** Delete File: ".length).trim();
      const next = lines[index + 1]?.trim();
      if (index + 1 < end && next !== undefined && !isBoundary(next)) {
        return {
          ok: false,
          error: `Unexpected line after Delete File '${path}' at line ${index + 2}: '${next}'. Delete hunks do not contain body lines`,
        };
      }
      hunks.push({ type: "delete", path });
      index++;
      continue;
    }

    if (header.startsWith("*** Update File: ")) {
      const path = header.slice("*** Update File: ".length).trim();
      let i = index + 1;
      let movePath: string | undefined;
      while (lines[i]?.trimEnd() === "*** End of File") i++;
      const move = lines[i]?.trimEnd();
      if (move === "*** Move to:" || move?.startsWith("*** Move to: ")) {
        movePath = move.slice("*** Move to: ".length).trim();
        if (!movePath) {
          return { ok: false, error: `Move destination for '${path}' must not be empty (line ${i + 1})` };
        }
        i++;
      }
      const parsed = parseUpdateChunks(lines, i, end, path, index);
      if ("error" in parsed) return { ok: false, error: parsed.error };
      hunks.push({ type: "update", path, movePath, chunks: parsed.chunks });
      index = parsed.next;
      continue;
    }

    return {
      ok: false,
      error: `Invalid hunk at line ${index + 1}: '${header}' is not a valid hunk header. Valid headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`,
    };
  }
  return { ok: true, hunks };
}

function parseUpdateChunks(
  lines: string[],
  start: number,
  end: number,
  path: string,
  hunkStart: number
): { chunks: UpdateFileChunk[]; next: number } | { error: string } {
  const chunks: UpdateFileChunk[] = [];
  let index = start;
  let afterEndOfFile = false;

  while (index < end) {
    const line = lines[index]!;
    const updateLine = line.trimEnd();

    if (afterEndOfFile) {
      if (updateLine === "") {
        index++;
        continue;
      }
      if (updateLine === "@@" || updateLine.startsWith("@@ ")) {
        afterEndOfFile = false;
      } else if (isBoundary(updateLine)) {
        break;
      } else {
        return { error: `Expected update hunk to start with a @@ context marker at line ${index + 1}, got: '${line}'` };
      }
    }

    if (updateLine === "*** End of File") {
      const chunk = chunks.at(-1);
      if (chunk && chunk.oldLines.length === 0 && chunk.newLines.length === 0) {
        return { error: `Update hunk does not contain any lines (line ${index + 1})` };
      }
      if (chunk) {
        chunk.endOfFile = true;
        afterEndOfFile = true;
      }
      index++;
      continue;
    }

    if (isBoundary(updateLine)) break;

    if (updateLine === "@@" || updateLine.startsWith("@@ ")) {
      const previous = chunks.at(-1);
      if (previous && previous.oldLines.length === 0 && previous.newLines.length === 0) {
        return {
          error: `Unexpected line in update hunk at line ${index + 1}: '${line}'. Every line should start with ' ' (context), '+' (added) or '-' (removed)`,
        };
      }
      chunks.push({
        oldLines: [],
        newLines: [],
        changeContext: updateLine === "@@" ? undefined : updateLine.slice("@@ ".length),
      });
      index++;
      continue;
    }

    if (chunks.length === 0) chunks.push({ oldLines: [], newLines: [] });
    const chunk = chunks.at(-1)!;

    if (line === "") {
      chunk.oldLines.push("");
      chunk.newLines.push("");
      index++;
      continue;
    }
    if (line.startsWith(" ")) {
      chunk.oldLines.push(line.slice(1));
      chunk.newLines.push(line.slice(1));
      index++;
      continue;
    }
    if (line.startsWith("-")) {
      chunk.oldLines.push(line.slice(1));
      index++;
      continue;
    }
    if (line.startsWith("+")) {
      chunk.newLines.push(line.slice(1));
      index++;
      continue;
    }

    const populated = chunk.oldLines.length > 0 || chunk.newLines.length > 0;
    return {
      error: populated
        ? `Expected update hunk to start with a @@ context marker at line ${index + 1}, got: '${line}'`
        : `Unexpected line in update hunk at line ${index + 1}: '${line}'. Every line should start with ' ' (context), '+' (added) or '-' (removed)`,
    };
  }

  if (chunks.length === 0) {
    return { error: `Update file hunk for path '${path}' is empty (line ${hunkStart + 1})` };
  }
  const last = chunks.at(-1)!;
  if (last.oldLines.length === 0 && last.newLines.length === 0) {
    return { error: `Update hunk for '${path}' does not contain any lines` };
  }
  return { chunks, next: index };
}

const exact = (l: string, r: string) => l === r;
const rstrip = (l: string, r: string) => l.trimEnd() === r.trimEnd();
const trimCmp = (l: string, r: string) => l.trim() === r.trim();
const normalized = (l: string, r: string) => normalizeForMatch(l.trim()) === normalizeForMatch(r.trim());
const COMPARES = [exact, rstrip, trimCmp, normalized];

function matchesAt(lines: string[], pattern: string[], offset: number, compare: (a: string, b: string) => boolean): boolean {
  return pattern.every((line, i) => compare(lines[offset + i]!, line));
}

function seek(lines: string[], pattern: string[], start: number, eof = false): number {
  if (pattern.length === 0) return -1;
  if (eof) {
    const offset = lines.length - pattern.length;
    if (offset < start) return -1;
    for (const compare of COMPARES) {
      if (matchesAt(lines, pattern, offset, compare)) return offset;
    }
    return -1;
  }
  for (const compare of COMPARES) {
    for (let offset = start; offset <= lines.length - pattern.length; offset++) {
      if (matchesAt(lines, pattern, offset, compare)) return offset;
    }
  }
  return -1;
}

function computeReplacements(lines: string[], path: string, chunks: UpdateFileChunk[]): Array<[number, number, string[]]> {
  const replacements: Array<[number, number, string[]]> = [];
  let lineIndex = 0;
  for (const chunk of chunks) {
    if (chunk.changeContext) {
      const context = seek(lines, [chunk.changeContext], lineIndex);
      if (context === -1) throw new Error(`Failed to find context '${chunk.changeContext}' in ${path}`);
      lineIndex = context + 1;
    }
    if (chunk.oldLines.length === 0) {
      replacements.push([lines.length, 0, chunk.newLines]);
      continue;
    }
    let oldLines = chunk.oldLines;
    let newLines = chunk.newLines;
    let found = seek(lines, oldLines, lineIndex, chunk.endOfFile);
    if (found === -1 && oldLines.at(-1) === "") {
      oldLines = oldLines.slice(0, -1);
      if (newLines.at(-1) === "") newLines = newLines.slice(0, -1);
      found = seek(lines, oldLines, lineIndex, chunk.endOfFile);
    }
    if (found === -1 && chunk.oldLines.every((l) => l === "")) {
      const expected = chunk.oldLines.length === 1 ? "an expected blank line" : `${chunk.oldLines.length} consecutive blank lines`;
      throw new Error(`Failed to find ${expected} in ${path}`);
    }
    if (found === -1) throw new Error(`Failed to find expected lines in ${path}:\n${chunk.oldLines.join("\n")}`);
    replacements.push([found, oldLines.length, newLines]);
    lineIndex = found + oldLines.length;
  }
  return replacements.sort((a, b) => a[0] - b[0]);
}

export function deriveUpdate(path: string, chunks: UpdateFileChunk[], original: string): string {
  const lines = original.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const replacements = computeReplacements(lines, path, chunks);
  for (const [start, remove, insert] of replacements.reverse()) {
    lines.splice(start, remove, ...insert);
  }
  if (lines.at(-1) !== "") lines.push("");
  return lines.join("\n");
}

interface PreparedChange {
  hunk: PatchHunk;
  content: string;
  before: string;
  movePath?: string;
}

export interface PatchApplyResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class PatchTools {
  constructor(private provider: ExecutionProvider) {}

  /**
   * Applies a patch atomically-ish: EVERY hunk is prepared and verified in memory
   * BEFORE any write happens; then operations are applied sequentially and each
   * written file is re-read for physical verification.
   */
  async applyPatch(patchText: string): Promise<PatchApplyResult> {
    if (!patchText?.trim()) {
      return { success: false, error: "patchText is required" };
    }

    const parsed = parsePatch(patchText);
    if (!parsed.ok) {
      return { success: false, error: `patch verification failed: ${parsed.error}` };
    }
    if (parsed.hunks.length === 0) {
      return { success: false, error: "patch rejected: empty patch" };
    }

    // --- Prepare phase (read + derive in memory, no writes yet) ---
    const prepared: PreparedChange[] = [];
    const updates = new Map<string, string>();

    for (const hunk of parsed.hunks) {
      try {
        if (hunk.type === "add") {
          const content = hunk.contents.endsWith("\n") || hunk.contents === "" ? hunk.contents : `${hunk.contents}\n`;
          prepared.push({ hunk, content, before: "" });
          continue;
        }
        if (hunk.type === "delete") {
          const current = await this.provider.readFile(hunk.path);
          prepared.push({ hunk, content: "", before: current });
          continue;
        }
        const previous = updates.get(hunk.path);
        const original = previous ?? (await this.provider.readFile(hunk.path));
        const content = deriveUpdate(hunk.path, hunk.chunks, original);
        prepared.push({ hunk, content, before: original, movePath: hunk.movePath });
        if (!hunk.movePath) updates.set(hunk.path, content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: `patch verification failed: ${message}` };
      }
    }

    // --- Apply phase ---
    const applied: Array<{ type: "add" | "update" | "delete"; path: string }> = [];
    const completedNote = () => {
      const done = applied.map((a) => `${a.type === "add" ? "A" : a.type === "delete" ? "D" : "M"} ${a.path}`);
      return done.length ? `. Completed before failure: ${done.join(", ")}` : "";
    };

    for (const change of prepared) {
      const { hunk } = change;
      try {
        if (hunk.type === "delete") {
          await this.provider.deleteFile(hunk.path);
          applied.push({ type: "delete", path: hunk.path });
          globalEventBus.emit("file.changed", { path: hunk.path, action: "delete" });
          continue;
        }
        if (hunk.type === "update" && change.movePath) {
          await this.provider.writeFile(change.movePath, change.content);
          await this.provider.deleteFile(hunk.path);
          applied.push({ type: "update", path: change.movePath });
          globalEventBus.emit("file.changed", { path: change.movePath, action: "move" });
          continue;
        }
        await this.provider.writeFile(hunk.path, change.content);
        applied.push({ type: hunk.type, path: hunk.path });
        globalEventBus.emit("file.changed", { path: hunk.path, action: hunk.type === "add" ? "create" : "edit" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Failed to apply patch at ${hunk.path}: ${message}${completedNote()}`,
          metadata: { applied },
        };
      }
    }

    // --- Physical verification of every written file ---
    for (const change of prepared) {
      if (change.hunk.type === "delete") continue;
      const target = change.hunk.type === "update" ? (change.movePath ?? change.hunk.path) : change.hunk.path;
      try {
        const verified = await this.provider.readFile(target);
        if (verified !== change.content) {
          return {
            success: false,
            error: `Patch verification failed: re-read content of ${target} differs from the expected result.${completedNote()}`,
            metadata: { applied },
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          error: `Patch verification failed for ${target}: ${message}${completedNote()}`,
          metadata: { applied },
        };
      }
    }

    const lines = [
      "Success. Updated the following files:",
      ...applied.map((a) => `${a.type === "add" ? "A" : a.type === "delete" ? "D" : "M"} ${a.path}`),
    ];
    return { success: true, output: lines.join("\n"), metadata: { applied } };
  }
}
