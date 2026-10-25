/**
 * @soryos/images
 * Image Input Package - Main exports
 * 
 * Provides comprehensive image input capabilities for SoryOS-Code:
 * - Image upload from various sources (file, URL, clipboard, camera)
 * - Image processing (resize, crop, rotate, compress, convert, filter)
 * - Vision AI analysis (description, OCR, object detection)
 * - Mockup/image analysis for design
 * - Drag and drop support
 */

// Re-export types
export * from './types';

// Re-export uploader
export * from './uploader';

// Re-export processor
export * from './processor';

// Re-export server-side metadata parsing (no browser required)
export * from './metadata';

// Main exports
import { 
  ImageUploader, 
  createImageUploader, 
  getImageUploader, 
  setImageUploader,
  setupDragAndDrop,
  setupClipboardPaste
} from './uploader';

import { 
  ImageProcessor, 
  createImageProcessor, 
  getImageProcessor, 
  setImageProcessor
} from './processor';

// Image manager class for unified interface
export class ImageManager {
  private uploader: ImageUploader;
  private processor: ImageProcessor;

  constructor(options?: any) {
    this.uploader = createImageUploader(options);
    this.processor = createImageProcessor();
  }

  /**
   * Upload image from various sources
   */
  async upload(source: File | Blob | string, options?: any): Promise<any> {
    if (source instanceof File) {
      return this.uploader.uploadFromFile(source, options);
    } else if (source instanceof Blob) {
      return this.uploader.uploadFromBlob(source, options);
    } else if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        return this.uploader.uploadFromDataUrl(source, options);
      } else {
        return this.uploader.uploadFromUrl(source, options);
      }
    }
    throw new Error('Unsupported image source type');
  }

  /**
   * Capture image from camera
   */
  async captureFromCamera(options?: any): Promise<any> {
    return this.uploader.captureFromCamera(options);
  }

  /**
   * Process image with operations
   */
  async process(image: any, operations?: any): Promise<any> {
    return this.processor.process({ image, operations });
  }

  /**
   * Get uploader
   */
  getUploader(): ImageUploader {
    return this.uploader;
  }

  /**
   * Get processor
   */
  getProcessor(): ImageProcessor {
    return this.processor;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cleanup any resources if needed
  }
}

// Singleton image manager
export const imageManager = new ImageManager();

// Initialize image manager
export async function initializeImages(options?: any): Promise<ImageManager> {
  return imageManager;
}
