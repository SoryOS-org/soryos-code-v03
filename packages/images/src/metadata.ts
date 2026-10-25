/**
 * Server-side image metadata parsing — real byte inspection, zero dependencies.
 * No browser required: magic-number sniffing + header parsing for dimensions.
 */

import type { ImageFormat } from "./types";

/** Detected image format — ImageFormat plus 'unknown' when magic bytes don't match. */
export type DetectedFormat = ImageFormat | "unknown";

export interface ImageInfo {
  /** Never 'unknown' — readImageInfo returns null instead. */
  format: ImageFormat;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  /** PNG only: color type contains an alpha channel (types 4 and 6). */
  hasAlpha?: boolean;
}

const MIME_BY_FORMAT: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
};

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readInt32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  );
}

/** Detect the image format from magic bytes. Returns 'unknown' when unrecognised. */
export function detectImageFormat(bytes: Uint8Array): DetectedFormat {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }
  if (startsWith(bytes, [0x42, 0x4d])) return "bmp";
  if (startsWith(bytes, [0x3c, 0x3f, 0x78, 0x6d, 0x6c])) return "svg"; // <?xml (SVG)
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) {
    return "tiff";
  }
  return "unknown";
}

function parsePng(bytes: Uint8Array): { width: number; height: number; hasAlpha?: boolean } | null {
  // signature(8) + length(4) + "IHDR"(4) + width(4) + height(4) + depth(1) + colorType(1)
  if (bytes.length < 26) return null;
  const width = readUInt32BE(bytes, 16);
  const height = readUInt32BE(bytes, 20);
  const colorType = bytes[25];
  const hasAlpha = colorType === 4 || colorType === 6;
  return { width, height, hasAlpha };
}

function parseJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2; // skip SOI
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    // Standalone markers without a length field
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS — no frame header found
    const segmentLength = readUInt16BE(bytes, offset + 2);
    if (segmentLength < 2) return null;
    // SOF0..SOF15 excluding DHT(C4), JPG(C8), DAC(CC)
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = readUInt16BE(bytes, offset + 5);
      const width = readUInt16BE(bytes, offset + 7);
      return { width, height };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function parseGif(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  return { width: readUInt16LE(bytes, 6), height: readUInt16LE(bytes, 8) };
}

function parseWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const fourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourCC === "VP8X") {
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (fourCC === "VP8 ") {
    // Lossy bitstream: frame tag (3) + sync code (3) → start code 0x9d012a at offset 23
    if (bytes.length < 30 || bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    return { width: readUInt16LE(bytes, 26) & 0x3fff, height: readUInt16LE(bytes, 28) & 0x3fff };
  }
  if (fourCC === "VP8L") {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { width, height };
  }
  return null;
}

function parseBmp(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  const width = readInt32LE(bytes, 18);
  const height = Math.abs(readInt32LE(bytes, 22));
  return { width, height };
}

/**
 * Parse real image bytes and return format + dimensions.
 * Physical inspection only — returns null when the bytes are not a recognised image
 * or the header is truncated (never guesses).
 */
export function readImageInfo(data: Uint8Array): ImageInfo | null {
  const format = detectImageFormat(data);
  if (format === "unknown") return null;

  let dims: { width: number; height: number; hasAlpha?: boolean } | null = null;
  switch (format) {
    case "png":
      dims = parsePng(data);
      break;
    case "jpeg":
      dims = parseJpeg(data);
      break;
    case "gif":
      dims = parseGif(data);
      break;
    case "webp":
      dims = parseWebp(data);
      break;
    case "bmp":
      dims = parseBmp(data);
      break;
    case "svg":
    case "tiff":
      // Recognised container, dimensions require a full parser — report without them.
      dims = { width: 0, height: 0 };
      break;
    default:
      return null;
  }

  if (!dims) return null;
  // Pixel formats must report real positive dimensions; svg/tiff report 0 (no dimension parser).
  const containerOnly = format === "svg" || format === "tiff";
  if (!containerOnly && (dims.width <= 0 || dims.height <= 0)) return null;

  return {
    format,
    mimeType: MIME_BY_FORMAT[format] ?? "application/octet-stream",
    width: dims.width,
    height: dims.height,
    sizeBytes: data.length,
    ...(dims.hasAlpha !== undefined ? { hasAlpha: dims.hasAlpha } : {}),
  };
}
