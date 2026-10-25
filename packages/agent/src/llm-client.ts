import { aiProviderRegistry, type AIProvider } from '@soryos/provider';
import '@soryos/credentials';

export interface LlmClientImage {
  mimeType: string;
  /** Raw base64 (no data: prefix). */
  data: string;
}

export interface LlmClient {
  generate(options: {
    prompt: string;
    systemPrompt?: string;
    model?: string;
    sessionId?: string;
    temperature?: number;
    /** Vision input attached to the user message (multimodal providers). */
    images?: LlmClientImage[];
  }): Promise<{ text: string; error?: string }>;
  streamChat(options: {
    prompt: string;
    systemPrompt?: string;
    model?: string;
    sessionId?: string;
    temperature?: number;
    images?: LlmClientImage[];
  }): AsyncGenerator<{ text: string; error?: string }>;
}

function resolveProviderForModel(model: string): AIProvider {
  const lower = model.toLowerCase();
  if (lower.startsWith('claude')) {
    return aiProviderRegistry.getRequiredProvider('anthropic');
  }
  if (lower.startsWith('gemini')) {
    return aiProviderRegistry.getRequiredProvider('google');
  }
  if (lower.startsWith('gpt') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('chatgpt')) {
    return aiProviderRegistry.getRequiredProvider('openai');
  }
  if (lower.startsWith('mistral') || lower.startsWith('codestral') || lower.startsWith('ministral')) {
    return aiProviderRegistry.getRequiredProvider('mistral');
  }
  if (lower.startsWith('deepseek')) {
    return aiProviderRegistry.getRequiredProvider('deepseek');
  }
  if (lower.startsWith('grok')) {
    return aiProviderRegistry.getRequiredProvider('grok');
  }

  const byModels = aiProviderRegistry
    .getAllProviders()
    .find((p) => p.listModels().some((m) => m.id === model));
  if (byModels) return byModels;

  throw new Error(
    `Modèle inconnu : "${model}". Sélectionnez un modèle supporté dans les paramètres.`
  );
}

class DefaultLlmClient implements LlmClient {
  async generate(options: {
    prompt: string;
    systemPrompt?: string;
    model?: string;
    sessionId?: string;
    temperature?: number;
    images?: LlmClientImage[];
  }): Promise<{ text: string; error?: string }> {
    try {
      const model = options.model || 'claude-3-5-sonnet';
      const provider = resolveProviderForModel(model);
      const result = await provider.generate({
        sessionId: options.sessionId,
        modelId: model,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        messages: [
          {
            role: 'user',
            content: options.prompt,
            ...(options.images && options.images.length > 0 ? { images: options.images } : {}),
          },
        ],
      });
      if (!result.text) {
        return { text: '', error: `${provider.name} a répondu avec un contenu vide.` };
      }
      return { text: result.text };
    } catch (e) {
      return { text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }

  async *streamChat(options: {
    prompt: string;
    systemPrompt?: string;
    model?: string;
    sessionId?: string;
    temperature?: number;
    images?: LlmClientImage[];
  }): AsyncGenerator<{ text: string; error?: string }> {
    try {
      const model = options.model || 'claude-3-5-sonnet';
      const provider = resolveProviderForModel(model);
      const stream = provider.stream({
        sessionId: options.sessionId,
        modelId: model,
        systemPrompt: options.systemPrompt,
        temperature: options.temperature,
        messages: [
          {
            role: 'user',
            content: options.prompt,
            ...(options.images && options.images.length > 0 ? { images: options.images } : {}),
          },
        ],
      });
      for await (const chunk of stream) {
        if (chunk.delta) {
          yield { text: chunk.delta };
        }
      }
    } catch (e) {
      yield { text: '', error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export const llmClient = new DefaultLlmClient();
