/**
 * voice_transcribe — real speech-to-text via @soryos/voice for audio FILES on disk.
 * Physical I/O only: the audio file is read byte-by-byte from disk, then sent to a
 * real transcription endpoint (Whisper/Google/Azure). Browser-only providers are
 * rejected honestly — no microphone exists in a server process.
 */

import { globalEventBus } from "@soryos/bus";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEFAULT_VOICE_CONFIG,
  TranscriberFactory,
  getTranscriber,
  type VoiceProvider,
  type AudioFormat,
} from "@soryos/voice";

export interface VoiceTranscribeInput {
  /** Path to the audio file (wav/mp3/ogg/opus/webm/pcm). */
  path: string;
  provider?: string;
  language?: string;
  sessionId?: string;
}

export interface VoiceTranscribeOutput {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const CALL_TIMEOUT_MS = 120_000;

const SERVER_PROVIDERS: VoiceProvider[] = ["whisper", "google", "azure", "aws"];

const EXT_FORMAT: Record<string, AudioFormat> = {
  wav: "wav",
  mp3: "mp3",
  ogg: "ogg",
  oga: "ogg",
  opus: "opus",
  webm: "webm",
  pcm: "pcm",
};

function detectFormat(path: string): AudioFormat | undefined {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_FORMAT[ext];
}

/** Live env-var lookup so config is always fresh (never a stale cached key). */
function buildConfig(provider: VoiceProvider, language?: string) {
  let apiKey: string | undefined;
  let endpoint: string | undefined;

  switch (provider) {
    case "google":
      apiKey = process.env.GOOGLE_SPEECH_API_KEY || process.env.GOOGLE_API_KEY;
      break;
    case "azure":
      apiKey = process.env.AZURE_SPEECH_KEY;
      endpoint = process.env.AZURE_SPEECH_ENDPOINT;
      break;
    case "whisper":
      apiKey = process.env.WHISPER_API_KEY;
      endpoint = process.env.WHISPER_ENDPOINT || "http://localhost:8000/whisper";
      break;
    default:
      break;
  }

  return {
    ...DEFAULT_VOICE_CONFIG,
    provider,
    language: language?.trim() || DEFAULT_VOICE_CONFIG.language,
    ...(apiKey ? { apiKey } : {}),
    ...(endpoint ? { endpoint } : {}),
  };
}

/** Pick a working server-side provider from config, or fail with an honest message. */
export function resolveVoiceProvider(explicit?: string):
  | { ok: true; provider: VoiceProvider }
  | { ok: false; error: string } {
  if (explicit) {
    const provider = explicit.trim().toLowerCase() as VoiceProvider;
    if (provider === "web-speech-api") {
      return {
        ok: false,
        error:
          'voice_transcribe: provider "web-speech-api" runs in the browser (Web Speech API) and cannot work in a server process. Use whisper, google, or azure.',
      };
    }
    if (!SERVER_PROVIDERS.includes(provider)) {
      return {
        ok: false,
        error: `voice_transcribe: unknown provider "${explicit}". Supported: whisper, google, azure.`,
      };
    }
    if (provider === "aws") {
      return {
        ok: false,
        error:
          'voice_transcribe: provider "aws" requires S3 bucket integration which is not implemented (the AWS transcriber itself reports this). Use whisper, google, or azure.',
      };
    }
    return { ok: true, provider };
  }

  // Auto-detect: google → azure → whisper (local endpoint).
  if (process.env.GOOGLE_SPEECH_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return { ok: true, provider: "google" };
  }
  if (process.env.AZURE_SPEECH_KEY?.trim()) {
    return { ok: true, provider: "azure" };
  }
  return { ok: true, provider: "whisper" };
}

export class VoiceTools {
  /** Transcribe an audio file from disk. Returns honest errors for missing files/endpoints/keys. */
  async transcribe(input: VoiceTranscribeInput): Promise<VoiceTranscribeOutput> {
    const callId = `voice-${Date.now()}`;
    const startedAt = Date.now();

    const resolvedProvider = resolveVoiceProvider(input.provider);
    if (!resolvedProvider.ok) {
      globalEventBus.emit("tool.failed", { toolName: "voice_transcribe", error: resolvedProvider.error, callId });
      return { success: false, error: resolvedProvider.error };
    }
    const provider = resolvedProvider.provider;

    globalEventBus.emit("tool.started", {
      toolName: "voice_transcribe",
      input: { path: input.path, provider },
      callId,
    });

    try {
      const abs = resolve(input.path.trim());
      const fileStat = await stat(abs).catch(() => null);
      if (!fileStat || !fileStat.isFile()) {
        throw new Error(`audio file not found: ${abs}`);
      }
      if (fileStat.size === 0) {
        throw new Error(`audio file is empty: ${abs}`);
      }
      if (fileStat.size > MAX_AUDIO_BYTES) {
        throw new Error(
          `audio file is ${fileStat.size} bytes; maximum accepted size is ${MAX_AUDIO_BYTES} bytes (25MB).`,
        );
      }

      const bytes = await readFile(abs);
      const config = buildConfig(provider, input.language);

      // The factory caches instances by provider — recreate if a cached one lost its key.
      let transcriber = getTranscriber(provider, config);
      if (!transcriber.isSupported()) {
        TranscriberFactory.clearInstances();
        transcriber = getTranscriber(provider, config);
      }
      if (!transcriber.isSupported()) {
        const hint =
          provider === "google"
            ? "Set GOOGLE_SPEECH_API_KEY (or GOOGLE_API_KEY)."
            : provider === "azure"
              ? "Set AZURE_SPEECH_KEY."
              : `Ensure the Whisper endpoint is reachable (${config.endpoint}).`;
        throw new Error(`provider "${provider}" is not configured. ${hint}`);
      }

      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`voice_transcribe timed out after ${CALL_TIMEOUT_MS}ms`)),
          CALL_TIMEOUT_MS,
        );
      });
      const transcribePromise = transcriber.transcribe({
        audio: new Uint8Array(bytes),
        format: detectFormat(abs),
        language: input.language,
        sessionId: input.sessionId,
      });
      const result = await Promise.race([transcribePromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      const text = (result.text ?? "").trim();
      if (!text) {
        const error = `voice_transcribe: provider "${provider}" returned an empty transcript for "${abs}".`;
        globalEventBus.emit("tool.failed", { toolName: "voice_transcribe", error, callId });
        return { success: false, error };
      }

      const metadata = {
        provider: result.provider,
        model: result.model ?? null,
        language: result.language ?? input.language ?? null,
        confidence: result.confidence ?? null,
        wordCount: result.wordCount,
        file: abs,
        fileBytes: fileStat.size,
        durationMs: Date.now() - startedAt,
      };

      globalEventBus.emit("tool.completed", { toolName: "voice_transcribe", output: text, callId, metadata });
      return { success: true, output: text, metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "voice_transcribe", error: message, callId });
      return { success: false, error: `voice_transcribe failed: ${message}` };
    }
  }
}
