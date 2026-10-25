import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiProviderRegistry,
  setCredentialResolver,
  buildGoogleContents,
  buildOpenAIMessages,
  buildAnthropicMessages,
} from "@soryos/provider";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const IMAGE = { mimeType: "image/png", data: PNG_1PX };

describe("Multimodal message mapping (purs)", () => {
  it("buildGoogleContents : text seul + inlineData pour les images", () => {
    const contents = buildGoogleContents([
      { role: "user", content: "voir ceci", images: [IMAGE] },
      { role: "assistant", content: "ok" },
    ]);
    expect(contents[0]!.role).toBe("user");
    expect(contents[0]!.parts[0]).toEqual({ text: "voir ceci" });
    expect(contents[0]!.parts[1]).toEqual({
      inlineData: { mimeType: "image/png", data: PNG_1PX },
    });
    expect(contents[1]!.role).toBe("model");
    expect(contents[1]!.parts).toEqual([{ text: "ok" }]);
  });

  it("buildOpenAIMessages : string sans image, array avec image_url data URI", () => {
    const wire = buildOpenAIMessages([
      { role: "user", content: "plain" },
      { role: "user", content: "avec image", images: [IMAGE] },
    ]);
    expect(wire[0]).toEqual({ role: "user", content: "plain" });
    const parts = wire[1]!.content as Array<Record<string, unknown>>;
    expect(parts[0]).toEqual({ type: "text", text: "avec image" });
    expect(parts[1]).toEqual({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${PNG_1PX}` },
    });
  });

  it("buildAnthropicMessages : string sans image, blocks image base64", () => {
    const wire = buildAnthropicMessages([{ role: "user", content: "analyse", images: [IMAGE] }]);
    const parts = wire[0]!.content as Array<Record<string, unknown>>;
    expect(parts[0]).toEqual({ type: "text", text: "analyse" });
    expect(parts[1]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: PNG_1PX },
    });
  });
});

describe("OpenAI generate — image_url sur le wire (fetch mocké)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "");
    setCredentialResolver((id) => (id === "openai" ? { apiKey: "test-key", source: "environment_variable" as const } : undefined));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setCredentialResolver(() => undefined);
  });

  it("les images deviennent des parts image_url data URI dans le body", async () => {
    const openai = aiProviderRegistry.getRequiredProvider("openai");
    await openai.generate({
      modelId: "gpt-4o-mini",
      messages: [{ role: "user", content: "describe", images: [IMAGE] }],
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const content = body.messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[1].type).toBe("image_url");
    expect(content[1].image_url.url).toBe(`data:image/png;base64,${PNG_1PX}`);
  });

  it("sans image, content reste une string (non régression)", async () => {
    const openai = aiProviderRegistry.getRequiredProvider("openai");
    await openai.generate({
      modelId: "gpt-4o-mini",
      messages: [{ role: "user", content: "plain text" }],
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.messages[0].content).toBe("plain text");
  });
});

describe("Anthropic generate — blocks image base64 sur le wire (fetch mocké)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    setCredentialResolver((id) => (id === "anthropic" ? { apiKey: "test-key", source: "environment_variable" as const } : undefined));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }], usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setCredentialResolver(() => undefined);
  });

  it("les images deviennent des blocks image base64", async () => {
    const anthropic = aiProviderRegistry.getRequiredProvider("anthropic");
    await anthropic.generate({
      modelId: "claude-3-5-sonnet",
      messages: [{ role: "user", content: "look", images: [IMAGE] }],
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const content = body.messages[0].content;
    expect(content[1]).toEqual({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: PNG_1PX },
    });
  });
});
