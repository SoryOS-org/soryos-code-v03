import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readPersistedCredentials,
  writePersistedCredentials,
  removePersistedCredentials,
  projectCredentialFile,
} from "../src/store";

let dir: string;
let realHome: string | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "soryos-cred-"));
  // Isolation : le store GLOBAL (~/.soryos) est redirigé vers le répertoire
  // temporaire, sinon l'état réel de la machine pollue les tests.
  realHome = process.env.HOME;
  process.env.HOME = dir;
});

afterEach(async () => {
  if (realHome === undefined) delete process.env.HOME;
  else process.env.HOME = realHome;
  await rm(dir, { recursive: true, force: true });
});

describe("credential store (disk)", () => {
  it("writes and reads a provider credential", async () => {
    await writePersistedCredentials("google", { apiKey: "key-123" }, "project", dir);
    const data = await readPersistedCredentials(dir);
    expect(data.google?.apiKey).toBe("key-123");
  });

  it("writes the file with 0600 (secrets)", async () => {
    await writePersistedCredentials("openai", { apiKey: "sk-secret" }, "project", dir);
    const file = projectCredentialFile(dir);
    const stats = await stat(file);
    // Le fichier contient des secrets : permissions restrictives.
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it("ignores non-string values", async () => {
    await writePersistedCredentials("google", { apiKey: "k" }, "project", dir);
    const file = projectCredentialFile(dir);
    const raw = JSON.parse(await readFile(file, "utf8"));
    expect(raw.google.apiKey).toBe("k");
    const data = await readPersistedCredentials(dir);
    expect(Object.keys(data)).toEqual(["google"]);
  });

  it("removes a provider credential", async () => {
    await writePersistedCredentials("google", { apiKey: "k" }, "project", dir);
    const removed = await removePersistedCredentials("google", "project", dir);
    expect(removed).toBe(true);
    const data = await readPersistedCredentials(dir);
    expect(data.google).toBeUndefined();
  });

  it("removes the file when the last provider is deleted", async () => {
    await writePersistedCredentials("google", { apiKey: "k" }, "project", dir);
    await removePersistedCredentials("google", "project", dir);
    const stats = await stat(projectCredentialFile(dir)).catch(() => null);
    expect(stats).toBeNull();
  });

  it("returns false when removing an unknown provider", async () => {
    const removed = await removePersistedCredentials("nope", "project", dir);
    expect(removed).toBe(false);
  });

  it("returns an empty map for a missing file", async () => {
    const data = await readPersistedCredentials(dir);
    expect(data).toEqual({});
  });

  it("keeps the other providers when one is written", async () => {
    await writePersistedCredentials("google", { apiKey: "g" }, "project", dir);
    await writePersistedCredentials("openai", { apiKey: "o" }, "project", dir);
    const data = await readPersistedCredentials(dir);
    expect(data.google?.apiKey).toBe("g");
    expect(data.openai?.apiKey).toBe("o");
  });
});
