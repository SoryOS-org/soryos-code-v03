/**
 * vision_analyze — real image analysis via @soryos/vision (Gemini, OpenAI, Mistral, Anthropic).
 * Physical I/O only: local files are read byte-by-byte from disk, URLs are fetched.
 * The fake `local` placeholder provider is deliberately NOT exposed (NO FAKE EXECUTION).
 */

import { globalEventBus } from "@soryos/bus";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { readImageInfo } from "@soryos/images";
import {
  initializeVision,
  getVisionProvider,
  type VisionProvider,
  type VisionAnalysisType,
} from "@soryos/vision";

export interface VisionAnalyzeInput {
  /** Local file path, http(s) URL, or data: URL. */
  image: string;
  analysisType?: string;
  prompt?: string;
  provider?: string;
  sessionId?: string;
}

export interface VisionAnalyzeOutput {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const CALL_TIMEOUT_MS = 130_000;

const ANALYSIS_TYPES: VisionAnalysisType[] = [
  "description",
  "ocr",
  "objects",
  "text",
  "layout",
  "colors",
  "faces",
  "custom",
];

/** Env var per provider (keys are read live from process.env by the providers). */
const ENV_KEYS: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

const AUTODETECT_ORDER: VisionProvider[] = ["gemini", "openai", "mistral", "anthropic"];

/** Resolve the provider to use, or fail with an honest configuration error. */
export function resolveVisionProvider(explicit?: string): 
  | { ok: true; provider: VisionProvider }
  | { ok: false; error: string } {
  if (explicit) {
    const provider = explicit.trim().toLowerCase();
    if (provider === "local") {
      return {
        ok: false,
        error:
          'vision_analyze: provider "local" is a placeholder with no real model behind it and is not available. Use gemini, openai, mistral, or anthropic (each requires its API key env var).',
      };
    }
    if (!(provider in ENV_KEYS)) {
      return {
        ok: false,
        error: `vision_analyze: unknown provider "${explicit}". Supported: gemini, openai, mistral, anthropic.`,
      };
    }
    const envVar = ENV_KEYS[provider];
    if (!process.env[envVar]?.trim()) {
      return {
        ok: false,
        error: `vision_analyze: provider "${provider}" requires the ${envVar} environment variable to be set.`,
      };
    }
    return { ok: true, provider: provider as VisionProvider };
  }

  for (const candidate of AUTODETECT_ORDER) {
    if (process.env[ENV_KEYS[candidate]]?.trim()) {
      return { ok: true, provider: candidate };
    }
  }

  return {
    ok: false,
    error:
      "vision_analyze: no vision provider configured. Set one of GEMINI_API_KEY, OPENAI_API_KEY, MISTRAL_API_KEY, or ANTHROPIC_API_KEY.",
  };
}

type ResolvedImage =
  | { kind: "file"; source: string; dataUrl: string; info: ReturnType<typeof readImageInfo> }
  | { kind: "url"; source: string; url: string }
  | { kind: "data"; source: string; dataUrl: string };

/** Physically resolve the image input into something the vision provider can consume. */
async function resolveImageInput(image: string): Promise<ResolvedImage> {
  const trimmed = image.trim();
  if (!trimmed) {
    throw new Error("vision_analyze: image parameter must not be empty.");
  }

  if (trimmed.startsWith("data:")) {
    return { kind: "data", source: "data", dataUrl: trimmed };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return { kind: "url", source: "url", url: trimmed };
  }

  // Local path → physical disk read + magic-byte format check.
  const abs = resolve(trimmed);
  const fileStat = await stat(abs).catch(() => null);
  if (!fileStat || !fileStat.isFile()) {
    throw new Error(`vision_analyze: image file not found: ${abs}`);
  }
  if (fileStat.size > MAX_IMAGE_BYTES) {
    throw new Error(
      `vision_analyze: image is ${fileStat.size} bytes; maximum accepted size is ${MAX_IMAGE_BYTES} bytes (20MB).`,
    );
  }

  const bytes = await readFile(abs);
  const info = readImageInfo(bytes);
  if (!info) {
    throw new Error(
      `vision_analyze: "${abs}" is not a recognised image format (magic bytes not matched for png/jpeg/gif/webp/bmp).`,
    );
  }

  return {
    kind: "file",
    source: abs,
    dataUrl: `data:${info.mimeType};base64,${bytes.toString("base64")}`,
    info,
  };
}

export class VisionTools {
  /** Analyze an image. Returns honest errors for missing config, bad input, or API failures. */
  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeOutput> {
    const callId = `vision-${Date.now()}`;
    const startedAt = Date.now();

    const resolvedProvider = resolveVisionProvider(input.provider);
    if (!resolvedProvider.ok) {
      globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error: resolvedProvider.error, callId });
      return { success: false, error: resolvedProvider.error };
    }
    const provider = resolvedProvider.provider;

    const analysisType = (input.analysisType?.trim() || "description") as VisionAnalysisType;
    if (!ANALYSIS_TYPES.includes(analysisType)) {
      const error = `vision_analyze: unknown analysisType "${input.analysisType}". Supported: ${ANALYSIS_TYPES.join(", ")}.`;
      globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error, callId });
      return { success: false, error };
    }
    if (analysisType === "custom" && !input.prompt?.trim()) {
      const error = 'vision_analyze: analysisType "custom" requires a non-empty "prompt" parameter.';
      globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error, callId });
      return { success: false, error };
    }

    globalEventBus.emit("tool.started", {
      toolName: "vision_analyze",
      input: { image: input.image, analysisType, provider },
      callId,
    });

    try {
      const resolved = await resolveImageInput(input.image);

      // The provider factory caches per name; env keys are read live at request time.
      const visionProvider = getVisionProvider(provider);
      if (!visionProvider.isAvailable()) {
        const envVar = ENV_KEYS[provider];
        throw new Error(
          `vision_analyze: provider "${provider}" is not available — ${envVar} is not set.`,
        );
      }

      const manager = initializeVision(provider);
      const analysisPromise = manager.analyze({
        image: resolved.kind === "file" || resolved.kind === "data" ? resolved.dataUrl : resolved.url,
        analysisType,
        prompt: input.prompt,
        sessionId: input.sessionId,
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`vision_analyze timed out after ${CALL_TIMEOUT_MS}ms`)),
          CALL_TIMEOUT_MS,
        );
      });
      const result = await Promise.race([analysisPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      if (!result.success) {
        const error = `vision_analyze failed: ${result.error ?? "unknown provider error"}`;
        globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error, callId });
        return {
          success: false,
          error,
          metadata: { provider: result.provider, model: result.model, analysisType, durationMs: result.durationMs },
        };
      }

      const text = (result.text ?? "").trim();
      if (!text) {
        const error = `vision_analyze: provider "${provider}" returned an empty response for analysisType "${analysisType}".`;
        globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error, callId });
        return { success: false, error };
      }

      const metadata = {
        provider: result.provider,
        model: result.model,
        analysisType: result.analysisType,
        imageSource: resolved.kind,
        durationMs: Date.now() - startedAt,
      };

      globalEventBus.emit("tool.completed", { toolName: "vision_analyze", output: text, callId, metadata });
      return { success: true, output: text, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "vision_analyze", error: message, callId });
      return { success: false, error: `vision_analyze failed: ${message}` };
    }
  }
}
