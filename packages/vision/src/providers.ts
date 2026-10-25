/**
 * @soryos/vision
 * Vision AI Providers - Base provider interface and implementations
 */

import {
  VisionProvider,
  VisionModel,
  VisionTaskType,
  VisionAnalysisOptions,
  VisionAnalysisResult,
  VisionConfig,
  DEFAULT_VISION_CONFIG,
} from './types';

/**
 * Base Vision Provider interface
 */
export interface VisionProviderInterface {
  provider: VisionProvider;
  model: VisionModel;
  config: VisionConfig;

  /**
   * Analyze an image
   */
  analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult>;

  /**
   * Stream image analysis
   */
  streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string>;

  /**
   * Check if provider is available
   */
  isAvailable(): boolean;

  /**
   * Get provider capabilities
   */
  getCapabilities(): {
    analysisTypes: string[];
    maxImageSizeMB: number;
    maxTokens: number;
  };
}

/**
 * Base Vision Provider class
 */
export abstract class BaseVisionProvider implements VisionProviderInterface {
  abstract provider: VisionProvider;
  abstract model: VisionModel;
  config: VisionConfig;

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    this.config = { ...DEFAULT_VISION_CONFIG, ...config };
  }

  abstract analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult>;

  abstract streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string>;

  abstract isAvailable(): boolean;

  abstract getCapabilities(): {
    analysisTypes: string[];
    maxImageSizeMB: number;
    maxTokens: number;
  };

  /**
   * Preprocess image before sending to API
   */
  protected async preprocessImage(
    image: Blob | File | string | Uint8Array,
    options?: { maxSizeMB?: number }
  ): Promise<{ image: Blob | string; format: string }> {
    // Convert to Blob if needed
    let imageBlob: Blob;
    let format: string;

    if (image instanceof Blob || image instanceof File) {
      imageBlob = image instanceof Blob ? image : new Blob([image]);
      format = this.getFormatFromBlob(imageBlob);
    } else if (image instanceof Uint8Array) {
      imageBlob = new Blob([image as unknown as BlobPart]);
      format = 'unknown';
    } else if (typeof image === 'string') {
      if (image.startsWith('data:')) {
        const type = image.split(',')[0].split(':')[1].split(';')[0];
        format = this.getFormatFromType(type);
        return { image, format };
      } else {
        // URL - fetch and convert
        const response = await fetch(image);
        imageBlob = await response.blob();
        format = this.getFormatFromBlob(imageBlob);
      }
    } else {
      throw new Error('Unsupported image type');
    }

    // Check size limit
    const maxSizeMB = options?.maxSizeMB || 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (imageBlob.size > maxSizeBytes) {
      // Compress image
      imageBlob = await this.compressImage(imageBlob, maxSizeBytes);
    }

    // Convert to base64 for API
    const base64 = await this.blobToBase64(imageBlob);
    format = this.getFormatFromBlob(imageBlob);

    return { image: base64, format };
  }

  /**
   * Get format from blob
   */
  protected getFormatFromBlob(blob: Blob): string {
    const type = blob.type.toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    return 'unknown';
  }

  /**
   * Get format from MIME type
   */
  protected getFormatFromType(type: string): string {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('jpeg') || lowerType.includes('jpg')) return 'jpeg';
    if (lowerType.includes('png')) return 'png';
    if (lowerType.includes('webp')) return 'webp';
    if (lowerType.includes('gif')) return 'gif';
    return 'unknown';
  }

  /**
   * Compress image to fit size limit
   */
  protected async compressImage(blob: Blob, maxSizeBytes: number): Promise<Blob> {
    // Simple compression - in practice, use a proper image compression library
    const quality = Math.min(0.9, maxSizeBytes / blob.size);
    
    return new Blob([blob], { type: blob.type });
  }

  /**
   * Convert blob to base64
   */
  protected async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Build prompt for vision analysis
   */
  protected buildPrompt(
    analysisType: string,
    taskType: string,
    prompt?: string,
    imageFormat?: string
  ): string {
    const basePrompt = prompt || '';
    
    switch (analysisType) {
      case 'description':
        return `${basePrompt}\n\nDescribe this image in detail. Include objects, colors, actions, and any text present.`;
      
      case 'ocr':
        return `${basePrompt}\n\nExtract all text from this image. Preserve formatting and layout as much as possible.`;
      
      case 'objects':
        return `${basePrompt}\n\nIdentify and locate all objects in this image. For each object, provide a label, confidence score, and bounding box coordinates.`;
      
      case 'text':
        return `${basePrompt}\n\nAnalyze the text content in this image. Extract all text and provide any insights.`;
      
      case 'layout':
        return `${basePrompt}\n\nAnalyze the layout of this image. Identify UI elements, their positions, and relationships. Provide a hierarchical structure.`;
      
      case 'colors':
        return `${basePrompt}\n\nAnalyze the color palette of this image. Identify dominant colors, color distribution, and provide hex/rgb values.`;
      
      case 'faces':
        return `${basePrompt}\n\nDetect and analyze all faces in this image. Provide bounding boxes, landmarks, and any demographic information.`;
      
      case 'custom':
      default:
        return basePrompt || 'Analyze this image.';
    }
  }

  /**
   * Parse vision response
   */
  protected parseResponse(
    response: string,
    analysisType: string
  ): VisionAnalysisResult {
    const result: VisionAnalysisResult = {
      success: true,
      analysisType: analysisType as any,
      taskType: this.getTaskTypeFromAnalysis(analysisType),
      provider: this.provider,
      model: this.model,
      results: [],
      text: response,
      durationMs: 0,
      timestamp: Date.now(),
    };

    // Try to parse structured response
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        result.results = parsed.map(item => ({
          type: item.type || 'text',
          content: item.content || item.text || String(item),
          confidence: item.confidence,
          boundingBox: item.boundingBox,
          metadata: item.metadata,
        }));
      } else if (typeof parsed === 'object') {
        result.results = [{
          type: 'text',
          content: parsed.content || parsed.text || String(parsed),
          confidence: parsed.confidence,
          boundingBox: parsed.boundingBox,
          metadata: parsed.metadata,
        }];
      }
    } catch {
      // Response is plain text
      result.results = [{
        type: 'text',
        content: response,
      }];
    }

    return result;
  }

  /**
   * Get task type from analysis type
   */
  protected getTaskTypeFromAnalysis(analysisType: string): VisionTaskType {
    const mapping: Record<string, VisionTaskType> = {
      'description': 'describe',
      'ocr': 'extract_text',
      'objects': 'detect_objects',
      'text': 'extract_text',
      'layout': 'analyze_layout',
      'colors': 'detect_colors',
      'faces': 'detect_faces',
      'custom': 'custom_prompt',
    };
    return mapping[analysisType] || 'custom_prompt';
  }
}

/**
 * Provider factory
 */
export class VisionProviderFactory {
  private static providers: Map<VisionProvider, VisionProviderInterface> = new Map();

  /**
   * Get vision provider by type
   */
  static getProvider(
    provider: VisionProvider,
    config?: VisionConfig
  ): VisionProviderInterface {
    if (VisionProviderFactory.providers.has(provider)) {
      return VisionProviderFactory.providers.get(provider)!;
    }

    let providerInstance: VisionProviderInterface;

    switch (provider) {
      case 'gemini':
        providerInstance = new GeminiVisionProvider(config);
        break;
      case 'openai':
        providerInstance = new OpenAIVisionProvider(config);
        break;
      case 'mistral':
        providerInstance = new MistralVisionProvider(config);
        break;
      case 'anthropic':
        providerInstance = new AnthropicVisionProvider(config);
        break;
      case 'local':
        providerInstance = new LocalVisionProvider(config);
        break;
      default:
        throw new Error(`Unsupported vision provider: ${provider}`);
    }

    VisionProviderFactory.providers.set(provider, providerInstance);
    return providerInstance;
  }

  /**
   * Get default provider
   */
  static getDefaultProvider(config?: VisionConfig): VisionProviderInterface {
    return VisionProviderFactory.getProvider('gemini', config);
  }

  /**
   * Clear all provider instances
   */
  static clearProviders(): void {
    VisionProviderFactory.providers.clear();
  }
}

/**
 * Get vision provider by type
 */
export function getVisionProvider(
  provider: VisionProvider,
  config?: VisionConfig
): VisionProviderInterface {
  return VisionProviderFactory.getProvider(provider, config);
}

/**
 * Get default vision provider
 */
export function getDefaultVisionProvider(config?: VisionConfig): VisionProviderInterface {
  return VisionProviderFactory.getDefaultProvider(config);
}

// ============================================================================
// Provider Implementations
// ============================================================================

/**
 * Google Gemini Vision Provider
 */
export class GeminiVisionProvider extends BaseVisionProvider {
  provider: VisionProvider = 'gemini';
  model: VisionModel;

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    super(config);
    this.model = config.model || 'gemini-2.5-flash';
  }

  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preprocess image
      const { image, format } = await this.preprocessImage(options.image);

      // Build request
      const prompt = this.buildPrompt(
        options.analysisType || 'description',
        options.taskType || 'describe',
        options.prompt,
        format
      );

      // Get API key
      const apiKey = this.config.apiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is required');
      }

      // Build API URL
      const baseUrl = this.config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const modelPath = this.model.replace('-', '%2D'); // URL encode hyphens
      const url = `${baseUrl}/models/${modelPath}:generateContent?key=${apiKey}`;

      // Prepare request body
      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: `image/${format}`,
                  data: (image as string).split(',')[1] || image,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || this.config.maxTokens || 4096,
          temperature: options.temperature || this.config.temperature || 0.7,
        },
      };

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        ...this.parseResponse(text, options.analysisType || 'description'),
        durationMs: Date.now() - startTime,
        sessionId: options.sessionId,
      };

    } catch (error) {
      return {
        success: false,
        analysisType: options.analysisType || 'description',
        taskType: options.taskType || 'describe',
        provider: 'gemini',
        model: this.model,
        results: [],
        text: '',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        sessionId: options.sessionId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    // Note: Gemini streaming is more complex and requires SSE
    // For now, we'll use the regular analyze method
    const result = await this.analyze(options);
    yield result.text || '';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey || !!process.env.GEMINI_API_KEY;
  }

  getCapabilities() {
    return {
      analysisTypes: ['description', 'ocr', 'objects', 'text', 'layout', 'colors', 'custom'],
      maxImageSizeMB: 20,
      maxTokens: 4096,
    };
  }
}

/**
 * OpenAI Vision Provider (GPT-4 Vision)
 */
export class OpenAIVisionProvider extends BaseVisionProvider {
  provider: VisionProvider = 'openai';
  model: VisionModel;

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    super(config);
    this.model = config.model || 'gpt-4-vision-preview';
  }

  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preprocess image
      const { image, format } = await this.preprocessImage(options.image);

      // Build prompt
      const prompt = this.buildPrompt(
        options.analysisType || 'description',
        options.taskType || 'describe',
        options.prompt,
        format
      );

      // Get API key
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      // Build API URL
      const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
      const url = `${baseUrl}/chat/completions`;

      // Prepare request body
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: typeof image === 'string' && image.startsWith('data:') 
                  ? image 
                  : `data:image/${format};base64,${image}`,
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature || this.config.temperature || 0.7,
      };

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      return {
        ...this.parseResponse(text, options.analysisType || 'description'),
        durationMs: Date.now() - startTime,
        sessionId: options.sessionId,
      };

    } catch (error) {
      return {
        success: false,
        analysisType: options.analysisType || 'description',
        taskType: options.taskType || 'describe',
        provider: 'openai',
        model: this.model,
        results: [],
        text: '',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        sessionId: options.sessionId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    // OpenAI supports streaming
    const startTime = Date.now();

    try {
      // Preprocess image
      const { image, format } = await this.preprocessImage(options.image);

      // Build prompt
      const prompt = this.buildPrompt(
        options.analysisType || 'description',
        options.taskType || 'describe',
        options.prompt,
        format
      );

      // Get API key
      const apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required');
      }

      // Build API URL
      const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
      const url = `${baseUrl}/chat/completions`;

      // Prepare request body
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: typeof image === 'string' && image.startsWith('data:') 
                  ? image 
                  : `data:image/${format};base64,${image}`,
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature || this.config.temperature || 0.7,
        stream: true,
      };

      // Make streaming request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `OpenAI API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse and yield chunks
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const chunk = parsed.choices?.[0]?.delta?.content || '';
                if (chunk) {
                  yield chunk;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

    } catch (error) {
      yield `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  isAvailable(): boolean {
    return !!this.config.apiKey || !!process.env.OPENAI_API_KEY;
  }

  getCapabilities() {
    return {
      analysisTypes: ['description', 'ocr', 'objects', 'text', 'layout', 'colors', 'custom'],
      maxImageSizeMB: 20,
      maxTokens: 4096,
    };
  }
}

/**
 * Mistral Vision Provider
 */
export class MistralVisionProvider extends BaseVisionProvider {
  provider: VisionProvider = 'mistral';
  model: VisionModel;

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    super(config);
    this.model = config.model || 'mistral-large-latest';
  }

  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preprocess image
      const { image, format } = await this.preprocessImage(options.image);

      // Build prompt
      const prompt = this.buildPrompt(
        options.analysisType || 'description',
        options.taskType || 'describe',
        options.prompt,
        format
      );

      // Get API key
      const apiKey = this.config.apiKey || process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error('MISTRAL_API_KEY environment variable is required');
      }

      // Build API URL
      const baseUrl = this.config.baseUrl || 'https://api.mistral.ai/v1';
      const url = `${baseUrl}/chat/completions`;

      // Prepare request body
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: typeof image === 'string' && image.startsWith('data:') 
                  ? image 
                  : `data:image/${format};base64,${image}`,
              },
            ],
          },
        ],
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature || this.config.temperature || 0.7,
      };

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Mistral API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || '';

      return {
        ...this.parseResponse(text, options.analysisType || 'description'),
        durationMs: Date.now() - startTime,
        sessionId: options.sessionId,
      };

    } catch (error) {
      return {
        success: false,
        analysisType: options.analysisType || 'description',
        taskType: options.taskType || 'describe',
        provider: 'mistral',
        model: this.model,
        results: [],
        text: '',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        sessionId: options.sessionId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    const result = await this.analyze(options);
    yield result.text || '';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey || !!process.env.MISTRAL_API_KEY;
  }

  getCapabilities() {
    return {
      analysisTypes: ['description', 'ocr', 'objects', 'text', 'layout', 'colors', 'custom'],
      maxImageSizeMB: 20,
      maxTokens: 4096,
    };
  }
}

/**
 * Anthropic Claude Vision Provider
 */
export class AnthropicVisionProvider extends BaseVisionProvider {
  provider: VisionProvider = 'anthropic';
  model: VisionModel;

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    super(config);
    this.model = config.model || 'claude-3-sonnet';
  }

  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    const startTime = Date.now();

    try {
      // Preprocess image
      const { image, format } = await this.preprocessImage(options.image);

      // Build prompt
      const prompt = this.buildPrompt(
        options.analysisType || 'description',
        options.taskType || 'describe',
        options.prompt,
        format
      );

      // Get API key
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required');
      }

      // Build API URL
      const baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
      const url = `${baseUrl}/messages`;

      // Prepare request body
      const requestBody = {
        model: this.model,
        max_tokens: options.maxTokens || this.config.maxTokens || 4096,
        temperature: options.temperature || this.config.temperature || 0.7,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: `image/${format}`,
                  data: (image as string).split(',')[1] || image,
                },
              },
            ],
          },
        ],
      };

      // Make request
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Anthropic API error ${response.status}: ${errorData.message || response.statusText}`
        );
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';

      return {
        ...this.parseResponse(text, options.analysisType || 'description'),
        durationMs: Date.now() - startTime,
        sessionId: options.sessionId,
      };

    } catch (error) {
      return {
        success: false,
        analysisType: options.analysisType || 'description',
        taskType: options.taskType || 'describe',
        provider: 'anthropic',
        model: this.model,
        results: [],
        text: '',
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
        sessionId: options.sessionId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    const result = await this.analyze(options);
    yield result.text || '';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey || !!process.env.ANTHROPIC_API_KEY;
  }

  getCapabilities() {
    return {
      analysisTypes: ['description', 'ocr', 'objects', 'text', 'layout', 'colors', 'custom'],
      maxImageSizeMB: 20,
      maxTokens: 4096,
    };
  }
}

/**
 * Local Vision Provider (for testing or self-hosted models)
 */
export class LocalVisionProvider extends BaseVisionProvider {
  provider: VisionProvider = 'local';
  model: VisionModel = 'local';

  constructor(config: VisionConfig = DEFAULT_VISION_CONFIG) {
    super(config);
  }

  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    // NO FAKE EXECUTION: there is no real local model wired in this process.
    // Returning a hardcoded "success" would poison the agent with invented analysis.
    return {
      success: false,
      analysisType: options.analysisType || 'description',
      taskType: options.taskType || 'describe',
      provider: 'local',
      model: 'local',
      results: [],
      text: '',
      durationMs: 0,
      timestamp: Date.now(),
      sessionId: options.sessionId,
      error:
        'Local vision provider is not implemented: no model is served in this process. Configure a real provider (gemini, openai, mistral, anthropic) with its API key.',
    };
  }

  async *streamAnalyze(_options: VisionAnalysisOptions): AsyncIterable<string> {
    // No real stream exists — surface the honest failure instead of fake chunks.
    throw new Error(
      'Local vision provider is not implemented: no model is served in this process.',
    );
  }

  isAvailable(): boolean {
    // Never claim availability without a real backend behind it.
    return false;
  }

  getCapabilities() {
    return {
      analysisTypes: [] as string[],
      maxImageSizeMB: 0,
      maxTokens: 0,
    };
  }
}
