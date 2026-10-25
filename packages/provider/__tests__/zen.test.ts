import { describe, it, expect } from "vitest";
import { aiProviderRegistry } from "@soryos/provider";
import {
  ZEN_MODELS,
  ZEN_FREE_MODELS,
  ZEN_PAID_MODELS,
  ZEN_DEFAULT_MODEL,
  isZenModelUsable,
  mergeZenCatalog,
  prettifyModelId,
  fetchZenModels,
  opencodeClientHeaders,
  OPENCODE_USER_AGENT,
} from "@soryos/provider/models-zen";
import { credentialManager, isPublicGatewayKey, PUBLIC_GATEWAY_KEY } from "@soryos/credentials";

describe("catalogue OpenCode Zen", () => {
  it("expose des modèles réels (ids, noms, coûts)", () => {
    expect(ZEN_MODELS.length).toBeGreaterThan(50);
    for (const model of ZEN_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.cost.input).toBeGreaterThanOrEqual(0);
    }
  });

  it("sépare le free tier des modèles payants", () => {
    expect(ZEN_FREE_MODELS.length).toBeGreaterThan(0);
    expect(ZEN_PAID_MODELS.length).toBeGreaterThan(0);
    expect(ZEN_FREE_MODELS.length + ZEN_PAID_MODELS.length).toBe(ZEN_MODELS.length);
    // free ⇔ coût d'entrée nul
    expect(ZEN_FREE_MODELS.every((m) => m.cost.input === 0)).toBe(true);
    expect(ZEN_PAID_MODELS.every((m) => m.cost.input > 0)).toBe(true);
  });

  it("les ids sont uniques", () => {
    const ids = ZEN_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("le modèle par défaut est du free tier (utilisable sans clé)", () => {
    const def = ZEN_MODELS.find((m) => m.id === ZEN_DEFAULT_MODEL);
    expect(def).toBeDefined();
    expect(def!.free).toBe(true);
  });

  it("le provider expose le catalogue Zen", () => {
    const provider = aiProviderRegistry.getRequiredProvider("opencode-zen");
    const models = provider.listModels();
    expect(models.length).toBe(ZEN_MODELS.length);
    expect(provider.getDefaultModel()).toBe(ZEN_DEFAULT_MODEL);
    // L'endpoint est celui de la passerelle d'inférence.
    expect(provider.getEndpoint()).toContain("opencode.ai");
  });
});

describe("catalogue Zen en direct", () => {
  it("fusionne la liste en direct avec le catalogue statique", () => {
    const live = ["big-pickle", "brand-new-model-free"];
    const merged = mergeZenCatalog(live);

    expect(merged.map((m) => m.id)).toEqual(live);
    // Le modèle connu garde ses métadonnées.
    expect(merged[0].name).toBe("Big Pickle");
    // Le modèle inconnu reçoit un nom lisible + le statut free (suffixe -free).
    expect(merged[1].name).toBe("Brand New Model Free");
    expect(merged[1].free).toBe(true);
  });

  it("rend les ids lisibles", () => {
    expect(prettifyModelId("beam-free")).toBe("Beam Free");
    expect(prettifyModelId("mimo-v2.6-flash-free")).toBe("Mimo V2.6 Flash Free");
    expect(prettifyModelId("nemotron-3.5-super-vl-free")).toBe("Nemotron 3.5 Super VL Free");
  });

  it("échoue proprement sans réseau (null → catalogue statique)", async () => {
    const live = await fetchZenModels("http://127.0.0.1:9/inference/v1", 500);
    expect(live).toBeNull();
  });
});

describe("identification client OpenCode", () => {
  it("envoie les en-têtes d'identification attendus par la passerelle", () => {
    const headers = opencodeClientHeaders("cli-123", "prj-456");
    expect(headers["User-Agent"]).toBe(OPENCODE_USER_AGENT);
    expect(headers["User-Agent"]).toMatch(/^opencode\/.+\/.+\/.+$/);
    expect(headers["x-opencode-client"]).toBe("cli");
    expect(headers["x-opencode-session"]).toBe("cli-123");
    expect(headers["x-opencode-session-id"]).toBe("cli-123");
    expect(headers["X-Session-Id"]).toBe("cli-123");
    expect(headers["x-session-affinity"]).toBe("cli-123");
    expect(headers["x-opencode-project"]).toBe("prj-456");
  });

  it("fonctionne sans session ni projet", () => {
    const headers = opencodeClientHeaders();
    expect(headers["x-opencode-session"]).toBe("global");
    expect(headers["x-opencode-session-id"]).toBeUndefined();
    expect(headers["x-opencode-project"]).toBeUndefined();
  });

  it("la clé publique est dans le code (pas de login nécessaire)", () => {
    expect(PUBLIC_GATEWAY_KEY).toBe("public");
    // Le credential manager la renvoie automatiquement quand aucune clé n'est
    // configurée pour opencode-zen.
    const resolved = credentialManager.resolveCredentials("opencode-zen");
    expect(resolved.apiKey).toBe(PUBLIC_GATEWAY_KEY);
  });
});

describe("clé publique / free tier", () => {
  it("reconnaît la clé publique", () => {
    expect(isPublicGatewayKey(PUBLIC_GATEWAY_KEY)).toBe(true);
    expect(isPublicGatewayKey("")).toBe(true);
    expect(isPublicGatewayKey(undefined)).toBe(true);
    expect(isPublicGatewayKey("sk-vraie-cle")).toBe(false);
  });

  it("la clé publique n'ouvre que les modèles gratuits", () => {
    const free = ZEN_FREE_MODELS[0];
    const paid = ZEN_PAID_MODELS[0];
    expect(isZenModelUsable(free.id, PUBLIC_GATEWAY_KEY)).toBe(true);
    expect(isZenModelUsable(paid.id, PUBLIC_GATEWAY_KEY)).toBe(false);
  });

  it("une clé personnelle ouvre tous les modèles", () => {
    const paid = ZEN_PAID_MODELS[0];
    expect(isZenModelUsable(paid.id, "sk-personnelle")).toBe(true);
  });

  it("le credential manager renvoie la clé publique quand aucune clé n'est configurée", () => {
    const resolved = credentialManager.resolveCredentials("opencode-zen");
    expect(resolved.isConfigured).toBe(true);
    expect(resolved.apiKey).toBe(PUBLIC_GATEWAY_KEY);
    expect(resolved.source).toBe("public_default");
  });
});
