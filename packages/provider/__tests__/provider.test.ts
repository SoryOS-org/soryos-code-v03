import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiProviderRegistry, setCredentialResolver } from "@soryos/provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI Provider — clés UI, probes réseau, erreurs honnêtes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MISTRAL_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    setCredentialResolver(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setCredentialResolver(() => undefined);
  });

  it("registry : providers et mapping modèles", () => {
    expect(aiProviderRegistry.getAllProviders().length).toBeGreaterThanOrEqual(9);
    expect(aiProviderRegistry.getProviderForModel("gemini-3.8-flash").id).toBe("google");
    expect(() => aiProviderRegistry.getRequiredProvider("pas-un-provider")).toThrow(/non reconnu/);
  });

  it("resolveApiKey : priorité à la clé sauvegardée dans l'UI (credential store)", () => {
    setCredentialResolver((providerId) =>
      providerId === "mistral" ? { apiKey: "ui-key-123", source: "project_store" } : undefined
    );
    expect(aiProviderRegistry.resolveApiKey("mistral")).toBe("ui-key-123");
    expect(aiProviderRegistry.resolveApiKey("openai")).toBe("");
  });

  it("testConnection sans clé : not_configured, aucun appel réseau", async () => {
    const mistral = aiProviderRegistry.getRequiredProvider("mistral");
    const res = await mistral.testConnection();
    expect(res.success).toBe(false);
    expect(res.diagnostics.finalResult).toBe("not_configured");
    expect(res.diagnostics.credentialStatus).toBe("missing");
    expect(res.message).toMatch(/Clé API manquante/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("testConnection avec clé UI + probe HTTP 200 : connected, clé transmise", async () => {
    setCredentialResolver(() => ({ apiKey: "ui-key-123", source: "project_store" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 200));
    const mistral = aiProviderRegistry.getRequiredProvider("mistral");
    const res = await mistral.testConnection();
    expect(res.success).toBe(true);
    expect(res.status).toBe("connected");
    expect(res.diagnostics.finalResult).toBe("connected");
    expect(res.diagnostics.credentialSource).toBe("project_store");
    expect(res.message).toMatch(/Connecté à/);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/models$/);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer ui-key-123" });
  });

  it("testConnection HTTP 401 : auth_failed honnête", async () => {
    setCredentialResolver(() => ({ apiKey: "cle-revoquee" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
    const res = await aiProviderRegistry.getRequiredProvider("mistral").testConnection();
    expect(res.success).toBe(false);
    expect(res.diagnostics.finalResult).toBe("auth_failed");
    expect(res.diagnostics.authStatus).toBe("failed");
    expect(res.message).toMatch(/Authentification refusée/);
  });

  it("testConnection réseau coupé : network_error, pas de faux succès", async () => {
    setCredentialResolver(() => ({ apiKey: "ui-key-123" }));
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const res = await aiProviderRegistry.getRequiredProvider("mistral").testConnection();
    expect(res.success).toBe(false);
    expect(res.diagnostics.finalResult).toBe("network_error");
    expect(res.diagnostics.networkStatus).toBe("failed");
    expect(res.message).toMatch(/Erreur réseau/);
  });

  it("generate : envoie systemPrompt, clé UI et parse la réponse OpenAI-compatible", async () => {
    setCredentialResolver(() => ({ apiKey: "ui-key-123", source: "project_store" }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: "Bonjour" } }],
        usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
      })
    );
    const mistral = aiProviderRegistry.getRequiredProvider("mistral");
    const result = await mistral.generate({
      messages: [{ role: "user", content: "salut" }],
      systemPrompt: "Tu es un agent de développement.",
    });
    expect(result.text).toBe("Bonjour");
    expect(result.usage?.promptTokens).toBe(10);
    expect(result.usage?.totalTokens).toBe(12);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/chat\/completions$/);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer ui-key-123" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "Tu es un agent de développement." });
    expect(body.messages[1]).toEqual({ role: "user", content: "salut" });
    expect(typeof body.model).toBe("string");
  });

  it("generate : erreur HTTP 500 propagée exactement (aucun texte fake)", async () => {
    setCredentialResolver(() => ({ apiKey: "ui-key-123" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    await expect(
      aiProviderRegistry.getRequiredProvider("mistral").generate({
        messages: [{ role: "user", content: "salut" }],
      })
    ).rejects.toThrow(/HTTP 500/);
  });

  it("generate sans clé : throw explicite, aucun appel réseau", async () => {
    await expect(
      aiProviderRegistry.getRequiredProvider("mistral").generate({
        messages: [{ role: "user", content: "salut" }],
      })
    ).rejects.toThrow(/Clé API manquante/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("testAI : échec d'authentification → success=false, error explicite (pas de « OK » fake)", async () => {
    setCredentialResolver(() => ({ apiKey: "cle-invalide" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 401));
    const ai = await aiProviderRegistry.getRequiredProvider("mistral").testAI();
    expect(ai.success).toBe(false);
    expect(ai.response).toBe("");
    expect(ai.error).toMatch(/Authentification refusée/);
  });

  it("testAI : probe 200 + génération réelle → success=true avec la vraie réponse", async () => {
    setCredentialResolver(() => ({ apiKey: "ui-key-123" }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "OK" } }] }));
    const ai = await aiProviderRegistry.getRequiredProvider("mistral").testAI();
    expect(ai.success).toBe(true);
    expect(ai.response).toBe("OK");
    expect(ai.error).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
