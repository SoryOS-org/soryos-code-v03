import { describe, it, expect } from "vitest";
import { decodeKey, parseMouseEvent } from "../src/framework/input";

describe("decodeKey — caractères", () => {
  it("decodes a printable character", () => {
    const decoded = decodeKey("a");
    expect(decoded?.key.name).toBe("a");
    expect(decoded?.length).toBe(1);
  });

  it("decodes Enter", () => {
    expect(decodeKey("\r")?.key.name).toBe("return");
    expect(decodeKey("\n")?.key.name).toBe("return");
  });

  it("decodes Backspace", () => {
    expect(decodeKey("\x7f")?.key.name).toBe("backspace");
    expect(decodeKey("\b")?.key.name).toBe("backspace");
  });

  it("decodes Ctrl+C and Ctrl+D", () => {
    expect(decodeKey("\x03")?.key).toMatchObject({ name: "c", ctrl: true });
    expect(decodeKey("\x04")?.key).toMatchObject({ name: "d", ctrl: true });
  });
});

describe("decodeKey — séquences de navigation", () => {
  it("decodes the arrow keys", () => {
    expect(decodeKey("\x1b[A")?.key.name).toBe("up");
    expect(decodeKey("\x1b[B")?.key.name).toBe("down");
    expect(decodeKey("\x1b[C")?.key.name).toBe("right");
    expect(decodeKey("\x1b[D")?.key.name).toBe("left");
  });

  it("decodes Home/End/Delete", () => {
    expect(decodeKey("\x1b[H")?.key.name).toBe("home");
    expect(decodeKey("\x1b[F")?.key.name).toBe("end");
    expect(decodeKey("\x1b[3~")?.key.name).toBe("delete");
  });

  it("decodes a lone Escape", () => {
    expect(decodeKey("\x1b")?.key.name).toBe("escape");
  });

  it("waits for the rest of an incomplete sequence", () => {
    expect(decodeKey("\x1b[")).toBeNull();
    expect(decodeKey("\x1b[3")).toBeNull();
  });
});

describe("decodeKey — souris / tactile", () => {
  it("keeps the SGR mouse sequence intact (readline la détruisait)", () => {
    const decoded = decodeKey("\x1b[<0;10;8M");
    expect(decoded?.key.sequence).toBe("\x1b[<0;10;8M");
    expect(decoded?.length).toBe(10);
  });

  it("consumes only the mouse sequence, not the following text", () => {
    const decoded = decodeKey("\x1b[<0;10;8Mabc");
    expect(decoded?.length).toBe(10);
  });

  it("parses a press event", () => {
    const mouse = parseMouseEvent("\x1b[<0;10;8M");
    expect(mouse).toEqual({ type: "press", button: 0, col: 10, row: 8 });
  });

  it("parses a release event", () => {
    const mouse = parseMouseEvent("\x1b[<0;10;8m");
    expect(mouse).toEqual({ type: "release", button: 0, col: 10, row: 8 });
  });

  it("parses the wheel (button 64)", () => {
    const mouse = parseMouseEvent("\x1b[<64;10;8M");
    expect(mouse?.type).toBe("wheel");
    expect(mouse?.button).toBe(0);
  });

  it("returns null for a non-mouse sequence", () => {
    expect(parseMouseEvent("\x1b[A")).toBeNull();
    expect(parseMouseEvent("hello")).toBeNull();
  });
});
