# `@soryos/voice` Agent Operating Guidelines

## Overview
This package provides comprehensive voice input capabilities for SoryOS-Code, inspired by Vibra Code's mobile voice input implementation. Enables users to interact with agents using natural speech.

## Responsibilities
- Provide `VoiceManager` singleton for unified voice operations
- Audio recording using Web Audio API with volume and silence detection
- Multiple transcription providers (Web Speech API, Whisper, Google, Azure, AWS)
- Real-time audio streaming and transcription
- Support for multiple audio formats (WAV, WebM, MP3, OGG)
- Silence detection with auto-stop
- Session-based voice input management

## Key Files
- `src/index.ts`: Main exports and VoiceManager class
- `src/recorder.ts`: AudioRecorder class with Web Audio API integration
- `src/transcriber.ts`: Multiple transcription providers
- `src/types.ts`: Type definitions for voice operations

## Integration with `@soryos/tool`
The `voice_transcribe` tool (`packages/tool/src/voice-tools.ts`) transcribes audio FILES from disk via `getTranscriber(provider, config)`. Server-side reality: `web-speech-api` is browser-only (rejected honestly), `aws` needs unimplemented S3 integration (rejected honestly), `whisper` targets `WHISPER_ENDPOINT` (default `http://localhost:8000/whisper`), `google`/`azure` need `GOOGLE_SPEECH_API_KEY`/`AZURE_SPEECH_KEY`. The `AudioRecorder` remains browser-only (no microphone in a server process).

## Architecture
```
VoiceManager
├── AudioRecorder (Web Audio API)
│   ├── Microphone input capture
│   ├── Volume detection
│   ├── Silence detection with auto-stop
│   ├── Audio format encoding (WAV, WebM)
│   └── Streaming audio chunks
└── Transcriber (Multiple providers)
    ├── Web Speech API (browser-native)
    ├── Whisper (local/remote)
    ├── Google Speech-to-Text
    ├── Azure Speech Services
    └── AWS Transcribe
```

## Agent Guidelines
- Use `VoiceManager` for all voice operations
- Always check if audio recording is supported before attempting to record
- Handle microphone permission requests gracefully
- Use appropriate transcription provider based on availability and cost
- Clean up audio resources when done
- Never record without user consent
- Provide visual feedback during recording

## Voice Providers

### Web Speech API (Default)
- **Pros**: Browser-native, no API key required, free
- **Cons**: Limited language support, no confidence scores, live microphone only
- **Status**: ✅ Fully supported

### Whisper
- **Pros**: Open source, can be self-hosted, good accuracy
- **Cons**: Requires server setup or external API
- **Status**: ✅ Supported (requires endpoint configuration)

### Google Speech-to-Text
- **Pros**: High accuracy, wide language support
- **Cons**: Requires API key, paid service
- **Status**: ✅ Supported (requires API key)

### Azure Speech Services
- **Pros**: Enterprise-grade, good accuracy
- **Cons**: Requires API key, paid service
- **Status**: ✅ Supported (requires API key)

### AWS Transcribe
- **Pros**: High accuracy, S3 integration
- **Cons**: Requires API key, S3 bucket, paid service
- **Status**: ⚠️ Partial (requires S3 integration)

## Audio Formats
- **WAV**: Uncompressed, high quality, large file size
- **WebM**: Compressed, good for web, smaller file size
- **MP3**: Compressed, widely supported
- **OGG**: Open format, good compression

## Features

### Audio Recording
- Real-time microphone input capture
- Volume level detection
- Silence detection with configurable threshold and duration
- Auto-stop on silence
- Multiple audio format encoding
- Streaming audio chunks

### Transcription
- Multiple provider support
- Real-time streaming transcription
- Partial result callbacks
- Language detection
- Confidence scores (where available)

### Voice Integration
- Session-based voice input
- Event streaming via `@soryos/bus`
- Integration with agent runtime
- Support for voice commands

## Usage Examples

### Basic Recording
```typescript
import { AudioRecorder } from '@soryos/voice';

const recorder = new AudioRecorder();
await recorder.initialize();
await recorder.start();
// User speaks...
const audioBuffer = await recorder.stop();
```

### Recording with Transcription
```typescript
import { VoiceManager } from '@soryos/voice';

const manager = new VoiceManager('web-speech-api');
await manager.initialize();
await manager.startRecording();
// User speaks...
const audioBuffer = await manager.stopRecording();
const result = await manager.transcribe({ audio: audioBuffer.samples });
console.log(result.text);
```

### Using Different Providers
```typescript
import { getTranscriber } from '@soryos/voice';

// Whisper
const whisper = getTranscriber('whisper', {
  endpoint: 'https://your-whisper-api.com',
  model: 'whisper-1'
});

// Google
const google = getTranscriber('google', {
  apiKey: 'your-google-api-key',
  language: 'en-US'
});

// Azure
const azure = getTranscriber('azure', {
  apiKey: 'your-azure-api-key',
  endpoint: 'https://your-region.stt.speech.microsoft.com'
});
```

## Browser Compatibility
- Chrome: ✅ Full support (Web Speech API, Web Audio API)
- Firefox: ✅ Full support (Web Speech API, Web Audio API)
- Safari: ✅ Partial support (Web Audio API, limited Web Speech API)
- Edge: ✅ Full support (Web Speech API, Web Audio API)

## Security Considerations
- Always request microphone permission explicitly
- Provide clear visual indication when recording
- Allow users to stop recording at any time
- Never store audio without user consent
- Clean up audio resources when done

## Error Handling
- Microphone permission denied
- No microphone available
- Audio context suspended
- API key missing or invalid
- Network errors for cloud providers
- Audio format not supported

## Future Enhancements
- [ ] Text-to-speech (TTS) for agent responses
- [ ] Voice command recognition
- [ ] Speaker diarization
- [ ] Noise reduction and audio enhancement
- [ ] Real-time voice chat with agent
- [ ] Voice biometrics for authentication
