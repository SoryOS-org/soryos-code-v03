import { describe, it, expect, vi } from "vitest";
import { pick, type PickerOption } from "../src/framework/terminal";
import type { TerminalInput, TerminalKey } from "../src/framework/input";

/**
 * Faux TerminalInput : on capture le handler empilé par `pick()` pour
 * simuler les touches (Entrée, flèches, souris…).
 */
function fakeInput() {
  const handlers: Array<(key: TerminalKey) => void> = [];
  const input = {
    push(handler: (key: TerminalKey) => void) {
      handlers.push(handler);
      return () => {
        const i = handlers.indexOf(handler);
        if (i >= 0) handlers.splice(i, 1);
      };
    },
    enableMouse: vi.fn(),
    disableMouse: vi.fn(),
    queryCursorPosition: vi.fn(async () => ({ row: 10, col: 1 })),
    depth: handlers.length,
  } as unknown as TerminalInput;

  const press = (key: TerminalKey) => handlers[handlers.length - 1]?.(key);
  return { input, press };
}

const OPTIONS: PickerOption<string>[] = [
  { value: "a", title: "Alpha", description: "first", category: "Cat" },
  { value: "b", title: "Bravo", description: "second", category: "Cat" },
  { value: "c", title: "Charlie", description: "third", category: "Other" },
];

describe("pick", () => {
  it("resolves with the selected value on Enter", async () => {
    const { input, press } = fakeInput();
    const promise = pick<string>({ title: "Test", options: OPTIONS }, input);

    // Laisse le picker s'installer.
    await new Promise((r) => setTimeout(r, 10));
    press({ name: "down", sequence: "" });
    press({ name: "return", sequence: "\r" });

    await expect(promise).resolves.toBe("b");
  });

  it("resolves with null when cancelled (Escape)", async () => {
    const { input, press } = fakeInput();
    const promise = pick<string>({ title: "Test", options: OPTIONS }, input);

    await new Promise((r) => setTimeout(r, 10));
    press({ name: "escape", sequence: "\x1b" });

    await expect(promise).resolves.toBeNull();
  });

  it("filters with the search field and selects the match", async () => {
    const { input, press } = fakeInput();
    const promise = pick<string>({ title: "Test", options: OPTIONS }, input);

    await new Promise((r) => setTimeout(r, 10));
    for (const ch of "charlie") press({ name: ch, sequence: ch });
    press({ name: "return", sequence: "\r" });

    await expect(promise).resolves.toBe("c");
  });

  it("selects with a mouse click (press + release on the same line)", async () => {
    const { input, press } = fakeInput();
    const promise = pick<string>({ title: "Test", options: OPTIONS }, input);

    await new Promise((r) => setTimeout(r, 10));
    // La baseRow de test est 10 : bordure(10) + recherche(11) + groupe(12)
    // → la 1ʳᵉ option est en 13, la 2ᵉ en 14.
    press({ name: undefined, sequence: "\x1b[<0;5;14M" });
    press({ name: undefined, sequence: "\x1b[<0;5;14m" });

    await expect(promise).resolves.toBe("b");
  });

  it("never leaves the promise uninitialised (TDZ regression)", async () => {
    const { input } = fakeInput();
    // Le bug : l'exécuteur de la Promise accédait à `promise` avant son
    // initialisation → ReferenceError, la promesse était rejetée aussitôt.
    const promise = pick<string>({ title: "Test", options: OPTIONS }, input);
    const outcome = await Promise.race([
      promise.then(() => "resolved", () => "rejected"),
      new Promise((r) => setTimeout(() => r("pending"), 60)),
    ]);
    expect(outcome).toBe("pending");
  });
});
