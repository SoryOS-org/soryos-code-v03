import { describe, it, expect } from "vitest";
import { aiProviderRegistry, SUPPORTED_AI_MODELS } from "@soryos/provider";
import { searchModels } from "../src/opencode-tools";

describe("catalogue des modèles — source unique", () => {
  it("searchModels renvoie exactement le registre des providers", () => {
    const { models, total } = searchModels(undefined, undefined, { all: true, limit: 1000 });

    const registryCount = aiProviderRegistry
      .getAllProviders()
      .reduce((sum, p) => sum + p.listModels().length, 0);

    expect(total).toBe(registryCount);
    expect(models.length).toBe(registryCount);
  });

  it("chaque provider enregistré expose au moins un modèle", () => {
    const empty = aiProviderRegistry
      .getAllProviders()
      .filter((p) => p.listModels().length === 0)
      .map((p) => String(p.id));

    // Un provider sans modèle ne peut pas être sélectionné dans le picker.
    expect(empty).toEqual([]);
  });

  it("le modèle par défaut de chaque provider est dans le catalogue", () => {
    for (const provider of aiProviderRegistry.getAllProviders()) {
      const models = provider.listModels();
      if (!models.length) continue;
      const defaultModel = provider.getDefaultModel();
      expect(
        models.some((m) => m.id === defaultModel),
        `${provider.id}: default "${defaultModel}" absent du catalogue`,
      ).toBe(true);
    }
  });

  it("filtre par provider et par requête", () => {
    const google = searchModels(undefined, "google", { all: true, limit: 1000 });
    expect(google.total).toBeGreaterThan(0);
    expect(google.models.every((m) => m.provider === "google")).toBe(true);

    // La recherche matche id, nom, provider ET description.
    const filtered = searchModels("gpt-4o", undefined, { all: true, limit: 1000 });
    expect(filtered.total).toBeGreaterThan(0);
    expect(filtered.models.some((m) => m.id.startsWith("gpt-4o"))).toBe(true);
  });

  it("le catalogue SUPPORTED_AI_MODELS est cohérent (ids uniques)", () => {
    const ids = SUPPORTED_AI_MODELS.map((m) => `${m.providerId}/${m.id}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
