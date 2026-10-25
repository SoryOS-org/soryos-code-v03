import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readImageInfo, detectImageFormat } from "@soryos/images";
import {
  VisionTools,
  resolveVisionProvider,
} from "../src/vision-tools";
import { VoiceTools, resolveVoiceProvider } from "../src/voice-tools";
import { ImageTools } from "../src/image-tools";

/** Real PNG header: signature + IHDR chunk (width/height/depth/colorType). */
function pngBytes(width: number, height: number, colorType: number): Buffer {
  const buf = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0);
  buf.writeUInt32BE(13, 8); // IHDR length
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = colorType;
  return buf;
}

/** Real JPEG: SOI + APP0(JFIF) + SOF0 with dimensions + EOI. */
function jpegBytes(width: number, height: number): Buffer {
  const parts: number[] = [0xff, 0xd8]; // SOI
  parts.push(0xff, 0xe0, 0x00, 0x10);
  parts.push(0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0); // JFIF
  parts.push(0xff, 0xc0, 0x00, 0x11, 0x08); // SOF0, length 17, precision 8
  parts.push((height >> 8) & 0xff, height & 0xff);
  parts.push((width >> 8) & 0xff, width & 0xff);
  parts.push(0x03, 1, 0x11, 1, 2, 0x11, 3, 0x11, 0x00); // 3 components
  parts.push(0xff, 0xd9); // EOI
  return Buffer.from(parts);
}

/** Real GIF89a header with dimensions. */
function gifBytes(width: number, height: number): Buffer {
  const buf = Buffer.alloc(14);
  buf.write("GIF89a", 0);
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

describe("@soryos/images readImageInfo (real byte parsing)", () => {
  it("parses PNG dimensions, format, and alpha flag", () => {
    const rgb = readImageInfo(pngBytes(640, 480, 2)); // colorType 2 = RGB, no alpha
    expect(rgb).not.toBeNull();
    expect(rgb!.format).toBe("png");
    expect(rgb!.mimeType).toBe("image/png");
    expect(rgb!.width).toBe(640);
    expect(rgb!.height).toBe(480);
    expect(rgb!.hasAlpha).toBe(false);
    expect(rgb!.sizeBytes).toBe(33);

    const rgba = readImageInfo(pngBytes(16, 32, 6)); // colorType 6 = RGBA
    expect(rgba!.hasAlpha).toBe(true);
  });

  it("parses JPEG dimensions from the SOF0 marker", () => {
    const info = readImageInfo(jpegBytes(128, 64));
    expect(info).not.toBeNull();
    expect(info!.format).toBe("jpeg");
    expect(info!.mimeType).toBe("image/jpeg");
    expect(info!.width).toBe(128);
    expect(info!.height).toBe(64);
  });

  it("parses GIF dimensions from the header", () => {
    const info = readImageInfo(gifBytes(100, 200));
    expect(info).not.toBeNull();
    expect(info!.format).toBe("gif");
    expect(info!.width).toBe(100);
    expect(info!.height).toBe(200);
  });

  it("detects BMP magic bytes", () => {
    expect(detectImageFormat(Buffer.from([0x42, 0x4d, 0x00, 0x00]))).toBe("bmp");
  });

  it("returns null for garbage bytes (never guesses)", () => {
    expect(readImageInfo(Buffer.from("this is not an image at all"))).toBeNull();
    expect(detectImageFormat(Buffer.from("hello world"))).toBe("unknown");
  });

  it("returns null for a truncated PNG header", () => {
    const truncated = pngBytes(10, 10, 2).subarray(0, 12);
    expect(readImageInfo(truncated)).toBeNull();
  });
});

describe("vision_analyze provider resolution (no network, honest config errors)", () => {
  const ENV_VARS = ["GEMINI_API_KEY", "OPENAI_API_KEY", "MISTRAL_API_KEY", "ANTHROPIC_API_KEY"];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const v of ENV_VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
  });

  afterEach(() => {
    for (const v of ENV_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it("fails honestly when no vision API key is configured", () => {
    const r = resolveVisionProvider();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("GEMINI_API_KEY");
      expect(r.error).toContain("ANTHROPIC_API_KEY");
    }
  });

  it('rejects provider "local" (placeholder, no real model)', () => {
    const r = resolveVisionProvider("local");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("placeholder");
  });

  it("rejects unknown providers", () => {
    const r = resolveVisionProvider("soryos-vision-9000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unknown provider");
  });

  it("requires the env var of the explicit provider", () => {
    const r = resolveVisionProvider("openai");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("OPENAI_API_KEY");
  });

  it("auto-detects the provider from env keys", () => {
    process.env.MISTRAL_API_KEY = "test-key";
    const r = resolveVisionProvider();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.provider).toBe("mistral");
  });

  it("vision_analyze fails honestly without keys (before any network call)", async () => {
    const tools = new VisionTools();
    const r = await tools.analyze({ image: "/nonexistent/image.png" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("no vision provider configured");
  });

  it("vision_analyze fails honestly on a missing image file", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const tools = new VisionTools();
    const r = await tools.analyze({ image: "/definitely/not/here.png" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("image file not found");
  });

  it("vision_analyze rejects analysisType custom without prompt", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const tools = new VisionTools();
    const r = await tools.analyze({ image: "/x.png", analysisType: "custom" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("requires a non-empty");
  });
});

describe("voice_transcribe provider resolution (no network, honest errors)", () => {
  const ENV_VARS = [
    "GOOGLE_SPEECH_API_KEY",
    "GOOGLE_API_KEY",
    "AZURE_SPEECH_KEY",
    "WHISPER_ENDPOINT",
    "WHISPER_API_KEY",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const v of ENV_VARS) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
  });

  afterEach(() => {
    for (const v of ENV_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  });

  it("defaults to whisper when no speech key is configured", () => {
    const r = resolveVoiceProvider();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.provider).toBe("whisper");
  });

  it("prefers google when a Google key exists", () => {
    process.env.GOOGLE_API_KEY = "k";
    const r = resolveVoiceProvider();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.provider).toBe("google");
  });

  it('rejects browser-only provider "web-speech-api" honestly', () => {
    const r = resolveVoiceProvider("web-speech-api");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("browser");
  });

  it('rejects "aws" honestly (S3 integration not implemented)', () => {
    const r = resolveVoiceProvider("aws");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("S3");
  });

  it("transcribe fails honestly on a missing audio file", async () => {
    const tools = new VoiceTools();
    const r = await tools.transcribe({ path: "/no/such/audio.wav" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("audio file not found");
  });

  it("transcribe fails honestly when google has no API key (file read physically)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "soryos-voice-"));
    try {
      const file = join(dir, "sample.wav");
      await writeFile(file, Buffer.from("RIFF....WAVEfmt "));
      const tools = new VoiceTools();
      const r = await tools.transcribe({ path: file, provider: "google" });
      expect(r.success).toBe(false);
      expect(r.error).toContain("GOOGLE_SPEECH_API_KEY");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("image_info (physical disk read + header parsing)", () => {
  it("reads real image metadata from a file on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "soryos-image-"));
    try {
      const file = join(dir, "shot.png");
      await writeFile(file, pngBytes(800, 600, 6));

      const tools = new ImageTools();
      const r = await tools.info({ path: file });
      expect(r.success).toBe(true);
      expect(r.output).toContain("800x600");
      expect(r.output).toContain("PNG");
      expect(r.metadata).toMatchObject({ format: "png", width: 800, height: 600, hasAlpha: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails honestly on a missing file", async () => {
    const tools = new ImageTools();
    const r = await tools.info({ path: "/no/such/image.png" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("image file not found");
  });

  it("fails honestly on bytes that are not an image", async () => {
    const dir = await mkdtemp(join(tmpdir(), "soryos-image-"));
    try {
      const file = join(dir, "fake.png");
      await writeFile(file, "definitely not an image, just text");
      const tools = new ImageTools();
      const r = await tools.info({ path: file });
      expect(r.success).toBe(false);
      expect(r.error).toContain("not a recognised image format");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
