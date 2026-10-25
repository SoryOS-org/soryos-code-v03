import { aiProviderRegistry } from '@soryos/provider';

export interface PingResult {
  success: boolean;
  message: string;
}

async function probe(url: string, headers: Record<string, string> = {}): Promise<{ status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    return { status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 0, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function pingProvider(
  apiKey: string,
  providerId: string = 'anthropic',
  sessionId?: string
): Promise<PingResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: 'API key is missing.' };
  }

  const provider = aiProviderRegistry.getProvider(providerId);
  if (!provider) {
    return { success: false, message: `Unknown provider: ${providerId}` };
  }

  const key = apiKey.trim();
  let result: { status: number; error?: string };

  if (providerId === 'anthropic') {
    result = await probe('https://api.anthropic.com/v1/models', {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    });
  } else if (providerId === 'google') {
    result = await probe(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`
    );
  } else {
    const endpoint = provider.getEndpoint().replace(/\/$/, '');
    result = await probe(`${endpoint}/models`, { Authorization: `Bearer ${key}` });
  }

  if (result.status === 0) {
    return { success: false, message: `Network error while contacting ${provider.name}: ${result.error}` };
  }
  if (result.status === 200) {
    return { success: true, message: `Connection established with ${provider.name} (${providerId}${sessionId ? `, session ${sessionId}` : ''}).` };
  }
  if (result.status === 401 || result.status === 403) {
    return { success: false, message: `Authentication failed for ${provider.name} (HTTP ${result.status}): the API key was rejected.` };
  }
  return { success: false, message: `${provider.name} responded with HTTP ${result.status}.` };
}
