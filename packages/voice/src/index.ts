/**
 * @soryos/voice
 * Voice Input Package - Main exports
 * 
 * Provides comprehensive voice input capabilities for SoryOS-Code:
 * - Audio recording with Web Audio API
 * - Multiple transcription providers (Web Speech API, Whisper, Google, Azure, AWS)
 * - Real-time audio streaming
 * - Volume and silence detection
 * - Multiple audio formats support
 */

// Re-export types
export * from './types';

// Re-export recorder
export * from './recorder';

// Re-export transcriber
export * from './transcriber';

// Main exports
import { AudioRecorder, createRecorder, getRecorder, setRecorder } from './recorder';
import { 
  Transcriber, 
  WebSpeechTranscriber, 
  WhisperTranscriber, 
  GoogleTranscriber, 
  AzureTranscriber, 
  AWSTranscriber,
  TranscriberFactory,
  getTranscriber,
  getDefaultTranscriber
} from './transcriber';

// Voice manager class for unified interface
export class VoiceManager {
  private recorder: AudioRecorder | null = null;
  private transcriber: Transcriber | null = null;

  constructor(provider?: string, config?: any) {
    if (provider) {
      this.transcriber = getTranscriber(provider as any, config);
    }
  }

  /**
   * Initialize voice manager with audio recording
   */
  async initialize(recordingOptions?: any, transcriberConfig?: any): Promise<void> {
    this.recorder = createRecorder(recordingOptions);
    await this.recorder.initialize();
    
    if (!this.transcriber) {
      this.transcriber = getDefaultTranscriber(transcriberConfig);
    }
  }

  /**
   * Start recording
   */
  async startRecording(options?: any): Promise<void> {
    if (!this.recorder) {
      throw new Error('Voice manager not initialized');
    }
    await this.recorder.start();
  }

  /**
   * Stop recording and get audio buffer
   */
  async stopRecording(): Promise<any> {
    if (!this.recorder) {
      throw new Error('Voice manager not initialized');
    }
    return this.recorder.stop();
  }

  /**
   * Transcribe audio
   */
  async transcribe(options: any): Promise<any> {
    if (!this.transcriber) {
      throw new Error('Transcriber not initialized');
    }
    return this.transcriber.transcribe(options);
  }

  /**
   * Stream transcribe audio
   */
  async *streamTranscribe(options: any): AsyncIterable<string> {
    if (!this.transcriber) {
      throw new Error('Transcriber not initialized');
    }
    yield* this.transcriber.streamTranscribe(options);
  }

  /**
   * Record and transcribe in one operation
   */
  async recordAndTranscribe(
    recordingOptions?: any,
    transcribeOptions?: any
  ): Promise<string> {
    if (!this.recorder || !this.transcriber) {
      throw new Error('Voice manager not initialized');
    }

    // Start recording
    await this.recorder.start();

    // Wait for user to stop recording (this would be triggered by UI)
    // For now, we'll just record for a short time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Stop recording
    const audioBuffer = await this.recorder.stop();

    // Transcribe
    const result = await this.transcriber.transcribe({
      audio: audioBuffer.samples,
      ...transcribeOptions,
    });

    return result.text;
  }

  /**
   * Get recorder
   */
  getRecorder(): AudioRecorder | null {
    return this.recorder;
  }

  /**
   * Get transcriber
   */
  getTranscriber(): Transcriber | null {
    return this.transcriber;
  }

  /**
   * Set transcriber
   */
  setTranscriber(transcriber: Transcriber): void {
    this.transcriber = transcriber;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.recorder) {
      await this.recorder.cleanup();
      this.recorder = null;
    }
  }
}

// Singleton voice manager
export const voiceManager = new VoiceManager();

// Initialize voice manager
export async function initializeVoice(options?: any): Promise<VoiceManager> {
  await voiceManager.initialize(options);
  return voiceManager;
}
