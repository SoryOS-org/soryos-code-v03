import { afterEach, expect, test } from "bun:test";
import { createSession } from "../../api";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("project creation returns the session identifier", async () => {
  globalThis.fetch = (async () => Response.json({ id: "session-real", title: "Project" })) as typeof fetch;
  expect(await createSession("Project")).toEqual({ id: "session-real", title: "Project" });
});

test("failed project creation preserves the server error", async () => {
  globalThis.fetch = (async () => Response.json({ error: "Workspace unavailable" }, { status: 503 })) as typeof fetch;
  await expect(createSession()).rejects.toThrow("Workspace unavailable");
});

test("missing session identifiers are rejected", async () => {
  globalThis.fetch = (async () => Response.json({ title: "Project" })) as typeof fetch;
  await expect(createSession()).rejects.toThrow("session valide");
});