/**
 * Exact-edit matcher — port de la stratégie du tool `edit` d'OpenCode.
 * Trois paliers de matching tolérant, dans l'ordre :
 *   1. bytes exacts            (indexOf)
 *   2. unicité normalisée      (guillemets/tirets/espaces typographiques)
 *   3. lignes multi-lignes     (trailing whitespace toléré, fin de ligne préservée)
 * Aucun succès fictif : 0 correspondance ou ambiguïté → error honnête.
 */

const CRLF = "\r\n";

export interface EditMatch {
  start: number;
  end: number;
}

export interface EditOutcome {
  content: string;
  replacements: number;
  applied: number;
  error?: string;
}

export function normalizeForMatch(value: string): string {
  return value
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/[  -   　]/g, " ");
}

function findOccurrences(content: string, search: string): EditMatch[] {
  const result: EditMatch[] = [];
  let offset = 0;
  while ((offset = content.indexOf(search, offset)) !== -1) {
    result.push({ start: offset, end: offset + search.length });
    offset += search.length;
  }
  return result;
}

function findLineOccurrences(content: string, search: string): EditMatch[] {
  const trailingNewline = search.endsWith("\n");
  const expected = search.split("\n");
  if (trailingNewline) expected.pop();
  const lines = [...content.matchAll(/[^\n]*(?:\n|$)/g)]
    .filter((m) => m[0] !== "")
    .map((m) => {
      const newline = m[0].endsWith("\n");
      const text = newline ? m[0].slice(0, -1) : m[0];
      return {
        start: m.index!,
        end: m.index! + m[0].length,
        text,
        contentEnd: m.index! + text.length - (text.endsWith("\r") ? 1 : 0),
        newline,
      };
    });
  const candidates = lines.flatMap((line, index) => {
    const actual = lines.slice(index, index + expected.length);
    if (actual.length !== expected.length) return [];
    const matched = actual.every(
      (item, li) =>
        normalizeForMatch(item.text.trimEnd()) === normalizeForMatch(expected[li].trimEnd())
    );
    if (!matched) return [];
    const last = actual[actual.length - 1]!;
    if (trailingNewline && !last.newline) return [];
    return [{ start: line.start, end: trailingNewline ? last.end : last.contentEnd }];
  });
  return candidates.reduce<EditMatch[]>((acc, candidate) => {
    if (acc.some((m) => m.end > candidate.start && m.start < candidate.end)) return acc;
    acc.push(candidate);
    return acc;
  }, []);
}

function lineEnding(text: string, fallback: string): string {
  const crlfCount = text.split(CRLF).length - 1;
  const lfCount = text.split("\n").length - 1 - crlfCount;
  if (crlfCount === lfCount) return fallback;
  return crlfCount > lfCount ? CRLF : "\n";
}

function alignLines(before: string[], after: string[]): (number | undefined)[] {
  const width = after.length + 1;
  const table = new Uint32Array((before.length + 1) * width);
  for (let i = before.length - 1; i >= 0; i--)
    for (let j = after.length - 1; j >= 0; j--)
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const result: (number | undefined)[] = [];
  const gap = { before: [] as number[], after: [] as number[] };
  const flush = () => {
    gap.after.forEach((j, k) => (result[j] = gap.before[k]));
    gap.before = [];
    gap.after = [];
  };
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      flush();
      result[j++] = i++;
      continue;
    }
    if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) gap.before.push(i++);
    else gap.after.push(j++);
  }
  while (i < before.length) gap.before.push(i++);
  while (j < after.length) gap.after.push(j++);
  flush();
  return result;
}

function withRegionEndings(region: string, replacement: string, fallback: string): string {
  const before = region.split(/\r?\n/);
  const endings = [...region.matchAll(/\r?\n/g)].map((m) => m[0]);
  const after = replacement.split("\n");
  const key = (line: string) => normalizeForMatch(line.trimEnd());
  const source = alignLines(before.map(key), after.map(key));
  return after
    .map((line, index) =>
      index === after.length - 1 ? line : line + (endings[source[index]!] ?? fallback)
    )
    .join("");
}

function countBefore(positions: number[], offset: number): number {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (positions[middle]! < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

function matchView(source: string, oldString: string, newString: string) {
  const view = source.replaceAll(CRLF, "\n");
  const removed = [...source.matchAll(/\r\n/g)].map((m, index) => m.index! - index);
  const fileEnding = lineEnding(source, "\n");
  const search = oldString.replaceAll(CRLF, "\n");
  const replacement = newString.replaceAll(CRLF, "\n");
  const exact = findOccurrences(view, search);
  const unicode = exact.length > 0 ? [] : findOccurrences(normalizeForMatch(view), normalizeForMatch(search));
  const trailing = exact.length > 0 || unicode.length > 0 ? [] : findLineOccurrences(view, search);
  return {
    matches: (exact.length > 0 ? exact : unicode.length > 0 ? unicode : trailing).map((m) => ({
      start: m.start + countBefore(removed, m.start),
      end: m.end + countBefore(removed, m.end),
    })),
    replace: (match: EditMatch) => {
      const region = source.slice(match.start, match.end);
      return withRegionEndings(region, replacement, lineEnding(region, fileEnding));
    },
  };
}

function lineNumberAt(content: string, offset: number): number {
  return content.slice(0, offset).split("\n").length;
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function notFoundMessage(source: string, oldString: string): string {
  const firstLine = oldString.split("\n")[0]!.trimEnd();
  const normalizedFirst = normalizeForMatch(firstLine);
  const candidates = source
    .split("\n")
    .map((text, i) => ({
      line: i + 1,
      text,
      score: commonPrefixLength(normalizeForMatch(text.trimEnd()), normalizedFirst),
    }))
    .filter((c) => c.score >= Math.max(4, normalizedFirst.length * 0.4))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const hint =
    candidates.length > 0
      ? `\nNearest matching lines (check indentation/whitespace):\n${candidates
          .map((c) => `  line ${c.line}: ${JSON.stringify(c.text)}`)
          .join("\n")}`
      : "\nNo line in the file resembles the target — verify the path and the exact content.";
  return (
    `Could not find the target text in the file. It must match exactly, including whitespace and indentation. ` +
    `Target first line: ${JSON.stringify(firstLine)}.${hint}`
  );
}

function ambiguousMessage(source: string, matches: EditMatch[]): string {
  const spots = matches.slice(0, 5).map((m) => `line ${lineNumberAt(source, m.start)}`).join(", ");
  const more = matches.length > 5 ? ` (+${matches.length - 5} more)` : "";
  return (
    `Found ${matches.length} matches for the target, but expected exactly one. ` +
    `Add more surrounding context to make it unique, or set allOccurrences to true to replace every occurrence. ` +
    `Matches at: ${spots}${more}.`
  );
}

/**
 * Applique un remplacement exact sur `source` avec la stratégie multi-paliers.
 * Ne lève jamais : un échec est rapporté via `error` (honnête, actionnable).
 */
export function applyEdit(
  source: string,
  oldString: string,
  newString: string,
  replaceAll: boolean = false
): EditOutcome {
  if (oldString === "") {
    return {
      content: source,
      replacements: 0,
      applied: 0,
      error: "The target text must not be empty. Use write_file to create or overwrite a file.",
    };
  }
  if (oldString === newString) {
    return {
      content: source,
      replacements: 0,
      applied: 0,
      error: "No changes to apply: the target and the replacement are identical.",
    };
  }

  const endingsOnly = oldString.replaceAll("\r", "") === newString.replaceAll("\r", "");
  const { matches, replace } = endingsOnly
    ? { matches: findOccurrences(source, oldString), replace: () => newString }
    : matchView(source, oldString, newString);

  const replacements = matches.length;
  if (replacements === 0) {
    return { content: source, replacements: 0, applied: 0, error: notFoundMessage(source, oldString) };
  }
  if (replacements > 1 && !replaceAll) {
    return {
      content: source,
      replacements,
      applied: 0,
      error: ambiguousMessage(source, matches),
    };
  }

  const selected = replaceAll ? matches : matches.slice(0, 1);
  const replaced = [...selected]
    .reverse()
    .reduce(
      (content, m) => content.slice(0, m.start) + replace(m) + content.slice(m.end),
      source
    );
  if (replaced === source) {
    return {
      content: source,
      replacements,
      applied: 0,
      error: "No changes to apply: the edit leaves the file unchanged.",
    };
  }
  return { content: replaced, replacements, applied: selected.length };
}
