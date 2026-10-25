/**
 * image_info — real image metadata inspection (format, dimensions, size).
 * Physical I/O only: local files are read byte-by-byte from disk, URLs are fetched,
 * then parsed by @soryos/images readImageInfo (magic bytes + header parsing).
 */

import { globalEventBus } from "@soryos/bus";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { readImageInfo, type ImageInfo } from "@soryos/images";

export interface ImageInfoInput {
  /** Local file path or http(s) URL. */
  path: string;
}

export interface ImageInfoOutput {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

function formatInfo(info: ImageInfo, source: string): string {
  const lines = [
    `File: ${source}`,
    `Format: ${info.format.toUpperCase()} (${info.mimeType})`,
    `Dimensions: ${info.width}x${info.height}`,
    `Size: ${info.sizeBytes} bytes`,
  ];
  if (info.hasAlpha !== undefined) {
    lines.push(`Alpha channel: ${info.hasAlpha ? "yes" : "no"}`);
  }
  return lines.join("\n");
}

export class ImageTools {
  /** Read real image metadata from a file path or URL. */
  async info(input: ImageInfoInput): Promise<ImageInfoOutput> {
    const callId = `image-info-${Date.now()}`;
    const raw = input.path?.trim() ?? "";

    if (!raw) {
      return { success: false, error: 'image_info: "path" parameter must not be empty.' };
    }

    globalEventBus.emit("tool.started", { toolName: "image_info", input: { path: raw }, callId });

    try {
      let bytes: Buffer;
      let source: string;

      if (/^https?:\/\//i.test(raw)) {
        source = raw;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(raw, { signal: controller.signal, redirect: "follow" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`);
          }
          const declaredLength = Number(response.headers.get("content-length") ?? "0");
          if (declaredLength > MAX_IMAGE_BYTES) {
            throw new Error(
              `image is ${declaredLength} bytes; maximum accepted size is ${MAX_IMAGE_BYTES} bytes (50MB).`,
            );
          }
          bytes = Buffer.from(await response.arrayBuffer());
        } finally {
          clearTimeout(timer);
        }
        if (bytes.length > MAX_IMAGE_BYTES) {
          throw new Error(
            `image is ${bytes.length} bytes; maximum accepted size is ${MAX_IMAGE_BYTES} bytes (50MB).`,
          );
        }
      } else {
        const abs = resolve(raw);
        source = abs;
        const fileStat = await stat(abs).catch(() => null);
        if (!fileStat || !fileStat.isFile()) {
          throw new Error(`image file not found: ${abs}`);
        }
        if (fileStat.size > MAX_IMAGE_BYTES) {
          throw new Error(
            `image is ${fileStat.size} bytes; maximum accepted size is ${MAX_IMAGE_BYTES} bytes (50MB).`,
          );
        }
        bytes = await readFile(abs);
      }

      const info = readImageInfo(bytes);
      if (!info) {
        throw new Error(
          `"${source}" is not a recognised image format (magic bytes not matched for png/jpeg/gif/webp/bmp/svg/tiff).`,
        );
      }

      const metadata = {
        source,
        format: info.format,
        mimeType: info.mimeType,
        width: info.width,
        height: info.height,
        sizeBytes: info.sizeBytes,
        ...(info.hasAlpha !== undefined ? { hasAlpha: info.hasAlpha } : {}),
      };

      globalEventBus.emit("tool.completed", {
        toolName: "image_info",
        output: formatInfo(info, source),
        callId,
        metadata,
      });
      return { success: true, output: formatInfo(info, source), metadata };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      globalEventBus.emit("tool.failed", { toolName: "image_info", error: message, callId });
      return { success: false, error: `image_info failed: ${message}` };
    }
  }
}
