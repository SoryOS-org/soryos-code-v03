# `@soryos/images` Agent Operating Guidelines

## Overview
This package provides comprehensive image input capabilities for SoryOS-Code, inspired by Vibra Code's mobile image input implementation. Enables users to interact with agents using images for analysis, OCR, and design feedback.

## Responsibilities
- Provide `ImageManager` singleton for unified image operations
- Image upload from various sources (file, URL, clipboard, camera)
- Image processing (resize, crop, rotate, compress, convert, filter, enhance)
- Vision AI analysis (description, OCR, object detection, color analysis)
- Mockup/image analysis for design feedback
- Drag and drop support for web interfaces
- Clipboard paste support

## Key Files
- `src/index.ts`: Main exports and ImageManager class
- `src/uploader.ts`: ImageUploader class with multiple upload sources
- `src/processor.ts`: ImageProcessor class with image manipulation
- `src/metadata.ts`: Server-side `readImageInfo`/`detectImageFormat` (magic bytes + header parsing, NO browser required)
- `src/types.ts`: Type definitions for image operations

## Integration with `@soryos/tool`
The `image_info` tool (`packages/tool/src/image-tools.ts`) reads images from disk/URL and parses them with `readImageInfo` — the only part of this package that runs in a server process. The `ImageProcessor` (canvas) and `ImageUploader` (FileReader/URL.createObjectURL) remain browser-only and are NOT usable from agent tools.

## Architecture
```
ImageManager
├── ImageUploader
│   ├── File upload
│   ├── URL upload
│   ├── Clipboard paste upload
│   ├── Camera capture
│   └── Drag and drop support
└── ImageProcessor
    ├── Resize
    ├── Crop
    ├── Rotate
    ├── Compress
    ├── Convert format
    ├── Apply filters
    └── Enhance
```

## Agent Guidelines
- Use `ImageManager` for all image operations
- Always validate image files before processing
- Handle image upload errors gracefully
- Clean up resources when done
- Provide visual feedback during upload and processing
- Never process images without user consent
- Handle large images efficiently

## Image Sources

### File Upload
- **Description**: Upload images from file input
- **Formats**: PNG, JPEG, WebP, GIF, SVG, BMP
- **Size Limit**: Configurable (default 10MB)
- **Status**: ✅ Fully supported

### URL Upload
- **Description**: Upload images from remote URLs
- **Features**: Automatic fetch and validation
- **CORS**: Requires CORS headers on the source
- **Status**: ✅ Fully supported

### Clipboard Paste
- **Description**: Paste images from clipboard
- **Formats**: All standard image formats
- **Browser Support**: Chrome, Firefox, Edge, Safari
- **Status**: ✅ Fully supported

### Camera Capture
- **Description**: Capture images from device camera
- **Features**: Real-time capture, auto-focus
- **Permissions**: Requires camera permission
- **Status**: ✅ Fully supported

### Drag and Drop
- **Description**: Drag and drop images onto target elements
- **Features**: Multiple file support, visual feedback
- **Status**: ✅ Fully supported

## Image Processing

### Resize
- **Description**: Resize images to specific dimensions
- **Features**: Maintain aspect ratio, custom dimensions
- **Status**: ✅ Supported

### Crop
- **Description**: Crop images to specific regions
- **Features**: Custom crop areas, aspect ratio preservation
- **Status**: ✅ Supported

### Rotate
- **Description**: Rotate images by specified degrees
- **Features**: 90°, 180°, 270°, custom angles
- **Status**: ✅ Supported

### Compress
- **Description**: Compress images to reduce file size
- **Features**: Adjustable quality, format conversion
- **Status**: ✅ Supported

### Convert Format
- **Description**: Convert images between formats
- **Formats**: PNG, JPEG, WebP, GIF
- **Status**: ✅ Supported

### Filters
- **Description**: Apply visual filters to images
- **Filters**: Grayscale, Sepia, Invert, Blur, Brightness, Contrast
- **Status**: ✅ Supported

### Enhance
- **Description**: Auto-enhance image quality
- **Features**: Automatic contrast and brightness adjustment
- **Status**: ✅ Supported

## Vision AI Analysis (Planned)

The package is designed to integrate with Vision AI models for advanced analysis:

### Image Description
- **Providers**: Gemini Vision, GPT-4 Vision, Mistral Vision, Claude Vision
- **Features**: Generate textual descriptions of images
- **Status**: ⚠️ Requires Vision AI provider integration

### OCR (Text Recognition)
- **Features**: Extract text from images
- **Output**: Structured text with bounding boxes
- **Status**: ⚠️ Requires Vision AI provider integration

### Object Detection
- **Features**: Detect and classify objects in images
- **Output**: Objects with labels, confidence scores, and bounding boxes
- **Status**: ⚠️ Requires Vision AI provider integration

### Color Analysis
- **Features**: Extract color palette from images
- **Output**: Dominant colors with percentages
- **Status**: ⚠️ Requires Vision AI provider integration

## Mockup Analysis

For design feedback, the package supports mockup analysis:

### Layout Analysis
- **Features**: Detect layout elements (headers, buttons, cards, etc.)
- **Output**: Structured layout information
- **Status**: ⚠️ Requires Vision AI provider integration

### Design Suggestions
- **Features**: Generate design improvement suggestions
- **Output**: Actionable feedback for designers
- **Status**: ⚠️ Requires Vision AI provider integration

## Usage Examples

### Basic Upload
```typescript
import { ImageManager } from '@soryos/images';

const manager = new ImageManager();

// From file
const fileResult = await manager.upload(file);

// From URL
const urlResult = await manager.upload('https://example.com/image.png');

// From clipboard
const clipboardResult = await manager.uploader.uploadFromClipboard();
```

### Image Processing
```typescript
import { ImageManager } from '@soryos/images';

const manager = new ImageManager();

// Resize
const resized = await manager.process(image, [
  { type: 'resize', params: { width: 800, height: 600, maintainAspectRatio: true } }
]);

// Crop
const cropped = await manager.process(image, [
  { type: 'crop', params: { x: 100, y: 100, width: 400, height: 400 } }
]);

// Rotate
const rotated = await manager.process(image, [
  { type: 'rotate', params: { degrees: 90 } }
]);

// Compress
const compressed = await manager.process(image, [
  { type: 'compress', params: { quality: 0.8, format: 'jpeg' } }
]);

// Multiple operations
const processed = await manager.process(image, [
  { type: 'resize', params: { width: 800 } },
  { type: 'compress', params: { quality: 0.8 } },
  { type: 'convert', params: { format: 'webp' } }
]);
```

### Drag and Drop Setup
```typescript
import { setupDragAndDrop } from '@soryos/images';

const dropZone = document.getElementById('drop-zone');
setupDragAndDrop(dropZone, (files) => {
  console.log('Files dropped:', files);
  // Handle files
});
```

### Camera Capture
```typescript
import { ImageManager } from '@soryos/images';

const manager = new ImageManager();
const result = await manager.captureFromCamera();
console.log('Captured image:', result);
```

## Browser Compatibility
- Chrome: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (with some limitations)
- Edge: ✅ Full support

## Security Considerations
- Always request camera permission explicitly
- Validate all uploaded images
- Check file sizes and formats
- Clean up resources when done
- Never process images without user consent

## Error Handling
- File type not supported
- File size exceeds limit
- Camera permission denied
- Invalid image data
- Network errors for URL uploads
- Clipboard access denied

## Future Enhancements
- [ ] Vision AI integration (Gemini Vision, GPT-4 Vision, etc.)
- [ ] Real-time image analysis
- [ ] Batch image processing
- [ ] Image comparison and diffing
- [ ] Advanced image filters
- [ ] Image annotation tools
- [ ] Image search and similarity
- [ ] 3D image support
