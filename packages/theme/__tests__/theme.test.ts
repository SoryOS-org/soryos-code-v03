import { describe, it, expect } from "vitest";
import {
  parseThemeDocument,
  resolveThemeDocument,
  themeModes,
  rgbToOklch,
  oklchToHex,
  RGBA,
  type ThemeDocument,
} from "../src/index.js";

const minimalTheme: ThemeDocument = {
  base: {
    categorical: ["blue"],
    text: { base: "#1a1a2e", muted: "#6b7280" },
    background: { base: "#ffffff" },
    border: { base: "#e5e7eb" },
    scrollbar: { base: "#d1d5db" },
  },
  light: {
    hue: {
      accent: { 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
      interactive: "$hue.accent",
      neutral: { 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db", 400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151", 800: "#1f2937", 900: "#111827" },
      blue: { 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8", 800: "#1e40af", 900: "#1e3a8a" },
    },
  },
};

describe("@soryos/theme", () => {
  it("resolves a minimal theme in light mode", () => {
    const theme = resolveThemeDocument(minimalTheme, "light");
    expect(theme.text.base).toBeInstanceOf(RGBA);
    expect(theme.background.base).toBeInstanceOf(RGBA);
    expect(theme.hue.accent).toBeDefined();
    expect(theme.hue.interactive).toBeDefined();
    expect(theme.hue.neutral).toBeDefined();
  });

  it("resolves a minimal theme in dark mode (falls back to light)", () => {
    const theme = resolveThemeDocument(minimalTheme, "dark");
    expect(theme.text.base).toBeInstanceOf(RGBA);
  });

  it("detects theme modes", () => {
    expect(themeModes(minimalTheme)).toEqual(["light"]);
  });

  it("expands stateful action colors", () => {
    const theme: ThemeDocument = {
      ...minimalTheme,
      light: {
        ...minimalTheme.light!,
        text: {
          base: "#1a1a2e",
          action: { primary: { base: "#3b82f6" } },
        },
      },
    };
    const resolved = resolveThemeDocument(theme, "light");
    const primary = resolved.text.action.primary;
    expect(primary.base).toBeInstanceOf(RGBA);
    expect(primary.hovered).toBeInstanceOf(RGBA);
    expect(primary.state({ hovered: true })).toBe(primary.hovered);
    expect(primary.state({})).toBe(primary.base);
  });

  it("resolves hue aliases", () => {
    const theme = resolveThemeDocument(minimalTheme, "light");
    // interactive is an alias of accent — same scale structure
    expect(theme.hue.interactive[500]).toBeInstanceOf(RGBA);
  });

  it("detects circular hue references", () => {
    const circular: ThemeDocument = {
      ...minimalTheme,
      light: {
        hue: {
          ...minimalTheme.light!.hue,
          accent: "$hue.interactive",
          interactive: "$hue.accent",
        } as any,
      },
    };
    expect(() => resolveThemeDocument(circular, "light")).toThrow(/Circular hue reference/);
  });

  it("parses and validates eagerly", () => {
    const doc = parseThemeDocument(minimalTheme);
    expect(doc.base).toBeDefined();
    expect(() => parseThemeDocument({})).toThrow();
  });

  it("oklch roundtrip stays close", () => {
    const oklch = rgbToOklch(0.2, 0.4, 0.8);
    expect(oklch.l).toBeGreaterThan(0);
    expect(oklch.c).toBeGreaterThan(0);
    const hex = oklchToHex(oklch);
    expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
