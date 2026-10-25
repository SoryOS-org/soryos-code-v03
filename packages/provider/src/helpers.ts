import type { ChatMessage, StreamChunk } from "./types";

declare const __non_webpack_require__: ((id: string) => unknown) | undefined;

export function computeFingerprint(secret?: string): string {
  if (!secret || secret.trim().length === 0) return "none";
  const trimmed = secret.trim();
  
  if (typeof window === "undefined") {
    // Node.js environment
    try {
      const req = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : eval("require");
      const crypto = req("crypto");
      const hash = crypto.createHash("sha256").update(trimmed).digest("hex");
      return `sha256:${hash.slice(0, 8)}...${hash.slice(-4)}`;
    } catch {
      return "sha256:fallback";
    }
  } else {
    // Browser environment simple hash fallback
    let hash = 0;
    for (let i = 0; i < trimmed.length; i++) {
      hash = (hash << 5) - hash + trimmed.charCodeAt(i);
      hash |= 0;
    }
    return `browser:${Math.abs(hash).toString(16)}`;
  }
}

export function maskSecret(val?: string): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (trimmed.length <= 8) return "••••••••";
  const start = trimmed.slice(0, 4);
  const end = trimmed.slice(-4);
  return `${start}••••••••${end}`;
}

export function redactSecretText(text: string, secretsToRedact: string[] = []): string {
  let result = text;
  for (const sec of secretsToRedact) {
    if (sec && sec.length > 5) {
      result = result.split(sec).join("[REDACTED]");
    }
  }
  result = result.replace(/AIza[0-9A-Za-z-_]{35}/g, "AIza[REDACTED]");
  result = result.replace(/sk-[0-9A-Za-z-_]{20,}/g, "sk-[REDACTED]");
  return result;
}

export interface ParsedApiError {
  statusCode: number;
  errorType: string;
  message: string;
  endpoint: string;
}

export async function parseResponseError(
  res: Response,
  endpoint: string,
  apiKeyToRedact?: string,
): Promise<ParsedApiError> {
  let rawBody = "";
  try {
    rawBody = await res.text();
  } catch {
    rawBody = "(empty response)";
  }

  let errorType = `HTTP_${res.status}`;
  let message = `Request to ${endpoint} failed with HTTP status ${res.status}`;

  try {
    const json = JSON.parse(rawBody);
    if (json.error) {
      if (typeof json.error === "string") {
        message = json.error;
      } else if (typeof json.error === "object") {
        message = json.error.message || json.error.code || message;
        errorType = json.error.type || json.error.code || errorType;
      }
    }
  } catch {
    if (rawBody && rawBody.length > 0) {
      message = rawBody.slice(0, 300);
    }
  }

  const safeMessage = redactSecretText(message, apiKeyToRedact ? [apiKeyToRedact] : []);

  return {
    statusCode: res.status,
    errorType,
    message: safeMessage,
    endpoint,
  };
}

// ---------------------------------------------------------------------------
// Multimodal message mapping (text + image attachments → provider wire format)
// ---------------------------------------------------------------------------

type ProviderChatMessage = ChatMessage;

/**
 * Google Gemini wire format: contents[] of {role, parts[]} where image parts
 * are {inlineData: {mimeType, data}}.
 */
export function buildGoogleContents(messages: ProviderChatMessage[]): Array<{
  role: "user" | "model";
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}> {
  return messages.map((msg) => ({
    role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [
      { text: msg.content },
      ...(msg.images ?? []).map((img) => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
    ],
  }));
}

/**
 * OpenAI wire format: content is a string when text-only, or an array of
 * {type:"text"} / {type:"image_url"} parts when images are attached.
 */
export function buildOpenAIMessages(
  messages: ProviderChatMessage[]
): Array<{ role: string; content: unknown }> {
  return messages.map((msg) => {
    const images = msg.images ?? [];
    if (images.length === 0) return { role: msg.role, content: msg.content };
    return {
      role: msg.role,
      content: [
        { type: "text", text: msg.content },
        ...images.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mimeType};base64,${img.data}` },
        })),
      ],
    };
  });
}

/**
 * Anthropic wire format: content is a string when text-only, or an array of
 * {type:"text"} / {type:"image"} (base64 source) blocks when attached.
 */
export function buildAnthropicMessages(
  messages: ProviderChatMessage[]
): Array<{ role: string; content: unknown }> {
  return messages.map((msg) => {
    const images = msg.images ?? [];
    if (images.length === 0) return { role: msg.role, content: msg.content };
    return {
      role: msg.role,
      content: [
        { type: "text", text: msg.content },
        ...images.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mimeType, data: img.data },
        })),
      ],
    };
  });
}

/** Honest text-only fallback note when a provider cannot receive images. */
export function describeDroppedImages(messages: ProviderChatMessage[]): string {
  const count = messages.reduce((sum, msg) => sum + (msg.images?.length ?? 0), 0);
  return count > 0
    ? `\n\n[${count} image attachment(s) were provided but this provider does not support image input]`
    : "";
}
