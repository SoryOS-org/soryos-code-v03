import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateChatImages, MAX_IMAGE_ATTACHMENT_BYTES } from "@soryos/schema";
import { aiProviderRegistry, setCredentialResolver } from "@soryos/provider";
import { llmClient } from "@soryos/agent";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const IMAGE = { mimeType: "image/png" as const, data: PNG_1PX };

describe("validateChatImages — frontière de validation", () => {
  it("accepte 1 à 4 images valides", () => {
    expect(validateChatImages([IMAGE])).toBeNull();
    expect(validateChatImages([IMAGE, IMAGE, IMAGE, IMAGE])).toBeNull();
  });

  it("rejette : pas un tableau, > 4, type mime inconnu, data vide, base64 invalide, taille", () => {
    expect(validateChatImages("nope")).toMatch(/must be an array/);
    expect(validateChatImages([IMAGE, IMAGE, IMAGE, IMAGE, IMAGE])).toMatch(/At most 4/);
    expect(validateChatImages([{ mimeType: "image/bmp", data: PNG_1PX }])).toMatch(/Unsupported image mimeType/);
    expect(validateChatImages([{ mimeType: "image/png", data: "" }])).toMatch(/non-empty base64/);
    expect(validateChatImages([{ mimeType: "image/png", data: "!!!not-base64!!!" }])).toMatch(/not valid base64/);
    expect(
      validateChatImages([{ mimeType: "image/png", data: "A".repeat(MAX_IMAGE_ATTACHMENT_BYTES + 1) }])
    ).toMatch(/too large/);
  });
});

describe("LlmClient.generate — images threadées vers le provider (fetch mocké)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "");
    setCredentialResolver((id) =>
      id === "openai" ? { apiKey: "test-key", source: "environment_variable" as const } : undefined
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: "je vois l'image" } }] }), {
        status: 200,
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setCredentialResolver(() => undefined);
  });

  it("prompt + images → messages provider contiennent image_url", async () => {
    const result = await llmClient.generate({
      prompt: "Décris cette image",
      model: "gpt-4o-mini",
      images: [IMAGE],
    });

    expect(result.error).toBeUndefined();
    expect(result.text).toBe("je vois l'image");

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const content = body.messages[body.messages.length - 1].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content.some((p: any) => p.type === "image_url" && p.image_url.url.includes("data:image/png;base64,"))).toBe(
      true
    );
  });

  it("sans images, content reste une string", async () => {
    const result = await llmClient.generate({ prompt: "texte seul", model: "gpt-4o-mini" });
    expect(result.error).toBeUndefined();
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const last = body.messages[body.messages.length - 1];
    expect(last.content).toBe("texte seul");
  });
});
