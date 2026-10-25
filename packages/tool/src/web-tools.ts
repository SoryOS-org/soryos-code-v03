/**
 * webfetch — récupération HTTP réelle pour l'agent.
 * Aucune simulation : fetch physique + timeout + corps borné.
 */

import { globalEventBus } from "@soryos/bus";

export interface WebFetchResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const MAX_BODY_CHARS = 20000;
const TIMEOUT_MS = 15000;
const MAX_HEADER_ENTRIES = 30;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export class WebFetchTool {
  async fetchPage(
    url: string,
    options?: { method?: string; body?: string; format?: string }
  ): Promise<WebFetchResult> {
    const callId = `webfetch-${Date.now()}`;
    const method = (options?.method ?? "GET").toUpperCase();
    const format = options?.format ?? "text";

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, error: `Invalid URL: ${url}` };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return {
        success: false,
        error: `Unsupported protocol "${parsed.protocol}". Only http: and https: are allowed.`,
      };
    }

    globalEventBus.emit("tool.started", { toolName: "webfetch", input: { url, method }, callId });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(parsed.toString(), {
        method,
        headers: { "User-Agent": "SoryOS-Agent/1.0", Accept: "*/*" },
        body: options?.body ?? undefined,
        signal: controller.signal,
        redirect: "follow",
      });

      const contentType = response.headers.get("content-type") ?? "";
      const rawBody = await response.text().catch(() => "");
      const isHtml = contentType.includes("text/html") || /^\s*<(!doctype|html)/i.test(rawBody);
      const text = format === "html" ? rawBody : isHtml && format !== "html" ? stripHtml(rawBody) : rawBody;
      const truncated = text.length > MAX_BODY_CHARS;
      const bounded = truncated ? `${text.slice(0, MAX_BODY_CHARS)}\n… [truncated after ${MAX_BODY_CHARS} characters]` : text;

      const headers: Record<string, string> = {};
      let headerCount = 0;
      response.headers.forEach((value, key) => {
        if (headerCount++ < MAX_HEADER_ENTRIES) headers[key] = value;
      });

      const headersBlock = Object.entries(headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");

      const output = [
        `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`,
        `URL: ${parsed.toString()}`,
        `Content-Type: ${contentType || "unknown"}`,
        headersBlock ? `\n${headersBlock}` : "",
        "",
        bounded || "(empty body)",
      ]
        .filter((line) => line !== undefined)
        .join("\n");

      const metadata = {
        url: parsed.toString(),
        status: response.status,
        contentType,
        bodyChars: bounded.length,
        truncated,
        headers,
      };

      if (response.ok) {
        globalEventBus.emit("tool.completed", { toolName: "webfetch", output, callId, metadata });
        return { success: true, output, metadata };
      }

      const httpError = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
      globalEventBus.emit("tool.failed", { toolName: "webfetch", error: httpError, callId });
      return { success: false, error: `${httpError} — ${parsed.toString()}`, metadata };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.name === "AbortError"
            ? `Request timed out after ${TIMEOUT_MS}ms`
            : error.message
          : String(error);
      globalEventBus.emit("tool.failed", { toolName: "webfetch", error: message, callId });
      return { success: false, error: `webfetch failed: ${message}` };
    } finally {
      clearTimeout(timer);
    }
  }
}
