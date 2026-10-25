/**
 * UI — conventions de sortie du CLI (adaptées d'opencode) :
 * - stdout = DONNÉES uniquement (NDJSON --format json, listes, exports)
 * - stderr = chrome terminal (progression, erreurs, rendu humain)
 * - codes de sortie : 0 ok · 1 erreur · 130 interrupt (SIGINT)
 */

const useColor = process.stderr.isTTY && process.env.NO_COLOR === undefined;

/** ANSI escape sequences wrapper. */
function paint(code: string, text: string): string {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

/** Couleurs bold. */
export const bold = (t: string) => paint("1", t);
/** Couleurs dim. */
export const dim = (t: string) => paint("2", t);
/** Rouge. */
export const red = (t: string) => paint("31", t);
/** Vert. */
export const green = (t: string) => paint("32", t);
/** Jaune. */
export const yellow = (t: string) => paint("33", t);
/** Bleu. */
export const blue = (t: string) => paint("34", t);
/** Magenta. */
export const magenta = (t: string) => paint("35", t);
/** Cyan. */
export const cyan = (t: string) => paint("36", t);
/** Avertissement. */
export const warn = (t: string) => paint("1;93", t);
/** Danger. */
export const danger = (t: string) => paint("1;91", t);

/** Ligne de chrome terminal -> stderr (jamais stdout). */
export function println(line = ""): void {
  process.stderr.write(line + "\n");
}

/** Écrit des DONNÉES sur stdout (sans newline automatique). */
export function writeOut(chunk: string): void {
  process.stdout.write(chunk);
}

/** Émet un événement NDJSON sur stdout (--format json). */
export function emitNdjson(event: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + "\n");
}

/** Rapporte une erreur honnête : stderr + code 1. */
export function fail(message: string): number {
  println(red(`Error: ${message}`));
  return 1;
}

/** Vrai si le flux demandé est interactif (TTY). */
export function isInteractive(stream: NodeJS.WriteStream = process.stderr): boolean {
  return Boolean(stream.isTTY);
}

/** Garde d'interactivité : refuse proprement les pickers hors TTY. */
export function requireInteractive(what: string): number | null {
  if (isInteractive()) return null;
  return fail(`${what} requires an interactive terminal (TTY). Pass explicit arguments instead.`);
}

/** Lit stdin entier (prompts pipés) ; null si TTY ou vide. */
export async function readStdinIfPiped(): Promise<string | null> {
  if (process.stdin.isTTY) return null;
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text.length ? text : null;
}

/** Sorties standards. */
export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_INTERRUPT = 130;