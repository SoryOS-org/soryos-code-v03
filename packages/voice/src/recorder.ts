/**
 * @soryos/voice
 * Audio Recorder - Browser-based audio recording using Web Audio API
 * 
 * Features:
 * - Real-time audio recording
 * - Volume detection
 * - Silence detection with auto-stop
 * - Multiple audio formats support
 * - Streaming audio chunks
 */

import {
  AudioChunk,
  AudioBuffer,
  RecordingState,
  RecordingOptions,
  VoiceConfig,
  SampleRate,
  ChannelCount,
  DEFAULT_VOICE_CONFIG,
} from './types';

/**
 * Audio recorder class for capturing microphone input
 */
export class AudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | AudioWorkletNode | null = null;
  private audioWorklet: AudioWorklet | null = null;
  private chunks: AudioChunk[] = [];
  private state: RecordingState = 'idle';
  private options: RecordingOptions;
  private config: VoiceConfig;
  private startTime: number = 0;
  private volumeThreshold: number;
  private silenceStartTime: number = 0;
  private sampleBuffer: Float32Array[] = [];
  private channelCount: number = 1;
  private sampleRate: number = 44100;

  constructor(options: RecordingOptions = {}, config: VoiceConfig = DEFAULT_VOICE_CONFIG) {
    this.options = options;
    this.config = { ...DEFAULT_VOICE_CONFIG, ...config };
    this.channelCount = config.channelCount;
    this.sampleRate = config.sampleRate;
    this.volumeThreshold = Math.pow(10, config.silenceThreshold / 20);
  }

  /**
   * Check if audio recording is supported in the browser
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    );
  }

  /**
   * Get available audio input devices
   */
  static async getDevices(): Promise<MediaDeviceInfo[]> {
    if (!AudioRecorder.isSupported()) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      console.error('[Voice] Failed to enumerate audio devices:', error);
      return [];
    }
  }

  /**
   * Initialize the audio recorder
   */
  async initialize(): Promise<void> {
    if (!AudioRecorder.isSupported()) {
      throw new Error('Audio recording is not supported in this browser');
    }

    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.channelCount,
          sampleRate: this.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaStream = stream;
      this.state = 'idle';

      // Setup audio processing
      await this.setupAudioProcessing();

      console.log('[Voice] Audio recorder initialized');
    } catch (error) {
      this.state = 'error';
      throw new Error(`Failed to initialize audio recorder: ${error}`);
    }
  }

  /**
   * Setup audio processing using AudioWorklet (preferred) or ScriptProcessorNode
   */
  private async setupAudioProcessing(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio context and media stream must be initialized first');
    }

    try {
      // Try to use AudioWorklet (modern approach)
      if (window.AudioWorklet) {
        await this.setupAudioWorklet();
      } else {
        // Fallback to ScriptProcessorNode (legacy)
        this.setupScriptProcessor();
      }
    } catch (error) {
      console.warn('[Voice] AudioWorklet not available, falling back to ScriptProcessorNode');
      this.setupScriptProcessor();
    }
  }

  /**
   * Setup audio processing with AudioWorklet
   */
  private async setupAudioWorklet(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) return;

    // Define the audio worklet processor
    const processorCode = `
      class AudioRecorderProcessor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.buffer = [];
          this.sampleRate = 44100;
        }

        process(inputs, outputs, parameters) {
          const input = inputs[0];
          if (input && input.length > 0) {
            const channelData = input[0];
            const samples = new Float32Array(channelData.length);
            samples.set(channelData);
            this.buffer.push(samples);
            
            // Send data to port
            if (this.port) {
              this.port.postMessage({
                type: 'audio',
                data: samples,
                timestamp: performance.now()
              });
            }
          }
          return true;
        }
      }

      registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
    `;

    // Create blob URL and register processor
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.audioContext.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    // Create source and processor
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = new AudioWorkletNode(this.audioContext, 'audio-recorder-processor');
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Handle messages from worklet
    (this.processor as AudioWorkletNode).port.onmessage = (event) => {
      if (event.data.type === 'audio') {
        this.handleAudioData(event.data.data, event.data.timestamp);
      }
    };
  }

  /**
   * Setup audio processing with ScriptProcessorNode (legacy)
   */
  private setupScriptProcessor(): void {
    if (!this.audioContext || !this.mediaStream) return;

    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, this.channelCount, this.channelCount);

    (this.processor as ScriptProcessorNode).onaudioprocess = (event) => {
      const input = event.inputBuffer;
      const channelData = input.getChannelData(0);
      const samples = new Float32Array(channelData.length);
      samples.set(channelData);
      
      this.handleAudioData(samples, performance.now());
    };

    source.connect(this.processor);
    (this.processor as ScriptProcessorNode).connect(this.audioContext.destination);
  }

  /**
   * Handle incoming audio data
   */
  private handleAudioData(samples: Float32Array, timestamp: number): void {
    if (this.state !== 'recording') return;

    // Calculate volume
    const volume = this.calculateVolume(samples);
    
    // Call volume callback
    if (this.options.onVolume) {
      this.options.onVolume(volume);
    }

    // Check for silence
    if (this.config.autoStopOnSilence) {
      if (volume < this.volumeThreshold) {
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = timestamp;
        } else if (timestamp - this.silenceStartTime > this.config.silenceDurationMs) {
          // Auto-stop on silence
          this.stop();
          return;
        }
      } else {
        this.silenceStartTime = 0;
      }
    }

    // Buffer samples
    this.sampleBuffer.push(samples);

    // Create audio chunk
    const int16 = this.float32ToInt16(samples);
    const chunk: AudioChunk = {
      data: new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength),
      timestamp,
      durationMs: (samples.length / this.sampleRate) * 1000,
      sampleCount: samples.length,
    };

    this.chunks.push(chunk);

    // Call audio callback
    if (this.options.onAudio) {
      this.options.onAudio(chunk);
    }
  }

  /**
   * Calculate volume from audio samples
   */
  private calculateVolume(samples: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += Math.abs(samples[i]);
    }
    return sum / samples.length;
  }

  /**
   * Convert Float32Array to Int16Array
   */
  private float32ToInt16(samples: Float32Array): Int16Array {
    const int16 = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      int16[i] = sample < 0 ? Math.max(-32768, Math.floor(sample * 32768)) : Math.min(32767, Math.floor(sample * 32767));
    }
    return int16;
  }

  /**
   * Start recording
   */
  async start(): Promise<void> {
    if (!this.audioContext || !this.mediaStream) {
      throw new Error('Audio recorder not initialized');
    }

    if (this.state === 'recording') {
      return; // Already recording
    }

    this.chunks = [];
    this.sampleBuffer = [];
    this.silenceStartTime = 0;
    this.startTime = performance.now();
    this.state = 'recording';

    // Resume audio context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    console.log('[Voice] Recording started');
    this.options.onStart?.();
  }

  /**
   * Stop recording
   */
  async stop(): Promise<AudioBuffer> {
    if (this.state !== 'recording') {
      throw new Error('Recording not in progress');
    }

    this.state = 'stopped';
    
    // Disconnect processor
    if (this.processor) {
      this.processor.disconnect();
    }

    const durationMs = performance.now() - this.startTime;
    console.log(`[Voice] Recording stopped, duration: ${durationMs}ms`);

    this.options.onStop?.();

    // Create audio buffer from chunks
    const audioBuffer = this.createAudioBuffer(durationMs);
    
    return audioBuffer;
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state !== 'recording') {
      return;
    }

    this.state = 'paused';
    console.log('[Voice] Recording paused');
    this.options.onPause?.();
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== 'paused') {
      return;
    }

    this.state = 'recording';
    console.log('[Voice] Recording resumed');
    this.options.onResume?.();
  }

  /**
   * Create audio buffer from recorded chunks
   */
  private createAudioBuffer(durationMs: number): AudioBuffer {
    // Concatenate all samples
    const totalSamples = this.sampleBuffer.reduce((sum, buffer) => sum + buffer.length, 0);
    const mergedSamples = new Float32Array(totalSamples);
    
    let offset = 0;
    for (const buffer of this.sampleBuffer) {
      mergedSamples.set(buffer, offset);
      offset += buffer.length;
    }

    return {
      samples: mergedSamples,
      sampleRate: this.sampleRate as SampleRate,
      channelCount: this.channelCount as ChannelCount,
      durationMs,
    };
  }

  /**
   * Get recorded audio as blob
   */
  getBlob(format: 'wav' | 'webm' = 'webm'): Blob {
    const audioBuffer = this.createAudioBuffer(
      this.chunks.reduce((total, chunk) => total + chunk.durationMs, 0)
    );

    if (format === 'wav') {
      return this.encodeWAV(audioBuffer);
    } else {
      return this.encodeWebM(audioBuffer);
    }
  }

  /**
   * Encode audio buffer to WAV format
   */
  private encodeWAV(audioBuffer: AudioBuffer): Blob {
    const { samples, sampleRate, channelCount } = audioBuffer;
    const numChannels = channelCount;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    view.setUint32(0, 0x52494646, true);
    // File size
    view.setUint32(4, 36 + dataSize, true);
    // WAVE identifier
    view.setUint32(8, 0x57415645, true);
    // fmt chunk identifier
    view.setUint32(12, 0x666d7420, true);
    // fmt chunk size
    view.setUint32(16, 16, true);
    // Audio format (PCM = 1)
    view.setUint16(20, 1, true);
    // Number of channels
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate
    view.setUint32(28, byteRate, true);
    // Block align
    view.setUint16(32, blockAlign, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    view.setUint32(36, 0x64617461, true);
    // data chunk size
    view.setUint32(40, dataSize, true);

    // Write PCM data
    const int16Samples = samples instanceof Float32Array ? this.float32ToInt16(samples) : samples;
    for (let i = 0; i < int16Samples.length; i++) {
      view.setInt16(44 + i * 2, int16Samples[i], true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  /**
   * Encode audio buffer to WebM format
   */
  private encodeWebM(audioBuffer: AudioBuffer): Blob {
    // For simplicity, we'll use the WAV encoding and convert to WebM
    // In production, use a proper WebM encoder
    const wavBlob = this.encodeWAV(audioBuffer);
    return new Blob([wavBlob], { type: 'audio/webm' });
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get recorded chunks
   */
  getChunks(): AudioChunk[] {
    return [...this.chunks];
  }

  /**
   * Get recording duration in milliseconds
   */
  getDuration(): number {
    if (this.state !== 'recording') {
      return this.chunks.reduce((total, chunk) => total + chunk.durationMs, 0);
    }
    return performance.now() - this.startTime;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.chunks = [];
    this.sampleBuffer = [];
    this.state = 'idle';

    console.log('[Voice] Audio recorder cleaned up');
  }
}

/**
 * Create a new audio recorder instance
 */
export function createRecorder(options?: RecordingOptions, config?: VoiceConfig): AudioRecorder {
  return new AudioRecorder(options, config);
}

/**
 * Singleton audio recorder instance
 */
let globalRecorder: AudioRecorder | null = null;

/**
 * Get or create the global audio recorder
 */
export function getRecorder(options?: RecordingOptions, config?: VoiceConfig): AudioRecorder {
  if (!globalRecorder) {
    globalRecorder = new AudioRecorder(options, config);
  }
  return globalRecorder;
}

/**
 * Set the global audio recorder
 */
export function setRecorder(recorder: AudioRecorder): void {
  globalRecorder = recorder;
}
