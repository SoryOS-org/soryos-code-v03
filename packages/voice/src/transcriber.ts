/**
 * @soryos/voice
 * Audio Transcriber - Speech-to-text transcription
 * 
 * Supports multiple providers:
 * - Web Speech API (browser-native)
 * - Whisper (local or remote)
 * - Google Speech-to-Text
 * - Azure Speech Services
 * - AWS Transcribe
 */

import {
  TranscriptionOptions,
  TranscriptionResult,
  VoiceProvider,
  VoiceConfig,
  DEFAULT_VOICE_CONFIG,
} from './types';

/**
 * Base transcriber interface
 */
export interface Transcriber {
  transcribe(options: TranscriptionOptions): Promise<TranscriptionResult>;
  streamTranscribe(options: TranscriptionOptions): AsyncIterable<string>;
  getProvider(): VoiceProvider;
  isSupported(): boolean;
}

/**
 * Web Speech API Transcriber
 * Uses browser-native SpeechRecognition API
 */
export class WebSpeechTranscriber implements Transcriber {
  private config: VoiceConfig;

  constructor(config: VoiceConfig = DEFAULT_VOICE_CONFIG) {
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
  }

  getProvider(): VoiceProvider {
    return 'web-speech-api';
  }

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    if (!this.isSupported()) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      // Configure recognition
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = options.language || this.config.language;

      let resultText = '';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resultText = transcript;

        if (options.onProgress) {
          options.onProgress(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };

      recognition.onend = () => {
        const result: TranscriptionResult = {
          text: resultText,
          confidence: 1.0, // Web Speech API doesn't provide confidence scores
          durationMs: 0, // Duration not available
          language: options.language || this.config.language,
          provider: 'web-speech-api',
          model: 'web-speech-api',
          timestamp: Date.now(),
          wordCount: resultText.split(/\s+/).length,
          isFinal: true,
        };
        
        if (options.onComplete) {
          options.onComplete(resultText);
        }
        
        resolve(result);
      };

      // Handle audio input
      if (options.audio && !(options.audio instanceof Blob)) {
        // For non-Blob audio, we need to convert it
        // This is a limitation of Web Speech API
        console.warn('[Voice] Web Speech API only supports live microphone input');
      }

      recognition.start();
    });
  }

  async *streamTranscribe(options: TranscriptionOptions): AsyncIterable<string> {
    if (!this.isSupported()) {
      throw new Error('Web Speech API is not supported in this browser');
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options.language || this.config.language;

    let finalText = '';
    const queue: string[] = [];
    let resolveNext: (() => void) | null = null;
    let isDone = false;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript + ' ';
        }
      }

      if (finalTranscript) {
        finalText += finalTranscript;
        queue.push(finalText);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
      }

      if (interimTranscript && options.onProgress) {
        options.onProgress(finalText + interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      recognition.stop();
      isDone = true;
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    recognition.onend = () => {
      isDone = true;
      if (resolveNext) {
        resolveNext();
        resolveNext = null;
      }
    };

    recognition.start();

    try {
      while (!isDone || queue.length > 0) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else if (!isDone) {
          await new Promise<void>((resolve) => {
            resolveNext = resolve;
          });
        }
      }
    } finally {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Base class for API-based transcribers
 */
export abstract class ApiTranscriber implements Transcriber {
  protected config: VoiceConfig;
  protected abstract apiUrl: string;
  protected abstract apiKey: string | undefined;

  constructor(config: VoiceConfig) {
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
  }

  abstract getProvider(): VoiceProvider;
  abstract isSupported(): boolean;

  protected async sendApiRequest(
    audio: Blob | Uint8Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    throw new Error('sendApiRequest must be implemented by subclass');
  }

  async transcribe(options: TranscriptionOptions): Promise<TranscriptionResult> {
    if (!this.isSupported()) {
      throw new Error(`${this.getProvider()} transcriber is not supported`);
    }

    // Convert audio to blob if needed
    let audioBlob: Blob;
    if (options.audio instanceof Blob) {
      audioBlob = options.audio;
    } else if (options.audio instanceof Uint8Array) {
      audioBlob = new Blob([options.audio as unknown as BlobPart], { type: 'audio/wav' });
    } else {
      throw new Error('Unsupported audio format');
    }

    return this.sendApiRequest(audioBlob, options);
  }

  async *streamTranscribe(options: TranscriptionOptions): AsyncIterable<string> {
    // For streaming, we'll use the regular transcribe method
    // and yield partial results if available
    const result = await this.transcribe(options);
    yield result.text;
  }
}

/**
 * Whisper Transcriber (for local or remote Whisper API)
 */
export class WhisperTranscriber extends ApiTranscriber {
  protected apiUrl: string;
  protected apiKey: string | undefined;

  constructor(config: VoiceConfig) {
    super(config);
    this.apiUrl = config.endpoint || 'http://localhost:8000/whisper';
    this.apiKey = config.apiKey;
  }

  getProvider(): VoiceProvider {
    return 'whisper';
  }

  isSupported(): boolean {
    return true; // Whisper can be self-hosted
  }

  protected async sendApiRequest(
    audio: Blob | Uint8Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const formData = new FormData();
    formData.append('audio', audio instanceof Blob ? audio : new Blob([audio as unknown as BlobPart]));
    formData.append('language', options.language || this.config.language);
    formData.append('model', options.model || this.config.model || 'whisper-1');

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      text: data.text || '',
      confidence: data.confidence || 0.9,
      durationMs: data.duration_ms || 0,
      language: data.language || options.language || this.config.language,
      provider: 'whisper',
      model: options.model || this.config.model || 'whisper-1',
      timestamp: Date.now(),
      wordCount: (data.text || '').split(/\s+/).length,
      isFinal: true,
    };
  }
}

/**
 * Google Speech-to-Text Transcriber
 */
export class GoogleTranscriber extends ApiTranscriber {
  protected apiUrl: string = 'https://speech.googleapis.com/v1/speech:recognize';
  protected apiKey: string | undefined;

  constructor(config: VoiceConfig) {
    super(config);
    this.apiKey = config.apiKey;
  }

  getProvider(): VoiceProvider {
    return 'google';
  }

  isSupported(): boolean {
    return !!this.apiKey;
  }

  protected async sendApiRequest(
    audio: Blob | Uint8Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const audioContent = await (audio instanceof Blob ? audio.arrayBuffer() : audio);
    const bufferData = audioContent instanceof Uint8Array ? audioContent : new Uint8Array(audioContent);
    const base64Audio = Buffer.from(bufferData).toString('base64');

    const requestBody = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: this.config.sampleRate,
        languageCode: options.language || this.config.language,
        model: options.model || 'latest_long',
      },
      audio: {
        content: base64Audio,
      },
    };

    const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Google Speech-to-Text API error: ${response.statusText}`);
    }

    const data = await response.json();
    const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence = data.results?.[0]?.alternatives?.[0]?.confidence || 0;

    return {
      text: transcript,
      confidence,
      durationMs: 0,
      language: options.language || this.config.language,
      provider: 'google',
      model: options.model || 'latest_long',
      timestamp: Date.now(),
      wordCount: transcript.split(/\s+/).length,
      isFinal: true,
    };
  }
}

/**
 * Azure Speech Services Transcriber
 */
export class AzureTranscriber extends ApiTranscriber {
  protected apiUrl: string;
  protected apiKey: string | undefined;

  constructor(config: VoiceConfig) {
    super(config);
    this.apiUrl = config.endpoint || 'https://eastus.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1';
    this.apiKey = config.apiKey;
  }

  getProvider(): VoiceProvider {
    return 'azure';
  }

  isSupported(): boolean {
    return !!this.apiKey;
  }

  protected async sendApiRequest(
    audio: Blob | Uint8Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const audioContent = await (audio instanceof Blob ? audio.arrayBuffer() : audio);
    const bodyPayload = audioContent instanceof Uint8Array ? (audioContent.buffer as ArrayBuffer) : audioContent;

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.apiKey || '',
        'Content-Type': 'audio/wav',
      },
      body: bodyPayload,
    });

    if (!response.ok) {
      throw new Error(`Azure Speech API error: ${response.statusText}`);
    }

    const data = await response.json();
    const transcript = data.DisplayText || data.NBest?.[0]?.Display || '';
    const confidence = data.NBest?.[0]?.Confidence || 0;

    return {
      text: transcript,
      confidence,
      durationMs: 0,
      language: options.language || this.config.language,
      provider: 'azure',
      model: options.model || 'en-US',
      timestamp: Date.now(),
      wordCount: transcript.split(/\s+/).length,
      isFinal: true,
    };
  }
}

/**
 * AWS Transcribe Transcriber
 */
export class AWSTranscriber extends ApiTranscriber {
  protected apiUrl: string = 'https://transcribe.us-east-1.amazonaws.com';
  protected apiKey: string | undefined;

  constructor(config: VoiceConfig) {
    super(config);
    this.apiKey = config.apiKey;
  }

  getProvider(): VoiceProvider {
    return 'aws';
  }

  isSupported(): boolean {
    return !!this.apiKey;
  }

  protected async sendApiRequest(
    audio: Blob | Uint8Array,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // AWS Transcribe uses a different API that requires S3
    // This is a simplified implementation
    throw new Error('AWS Transcribe requires S3 bucket integration');
  }
}

/**
 * Transcriber factory
 */
export class TranscriberFactory {
  private static instances: Map<VoiceProvider, Transcriber> = new Map();

  static getTranscriber(provider: VoiceProvider, config?: VoiceConfig): Transcriber {
    if (TranscriberFactory.instances.has(provider)) {
      return TranscriberFactory.instances.get(provider)!;
    }

    let transcriber: Transcriber;

    switch (provider) {
      case 'web-speech-api':
        transcriber = new WebSpeechTranscriber(config);
        break;
      case 'whisper':
        transcriber = new WhisperTranscriber(config || DEFAULT_VOICE_CONFIG);
        break;
      case 'google':
        transcriber = new GoogleTranscriber(config || DEFAULT_VOICE_CONFIG);
        break;
      case 'azure':
        transcriber = new AzureTranscriber(config || DEFAULT_VOICE_CONFIG);
        break;
      case 'aws':
        transcriber = new AWSTranscriber(config || DEFAULT_VOICE_CONFIG);
        break;
      default:
        throw new Error(`Unsupported voice provider: ${provider}`);
    }

    TranscriberFactory.instances.set(provider, transcriber);
    return transcriber;
  }

  static clearInstances(): void {
    TranscriberFactory.instances.clear();
  }
}

/**
 * Get transcriber by provider
 */
export function getTranscriber(provider: VoiceProvider, config?: VoiceConfig): Transcriber {
  return TranscriberFactory.getTranscriber(provider, config);
}

/**
 * Default transcriber (Web Speech API)
 */
export function getDefaultTranscriber(config?: VoiceConfig): Transcriber {
  return getTranscriber('web-speech-api', config);
}
