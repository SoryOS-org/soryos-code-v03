/**
 * Ripgrep fast path for grep_search.
 * Uses the real `rg` binary when available on a local ExecutionProvider;
 * callers must fall back to the portable JS scan when this returns null.
 * Uses dynamic require (eval("require")) so Next.js client bundlers never
 * pull in node:child_process statically.
 */

declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

let rgAvailable: boolean | null = null;

function dynamicRequire<T = any>(moduleName: string): T {
  const req =
    typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
  return req(moduleName);
}

export async function isRipgrepAvailable(): Promise<boolean> {
  if (rgAvailable !== null) return rgAvailable;
  try {
    const { execFile } = dynamicRequire("child_process");
    await new Promise<void>((resolve, reject) => {
      execFile("rg", ["--version"], { timeout: 3000 }, (err: Error | null) => (err ? reject(err) : resolve()));
    });
    rgAvailable = true;
  } catch {
    rgAvailable = false;
  }
  return rgAvailable;
}

/** Test hook: clears the cached detection result. */
export function resetRipgrepCache(): void {
  rgAvailable = null;
}

const RG_EXCLUDE_GLOBS = [
  "--glob", "!node_modules/**",
  "--glob", "!.git/**",
  "--glob", "!dist/**",
  "--glob", "!.next/**",
  "--glob", "!.turbo/**",
  "--glob", "!coverage/**",
];

export function buildRgArgs(options: {
  pattern: string;
  caseSensitive: boolean;
  useRegex: boolean;
  maxMatches: number;
  cwd?: string;
}): string[] {
  const args = [
    "--line-number",
    "--no-heading",
    "--color", "never",
    "--max-filesize", "2M",
    ...RG_EXCLUDE_GLOBS,
  ];
  if (!options.caseSensitive) args.push("-i");
  if (!options.useRegex) args.push("-F");
  if (options.maxMatches > 0) args.push("--max-count", String(options.maxMatches));
  args.push("-e", options.pattern);
  if (options.cwd) args.push(options.cwd);
  return args;
}

export interface RipgrepResult {
  matches: string[];
  truncated: boolean;
}

/**
 * Runs rg and parses `path:line:content` output.
 * Returns null when rg itself fails (binary crash, bad pattern for -e, …)
 * so the caller can fall back to the portable scan.
 */
export async function ripgrepSearch(options: {
  pattern: string;
  caseSensitive: boolean;
  useRegex: boolean;
  maxMatches: number;
  cwd?: string;
  /** Base directory rg runs in (defaults to process.cwd()). */
  workdir?: string;
}): Promise<RipgrepResult | null> {
  const { spawn } = dynamicRequire("child_process");
  const args = buildRgArgs(options);

  return new Promise<RipgrepResult | null>((resolve) => {
    let child;
    try {
      child = spawn("rg", args, { cwd: options.workdir, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      resolve(null);
      return;
    }

    const matches: string[] = [];
    let truncated = false;
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result: RipgrepResult | null) => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch { /* already exited */ }
      resolve(result);
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        if (matches.length >= options.maxMatches) {
          truncated = true;
          finish({ matches, truncated });
          return;
        }
        matches.push(line);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", () => finish(null));
    child.on("close", (code: number | null) => {
      // rg exit codes: 0 = matches found, 1 = no matches, 2 = error
      if (code === 2) {
        finish(null);
        return;
      }
      if (stdout && matches.length < options.maxMatches) {
        for (const line of stdout.split("\n")) {
          if (!line) continue;
          if (matches.length >= options.maxMatches) {
            truncated = true;
            break;
          }
          matches.push(line);
        }
      }
      if (stderr && code !== 0 && code !== 1 && matches.length === 0) {
        finish(null);
        return;
      }
      finish({ matches, truncated });
    });
  });
}
