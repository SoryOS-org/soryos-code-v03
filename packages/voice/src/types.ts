/**
 * @soryos/voice
 * Voice Input Types and Interfaces
 */

/**
 * Voice provider types
 */
export type VoiceProvider = 'web-speech-api' | 'whisper' | 'google' | 'azure' | 'aws';

/**
 * Audio format types
 */
export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'opus' | 'webm' | 'pcm';

/**
 * Audio sample rate in Hz
 */
export type SampleRate = 8000 | 16000 | 22050 | 44100 | 48000;

/**
 * Audio channel count
 */
export type ChannelCount = 1 | 2;

/**
 * Audio bit depth
 */
export type BitDepth = 16 | 24 | 32;

/**
 * Recording state
 */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped' | 'error';

/**
 * Transcription state
 */
export type TranscriptionState = 'idle' | 'transcribing' | 'completed' | 'error';

/**
 * Voice input configuration
 */
export interface VoiceConfig {
  provider: VoiceProvider;
  sampleRate: SampleRate;
  channelCount: ChannelCount;
  bitDepth: BitDepth;
  format: AudioFormat;
  maxDurationMs: number;
  autoStopOnSilence: boolean;
  silenceThreshold: number;
  silenceDurationMs: number;
  language: string;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/**
 * Default voice configuration
 */
export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  provider: 'web-speech-api',
  sampleRate: 44100,
  channelCount: 1,
  bitDepth: 16,
  format: 'webm',
  maxDurationMs: 300000, // 5 minutes
  autoStopOnSilence: true,
  silenceThreshold: -45, // dB
  silenceDurationMs: 2000, // 2 seconds
  language: 'en-US',
};

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  data: Uint8Array | ArrayBuffer;
  timestamp: number;
  durationMs: number;
  sampleCount: number;
}

/**
 * Audio buffer for recording
 */
export interface AudioBuffer {
  samples: Float32Array | Int16Array;
  sampleRate: SampleRate;
  channelCount: ChannelCount;
  durationMs: number;
}

/**
 * Recording options
 */
export interface RecordingOptions {
  sessionId?: string;
  onStart?: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onError?: (error: Error) => void;
  onAudio?: (chunk: AudioChunk) => void;
  onVolume?: (volume: number) => void;
  autoStopOnSilence?: boolean;
  maxDurationMs?: number;
}

/**
 * Transcription options
 */
export interface TranscriptionOptions {
  sessionId?: string;
  audio: AudioBuffer | Blob | File | Uint8Array;
  format?: AudioFormat;
  sampleRate?: SampleRate;
  language?: string;
  provider?: VoiceProvider;
  model?: string;
  onProgress?: (partialText: string) => void;
  onComplete?: (text: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Transcription result
 */
export interface TranscriptionResult {
  text: string;
  confidence?: number;
  durationMs: number;
  language?: string;
  provider: VoiceProvider;
  model?: string;
  timestamp: number;
  wordCount: number;
  isFinal: boolean;
}

/**
 * Voice recognition result
 */
export interface VoiceRecognitionResult {
  transcript: string;
  confidence?: number;
  isFinal: boolean;
  timestamp: number;
  sessionId?: string;
}

/**
 * Voice input event types
 */
export type VoiceEventType =
  | 'recording.started'
  | 'recording.stopped'
  | 'recording.paused'
  | 'recording.resumed'
  | 'recording.error'
  | 'transcription.started'
  | 'transcription.progress'
  | 'transcription.completed'
  | 'transcription.error'
  | 'voice.input';

/**
 * Voice event payload
 */
export interface VoiceEventPayload {
  type: VoiceEventType;
  sessionId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Voice input result for agent
 */
export interface VoiceInputResult {
  success: boolean;
  text: string;
  audio?: Blob | Uint8Array;
  durationMs: number;
  provider: VoiceProvider;
  model?: string;
  confidence?: number;
  error?: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Voice capabilities
 */
export interface VoiceCapabilities {
  recording: boolean;
  transcription: boolean;
  streaming: boolean;
  realtime: boolean;
  providers: VoiceProvider[];
  formats: AudioFormat[];
}

/**
 * Voice session state
 */
export interface VoiceSessionState {
  sessionId: string;
  recordingState: RecordingState;
  transcriptionState: TranscriptionState;
  currentRecording?: {
    startTime: number;
    durationMs: number;
    audioChunks: AudioChunk[];
  };
  currentTranscription?: {
    startTime: number;
    partialText: string;
    provider: VoiceProvider;
  };
  lastError?: Error;
}
