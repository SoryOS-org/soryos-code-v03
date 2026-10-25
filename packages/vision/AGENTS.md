# `@soryos/vision` Agent Operating Guidelines

## Overview
This package provides comprehensive Vision AI capabilities for SoryOS-Code. It enables agents to analyze images using multiple AI providers (Gemini, OpenAI GPT-4, Mistral, Anthropic Claude) for tasks like OCR, object detection, layout analysis, color analysis, and mockup analysis.

## Responsibilities
- Provide `VisionManager` singleton for unified vision operations
- Multi-provider support (Gemini, OpenAI, Mistral, Anthropic, Local)
- Image analysis with automatic provider selection
- Specialized analyzers:
  - **OCRAnalyzer**: Text extraction from images
  - **ObjectDetectionAnalyzer**: Object detection and localization
  - **LayoutAnalyzer**: UI/UX layout analysis
  - **ColorAnalyzer**: Color palette and contrast analysis
  - **FaceDetector**: Face detection and analysis
  - **MockupAnalyzer**: Design mockup analysis with suggestions
- Streaming analysis support
- Error handling with retries
- Image preprocessing (resize, compress, format conversion)

## Key Files
- `src/index.ts`: Main exports and VisionManager class
- `src/types.ts`: Type definitions for all vision operations
- `src/providers.ts`: Multi-provider implementations (Gemini, OpenAI, Mistral, Anthropic, Local)
- `src/analyzer.ts`: Specialized analyzers (OCR, Objects, Layout, Colors, Faces, Mockup)

## Integration with `@soryos/tool`
The `vision_analyze` tool (`packages/tool/src/vision-tools.ts`) is the agent-facing entry point: it resolves local files/URLs into data URLs and calls `initializeVision(provider).analyze(...)`. Provider keys come from env (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `ANTHROPIC_API_KEY`). WARNING: `LocalVisionProvider` is a hardcoded placeholder (fake success) — the tool deliberately rejects `provider: "local"` (NO FAKE EXECUTION rule).

## Architecture
```
VisionManager
├── VisionAnalyzer (Unified interface)
│   ├── OCRAnalyzer
│   ├── ObjectDetectionAnalyzer
│   ├── LayoutAnalyzer
│   ├── ColorAnalyzer
│   ├── FaceDetector
│   └── MockupAnalyzer
└── VisionProviderInterface
    ├── GeminiVisionProvider
    ├── OpenAIVisionProvider
    ├── MistralVisionProvider
    ├── AnthropicVisionProvider
    └── LocalVisionProvider
```

## Agent Guidelines
- Use `VisionManager` for all vision operations
- Always specify the analysis type (description, ocr, objects, layout, colors, faces, custom)
- Handle image preprocessing (resize, compress) for large images
- Provide clear prompts for custom analysis
- Handle errors gracefully and provide fallback options
- Use appropriate provider based on task requirements
- Clean up resources when done

## Vision Providers

### Google Gemini (Default)
- **Models**: gemini-2.5-flash, gemini-2.5-pro, gemini-1.5-flash, gemini-1.5-pro
- **Pros**: Fast, accurate, good at general analysis
- **Cons**: May have usage limits
- **Status**: ✅ Fully supported
- **Environment**: `GEMINI_API_KEY`

### OpenAI GPT-4 Vision
- **Models**: gpt-4-vision-preview, gpt-4o, gpt-4o-mini
- **Pros**: Excellent for detailed analysis, supports streaming
- **Cons**: Higher cost, may have waitlists
- **Status**: ✅ Fully supported
- **Environment**: `OPENAI_API_KEY`

### Mistral AI
- **Models**: mistral-large-latest, codestral-latest
- **Pros**: Open source, good for European users
- **Cons**: Limited vision capabilities (check current support)
- **Status**: ✅ Supported
- **Environment**: `MISTRAL_API_KEY`

### Anthropic Claude
- **Models**: claude-3-haiku, claude-3-sonnet, claude-3-opus, claude-4, claude-4-sonnet, claude-4-opus
- **Pros**: Excellent reasoning, good for complex analysis
- **Cons**: Higher cost, may have waitlists
- **Status**: ✅ Fully supported
- **Environment**: `ANTHROPIC_API_KEY`

### Local Provider
- **Models**: Custom/local models
- **Pros**: No API costs, full control
- **Cons**: Requires self-hosting
- **Status**: ✅ Supported (placeholder)
- **Environment**: None required

## Analysis Types

| Type | Description | Use Case | Provider Support |
|------|-------------|----------|------------------|
| `description` | Generate textual description of image | General understanding | ✅ All |
| `ocr` | Extract text from image | Text recognition, document processing | ✅ All |
| `objects` | Detect and locate objects | Object recognition, scene understanding | ✅ All |
| `text` | Analyze text content in image | Text analysis, sentiment | ✅ All |
| `layout` | Analyze UI/UX layout | Design feedback, structure analysis | ✅ All |
| `colors` | Analyze color palette | Color scheme analysis, contrast checking | ✅ All |
| `faces` | Detect and analyze faces | Face recognition, demographic analysis | ✅ All |
| `custom` | Custom analysis with prompt | Any custom task | ✅ All |

## Task Types

| Type | Description | Analysis Type |
|------|-------------|---------------|
| `describe` | Generate description | description |
| `extract_text` | Extract all text | ocr, text |
| `detect_objects` | Detect objects | objects |
| `analyze_layout` | Analyze layout | layout |
| `detect_colors` | Analyze colors | colors |
| `detect_faces` | Detect faces | faces |
| `answer_question` | Answer question about image | custom |
| `custom_prompt` | Custom prompt | custom |

## Usage Examples

### Basic Image Analysis
```typescript
import { VisionManager, getVisionManager } from '@soryos/vision';

// Create manager
const manager = new VisionManager();

// Analyze image
const result = await manager.analyze({
  image: blob, // or File, string (URL/data URL), Uint8Array
  analysisType: 'description',
  prompt: 'Describe this image in detail',
});

console.log(result.text); // Description text
```

### OCR (Text Extraction)
```typescript
import { VisionManager } from '@soryos/vision';

const manager = new VisionManager();

const ocrResult = await manager.extractText({
  image: blob,
  analysisType: 'ocr',
  prompt: 'Extract all text preserving formatting',
});

console.log(ocrResult.text); // Extracted text
console.log(ocrResult.lines); // Lines with bounding boxes
console.log(ocrResult.words); // Individual words
```

### Object Detection
```typescript
import { VisionManager } from '@soryos/vision';

const manager = new VisionManager();

const objects = await manager.detectObjects({
  image: blob,
  analysisType: 'objects',
  prompt: 'Identify all objects with confidence scores',
});

console.log(objects.objects); // Array of detected objects
```

### Layout Analysis
```typescript
import { VisionManager } from '@soryos/vision';

const manager = new VisionManager();

const layout = await manager.analyzeLayout({
  image: blob,
  analysisType: 'layout',
});

console.log(layout.elements); // UI elements
console.log(layout.structure); // Layout structure
```

### Mockup Analysis
```typescript
import { VisionManager } from '@soryos/vision';

const manager = new VisionManager();

const mockup = await manager.analyzeMockup({
  image: blob,
  analysisType: 'mockup',
});

console.log(mockup.layout); // Layout analysis
console.log(mockup.colors); // Color analysis
console.log(mockup.suggestions); // Design suggestions
console.log(mockup.accessibility); // Accessibility analysis
```

### Using Specific Provider
```typescript
import { VisionManager, initializeVision } from '@soryos/vision';

// Use GPT-4 Vision
const manager = initializeVision('openai', {
  model: 'gpt-4-vision-preview',
  apiKey: 'your-api-key',
});

const result = await manager.analyze({
  image: blob,
  analysisType: 'description',
});
```

### Streaming Analysis
```typescript
import { VisionManager } from '@soryos/vision';

const manager = new VisionManager();

for await (const chunk of manager.streamAnalyze({
  image: blob,
  analysisType: 'description',
})) {
  console.log(chunk); // Streamed response chunks
}
```

## Integration with @soryos/images

The vision package integrates seamlessly with `@soryos/images`:

```typescript
import { ImageManager } from '@soryos/images';
import { VisionManager } from '@soryos/vision';

const imageManager = new ImageManager();
const visionManager = new VisionManager();

// Upload image
const uploadResult = await imageManager.upload(blob);

// Analyze with vision
const visionResult = await visionManager.analyze({
  image: uploadResult.blob,
  analysisType: 'description',
});

// Process image first (resize, compress)
const processedImage = await imageManager.process(blob, [
  { type: 'resize', params: { width: 1024 } },
  { type: 'compress', params: { quality: 0.8 } },
]);

// Then analyze
const result = await visionManager.analyze({
  image: processedImage.image,
  analysisType: 'ocr',
});
```

## Integration with Agent Tools

The vision package can be used with agent tools:

```typescript
import { AgentToolRegistry } from '@soryos/agent';
import { VisionManager } from '@soryos/vision';

const registry = new AgentToolRegistry();
const visionManager = new VisionManager();

// Register vision tool
registry.registerTool({
  name: 'vision_analyze',
  description: 'Analyze image with Vision AI',
  handler: async (params) => {
    return visionManager.analyze({
      image: params.image,
      analysisType: params.analysisType,
      prompt: params.prompt,
    });
  },
});
```

## Error Handling

The package automatically handles:
- Network errors with retries
- API rate limiting
- Invalid image data
- Unsupported image formats
- Size limit exceeded
- Provider authentication errors

## Security Considerations
- Never expose API keys in logs
- Validate all image inputs
- Check image sizes before processing
- Use HTTPS for all API requests
- Clean up resources when done

## Performance Considerations
- Preprocess images (resize, compress) before sending to API
- Use appropriate model based on task complexity
- Batch requests when possible
- Cache results for repeated analysis
- Use streaming for large responses

## Rate Limits and Costs

| Provider | Model | Cost per Image | Rate Limit |
|----------|-------|----------------|------------|
| Google | gemini-2.5-flash | ~$0.001 | 1000/min |
| Google | gemini-2.5-pro | ~$0.01 | 100/min |
| OpenAI | gpt-4-vision | ~$0.01-0.03 | 10/min |
| OpenAI | gpt-4o | ~$0.01-0.03 | Higher |
| Mistral | mistral-large | ~$0.002 | Varies |
| Anthropic | claude-3-sonnet | ~$0.003 | Varies |

## Best Practices
1. **Preprocess images** - Resize and compress before sending to API
2. **Use appropriate model** - Use faster models for simple tasks, more capable models for complex analysis
3. **Batch requests** - Combine multiple analysis types when possible
4. **Cache results** - Cache analysis results for repeated images
5. **Handle errors gracefully** - Provide fallback options when analysis fails
6. **Use streaming** - For large responses, use streaming to improve performance
7. **Validate inputs** - Always validate image data before processing
8. **Monitor costs** - Track API usage and costs

## Future Enhancements
- [ ] Real-time video analysis
- [ ] Batch image processing
- [ ] Image comparison and diffing
- [ ] Advanced image search
- [ ] 3D image support
- [ ] Medical image analysis
- [ ] Satellite image analysis
- [ ] Document layout analysis
- [ ] Handwriting recognition
- [ ] Barcode/QR code detection
