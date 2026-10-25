import { describe, it, expect } from "vitest";
import {
  drawBox,
  visibleLength,
  truncateVisible,
  boxWidth,
  terminalWidth,
} from "../src/framework/terminal";

describe("visibleLength", () => {
  it("ignores the ANSI codes", () => {
    expect(visibleLength("\x1b[31mred\x1b[0m")).toBe(3);
    expect(visibleLength("plain")).toBe(5);
  });
});

describe("truncateVisible", () => {
  it("cuts to the visible width", () => {
    expect(visibleLength(truncateVisible("abcdefghij", 5))).toBeLessThanOrEqual(6); // 5 + "…"
    expect(truncateVisible("abc", 10)).toBe("abc");
  });

  it("keeps the ANSI codes and closes the colors", () => {
    const out = truncateVisible("\x1b[31mabcdefghij\x1b[0m", 4);
    expect(visibleLength(out)).toBeLessThanOrEqual(5);
    expect(out.startsWith("\x1b[31m")).toBe(true);
    expect(out.endsWith("\x1b[0m")).toBe(true);
  });

  it("returns an empty string for a non-positive width", () => {
    expect(truncateVisible("abc", 0)).toBe("");
  });
});

describe("drawBox", () => {
  it("draws a box where every line has the same width", () => {
    const box = drawBox({
      title: "Select a model",
      lines: [
        "short",
        "\x1b[36ma very long line that would overflow the box without truncation\x1b[0m",
        "medium length line",
      ],
      width: 40,
    });

    const widths = box.map((l) => visibleLength(l));
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(40);
  });

  it("draws the borders", () => {
    const box = drawBox({ title: "T", lines: ["x"], width: 20 });
    expect(box[0].startsWith("╭")).toBe(true);
    expect(box[0].endsWith("╮")).toBe(true);
    expect(box[box.length - 1].startsWith("╰")).toBe(true);
    expect(box[box.length - 1].endsWith("╯")).toBe(true);
  });

  it("never exceeds the requested width, even with a long title", () => {
    const box = drawBox({ title: "a very very very long title indeed", lines: ["x"], width: 30 });
    for (const line of box) {
      expect(visibleLength(line)).toBeLessThanOrEqual(30);
    }
  });
});

describe("boxWidth", () => {
  it("adapts to the terminal and keeps a margin", () => {
    const width = boxWidth();
    expect(width).toBeGreaterThanOrEqual(20);
    expect(width).toBeLessThanOrEqual(terminalWidth());
  });
});
