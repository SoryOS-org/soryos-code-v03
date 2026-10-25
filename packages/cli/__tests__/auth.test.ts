import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentialManager, PROVIDER_REGISTRY } from "@soryos/credentials";
import {
  resolveProviderContext,
  defaultModelFor,
  providerOwnsModel,
  aiProviderIds,
} from "../src/framework/auth";

let dir: string;
let realHome: string | undefined;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "soryos-auth-"));
  // Isolation : le fichier GLOBAL des identifiants est redirigé vers le
  // répertoire temporaire (sinon l'état réel de la machine pollue les tests).
  realHome = process.env.HOME;
  process.env.HOME = dir;
  // Store mémoire du credentialManager : on repart d'un état propre.
  for (const id of Object.keys(PROVIDER_REGISTRY)) {
    credentialManager.deleteCredentials(id);
  }
});

afterEach(async () => {
  if (realHome === undefined) delete process.env.HOME;
  else process.env.HOME = realHome;
  for (const id of Object.keys(PROVIDER_REGISTRY)) {
    credentialManager.deleteCredentials(id);
  }
  await rm(dir, { recursive: true, force: true });
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("defaultModelFor", () => {
  it("returns the real default model of a provider", () => {
    expect(defaultModelFor("openai")).toBeTruthy();
    expect(defaultModelFor("google")).toBeTruthy();
  });

  it("falls back for an unknown provider", () => {
    expect(defaultModelFor("nope-unknown")).toBeTruthy();
  });
});

describe("providerOwnsModel", () => {
  it("knows which models belong to a provider", () => {
    const googleModel = defaultModelFor("google");
    const openaiModel = defaultModelFor("openai");
    expect(providerOwnsModel("google", googleModel)).toBe(true);
    // Un modèle d'un provider n'appartient pas à l'autre.
    expect(providerOwnsModel("openai", googleModel)).toBe(false);
    expect(providerOwnsModel("openai", openaiModel)).toBe(true);
  });
});

describe("resolveProviderContext", () => {
  it("reports the active provider without a key (honest failure, no silent fallback)", async () => {
    // provider actif = openai, mais aucune clé → on ne bascule PAS sur google.
    process.env.GEMINI_API_KEY = "google-key";
    await credentialManager.saveCredentials("openai", {});
    const { setActiveProvider } = await import("../src/framework/provider-state");
    await setActiveProvider("openai", "project", dir);

    const context = await resolveProviderContext({ cwd: dir });
    expect(context.providerId).toBe("openai");
    expect(context.apiKey).toBeNull();
    expect(context.activeWithoutKey).toBe(true);
  });

  it("uses the key of the active provider when it has one", async () => {
    process.env.GEMINI_API_KEY = "google-key";
    credentialManager.saveCredentials("openai", { apiKey: "openai-key" });
    const { setActiveProvider } = await import("../src/framework/provider-state");
    await setActiveProvider("openai", "project", dir);

    const context = await resolveProviderContext({ cwd: dir });
    expect(context.providerId).toBe("openai");
    expect(context.apiKey).toBe("openai-key");
    expect(context.activeWithoutKey).toBe(false);
  });

  it("falls back to the first configured provider when none is active", async () => {
    process.env.GEMINI_API_KEY = "google-key";
    const context = await resolveProviderContext();
    expect(context.providerId).toBe("google");
    expect(context.apiKey).toBe("google-key");
  });

  it("exposes a default model that belongs to the provider", async () => {
    process.env.GEMINI_API_KEY = "google-key";
    const context = await resolveProviderContext();
    expect(providerOwnsModel(context.providerId, context.defaultModel)).toBe(true);
  });
});

describe("aiProviderIds", () => {
  it("lists the AI providers", () => {
    const ids = aiProviderIds();
    expect(ids).toContain("google");
    expect(ids).toContain("openai");
    expect(ids).not.toContain("e2b"); // sandbox, pas un provider IA
  });
});
