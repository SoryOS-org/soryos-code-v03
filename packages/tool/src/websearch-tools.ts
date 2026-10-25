/**
 * websearch — recherche web réelle via DuckDuckGo HTML.
 * Aucune simulation : requête HTTP physique + parsing des résultats.
 */

import { globalEventBus } from "@soryos/bus";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchOutput {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const TIMEOUT_MS = 15000;
const MAX_RESULTS = 10;
const MAX_SNIPPET_CHARS = 300;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDuckDuckGoHtml(html: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  const resultBlocks = html.split(/<div class="result results_links/).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= MAX_RESULTS) break;

    const urlMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/);
    const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/);
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

    if (!urlMatch) continue;

    let url = urlMatch[1];
    if (url.includes("uddg=")) {
      const uddgMatch = url.match(/uddg=([^&]+)/);
      if (uddgMatch) {
        try {
          url = decodeURIComponent(uddgMatch[1]);
        } catch {
          url = uddgMatch[1];
        }
      }
    }

    const title = titleMatch ? decodeHtmlEntities(stripHtml(titleMatch[1])) : url;
    let snippet = snippetMatch ? decodeHtmlEntities(stripHtml(snippetMatch[1])) : "";
    if (snippet.length > MAX_SNIPPET_CHARS) {
      snippet = `${snippet.slice(0, MAX_SNIPPET_CHARS)}…`;
    }

    if (url.startsWith("http")) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

export class WebSearchTool {
  async search(query: string): Promise<WebSearchOutput> {
    const callId = `websearch-${Date.now()}`;
    const trimmed = query.trim();
    if (!trimmed) {
      return { success: false, error: "Search query must not be empty." };
    }

    globalEventBus.emit("tool.started", { toolName: "websearch", input: { query: trimmed }, callId });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      if (!response.ok) {
        const httpError = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
        globalEventBus.emit("tool.failed", { toolName: "websearch", error: httpError, callId });
        return { success: false, error: `Search failed: ${httpError}` };
      }

      const html = await response.text();
      const results = parseDuckDuckGoHtml(html);

      if (results.length === 0) {
        const noResults = `No search results found for "${trimmed}". Try a different query.`;
        globalEventBus.emit("tool.completed", { toolName: "websearch", output: noResults, callId, metadata: { query: trimmed, resultCount: 0 } });
        return { success: true, output: noResults, metadata: { query: trimmed, resultCount: 0 } };
      }

      const output = results
        .map((r, i) => {
          const snippet = r.snippet ? `\n${r.snippet}` : "";
          return `${i + 1}. [${r.title}](${r.url})${snippet}`;
        })
        .join("\n\n");

      const metadata = {
        query: trimmed,
        resultCount: results.length,
        results: results.map((r) => ({ title: r.title, url: r.url })),
      };

      globalEventBus.emit("tool.completed", { toolName: "websearch", output, callId, metadata });
      return { success: true, output, metadata };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Search timed out after ${TIMEOUT_MS}ms`
            : error.message
          : String(error);
      globalEventBus.emit("tool.failed", { toolName: "websearch", error: message, callId });
      return { success: false, error: `websearch failed: ${message}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
