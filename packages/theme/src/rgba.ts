/**
 * Minimal RGBA color class — local replacement for @opentui/core's RGBA.
 * Provides fromHex/fromInts/clone plus equality identity for WeakMap indexing.
 */

export class RGBA {
  constructor(
    readonly r: number,
    readonly g: number,
    readonly b: number,
    readonly a: number = 1,
  ) {}

  static fromHex(hex: string): RGBA {
    let h = hex.replace(/^#/, "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length === 4) h = h.split("").map((c) => c + c).join("");
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return new RGBA(r, g, b, a);
  }

  static fromInts(r: number, g: number, b: number, a: number = 255): RGBA {
    return new RGBA(r / 255, g / 255, b / 255, a / 255);
  }

  static clone(color: RGBA): RGBA {
    return new RGBA(color.r, color.g, color.b, color.a);
  }

  toHex(): string {
    const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
    const rgb = `#${to(this.r)}${to(this.g)}${to(this.b)}`;
    return this.a < 1 ? rgb + to(this.a) : rgb;
  }
}
