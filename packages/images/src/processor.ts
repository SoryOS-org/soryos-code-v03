/**
 * @soryos/images
 * Image Processor - Image manipulation and processing
 * 
 * Features:
 * - Image resizing
 * - Image cropping
 * - Image rotation
 * - Image compression
 * - Format conversion
 * - Image filtering
 * - Image enhancement
 */

import {
  ImageFormat,
  ImageProcessingOptions,
  ImageProcessingResult,
  ImageOperation,
  ImageUploadResult,
} from './types';

/**
 * Image processor class for client-side image manipulation
 */
export class ImageProcessor {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    // Canvas is created on-demand
  }

  /**
   * Create canvas if not exists
   */
  private createCanvas(width: number, height: number): void {
    if (typeof document === 'undefined') {
      throw new Error('Image processing requires a browser environment');
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Load image from various sources
   */
  private async loadImage(source: Blob | File | string | HTMLImageElement | ImageData): Promise<HTMLImageElement> {
    if (typeof document === 'undefined') {
      throw new Error('Image processing requires a browser environment');
    }

    return new Promise((resolve, reject) => {
      let img: HTMLImageElement;

      if (typeof source === 'string') {
        img = new Image();
        if (source.startsWith('data:')) {
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load image from data URL'));
          img.src = source;
        } else {
          fetch(source)
            .then(response => response.blob())
            .then(blob => {
              const url = URL.createObjectURL(blob);
              img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
              };
              img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image from URL'));
              };
              img.src = url;
            })
            .catch(error => reject(error));
        }
        return;
      }

      if (source instanceof HTMLImageElement) {
        resolve(source);
        return;
      }

      img = new Image();

      if (source instanceof Blob) {
        const url = URL.createObjectURL(source);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image from blob'));
        };
        img.src = url;
      } else {
        reject(new Error('Unsupported image source type'));
      }
    });
  }

  /**
   * Process image with multiple operations
   */
  async process(options: ImageProcessingOptions): Promise<ImageProcessingResult> {
    const startTime = Date.now();

    try {
      // Load the image
      const img = await this.loadImage(options.image);

      // Create canvas
      this.createCanvas(img.width, img.height);
      if (!this.ctx || !this.canvas) {
        throw new Error('Failed to create canvas');
      }

      // Draw original image
      this.ctx.drawImage(img, 0, 0);

      // Apply operations in sequence
      const operationsApplied: ImageOperation[] = [];
      let currentImage: Blob = await this.toBlob(this.canvas, options.operations?.find(op => op.type === 'convert')?.params?.format as ImageFormat || 'png');

      // Apply each operation
      if (options.operations) {
        for (const operation of options.operations) {
          const result = await this.applyOperation(operation, currentImage);
          currentImage = typeof result.image === 'string' ? await this.dataUrlToBlob(result.image) : result.image;
          operationsApplied.push(operation);
        }
      } else {
        // No operations, just convert to blob
        operationsApplied.push({ type: 'convert', params: { format: 'png' } });
      }

      // Get final blob
      const finalBlob = currentImage;

      const result: ImageProcessingResult = {
        success: true,
        image: finalBlob,
        format: this.getFormatFromBlob(finalBlob),
        width: this.canvas.width,
        height: this.canvas.height,
        sizeBytes: finalBlob.size,
        operationsApplied,
        timestamp: Date.now(),
      };

      if (options.onComplete) {
        options.onComplete(result);
      }

      return result;

    } catch (error) {
      const result: ImageProcessingResult = {
        success: false,
        image: '',
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        operationsApplied: [],
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error),
      };

      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }

      throw error;
    }
  }

  /**
   * Apply a single operation to an image
   */
  private async applyOperation(
    operation: ImageOperation,
    image: Blob | string
  ): Promise<{ image: Blob | string }> {
    const img = await this.loadImage(image);
    
    switch (operation.type) {
      case 'resize':
        return { image: await this.resize(img, operation.params) };
      case 'crop':
        return { image: await this.crop(img, operation.params) };
      case 'rotate':
        return { image: await this.rotate(img, operation.params) };
      case 'compress':
        return { image: await this.compress(img, operation.params) };
      case 'convert':
        return { image: await this.convert(img, operation.params) };
      case 'filter':
        return { image: await this.applyFilter(img, operation.params) };
      case 'enhance':
        return { image: await this.enhance(img, operation.params) };
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Resize image
   */
  async resize(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const width = params?.width as number || img.width;
    const height = params?.height as number || img.height;
    const maintainAspectRatio = params?.maintainAspectRatio !== false;

    let finalWidth = width;
    let finalHeight = height;

    if (maintainAspectRatio) {
      const ratio = img.width / img.height;
      if (width / height > ratio) {
        finalWidth = Math.round(height * ratio);
      } else {
        finalHeight = Math.round(width / ratio);
      }
    }

    this.createCanvas(finalWidth, finalHeight);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
    return this.toBlob(this.canvas, params?.format as ImageFormat || 'png');
  }

  /**
   * Crop image
   */
  async crop(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const x = params?.x as number || 0;
    const y = params?.y as number || 0;
    const width = params?.width as number || img.width;
    const height = params?.height as number || img.height;

    this.createCanvas(width, height);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
    return this.toBlob(this.canvas, params?.format as ImageFormat || 'png');
  }

  /**
   * Rotate image
   */
  async rotate(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const degrees = params?.degrees as number || 90;
    const radians = (degrees * Math.PI) / 180;

    // Calculate new dimensions
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    const newWidth = Math.round(img.width * cos + img.height * sin);
    const newHeight = Math.round(img.height * cos + img.width * sin);

    this.createCanvas(newWidth, newHeight);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    // Translate to center
    this.ctx.translate(newWidth / 2, newHeight / 2);
    this.ctx.rotate(radians);
    
    // Draw image centered
    this.ctx.drawImage(img, -img.width / 2, -img.height / 2);
    
    return this.toBlob(this.canvas, params?.format as ImageFormat || 'png');
  }

  /**
   * Compress image
   */
  async compress(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const quality = params?.quality as number || 0.8;
    const format = params?.format as ImageFormat || 'jpeg';

    this.createCanvas(img.width, img.height);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, 0, 0);
    return this.toBlob(this.canvas, format, quality);
  }

  /**
   * Convert image format
   */
  async convert(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const format = params?.format as ImageFormat || 'png';

    this.createCanvas(img.width, img.height);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, 0, 0);
    return this.toBlob(this.canvas, format);
  }

  /**
   * Apply filter to image
   */
  async applyFilter(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    const filterType = params?.type as string || 'grayscale';

    this.createCanvas(img.width, img.height);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, 0, 0);

    // Apply filter
    switch (filterType) {
      case 'grayscale':
        this.applyGrayscale();
        break;
      case 'sepia':
        this.applySepia();
        break;
      case 'invert':
        this.applyInvert();
        break;
      case 'blur':
        this.applyBlur(params?.radius as number || 5);
        break;
      case 'brightness':
        this.applyBrightness(params?.value as number || 1.2);
        break;
      case 'contrast':
        this.applyContrast(params?.value as number || 1.2);
        break;
      default:
        throw new Error(`Unknown filter type: ${filterType}`);
    }

    return this.toBlob(this.canvas, params?.format as ImageFormat || 'png');
  }

  /**
   * Enhance image
   */
  async enhance(img: HTMLImageElement, params?: Record<string, unknown>): Promise<Blob> {
    this.createCanvas(img.width, img.height);
    if (!this.ctx || !this.canvas) {
      throw new Error('Failed to create canvas');
    }

    this.ctx.drawImage(img, 0, 0);

    // Apply auto-enhancements
    this.applyContrast(1.1);
    this.applyBrightness(1.1);

    return this.toBlob(this.canvas, params?.format as ImageFormat || 'png');
  }

  /**
   * Apply grayscale filter
   */
  private applyGrayscale(): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg;     // R
      data[i + 1] = avg; // G
      data[i + 2] = avg; // B
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply sepia filter
   */
  private applySepia(): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      data[i] = Math.min(255, Math.round(r * 0.393 + g * 0.769 + b * 0.189));
      data[i + 1] = Math.min(255, Math.round(r * 0.349 + g * 0.686 + b * 0.168));
      data[i + 2] = Math.min(255, Math.round(r * 0.272 + g * 0.534 + b * 0.131));
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply invert filter
   */
  private applyInvert(): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];     // R
      data[i + 1] = 255 - data[i + 1]; // G
      data[i + 2] = 255 - data[i + 2]; // B
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply blur filter (simplified box blur)
   */
  private applyBlur(radius: number = 5): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Simple blur implementation
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, a = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.max(0, Math.min(width - 1, x + dx));
            const ny = Math.max(0, Math.min(height - 1, y + dy));
            const nIndex = (ny * width + nx) * 4;

            r += data[nIndex];
            g += data[nIndex + 1];
            b += data[nIndex + 2];
            a += data[nIndex + 3];
            count++;
          }
        }

        data[index] = r / count;
        data[index + 1] = g / count;
        data[index + 2] = b / count;
        data[index + 3] = a / count;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply brightness adjustment
   */
  private applyBrightness(value: number = 1.2): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, data[i] * value));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * value));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * value));
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply contrast adjustment
   */
  private applyContrast(value: number = 1.2): void {
    if (!this.ctx || !this.canvas) return;

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    const factor = (259 * (value + 255)) / (255 * (259 - value));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Convert canvas to blob
   */
  private toBlob(canvas: HTMLCanvasElement, format: ImageFormat = 'png', quality: number = 1.0): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        `image/${format}`,
        quality
      );
    });
  }

  /**
   * Convert data URL to blob
   */
  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }

  /**
   * Get image format from blob
   */
  private getFormatFromBlob(blob: Blob): ImageFormat {
    const type = blob.type.toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('svg')) return 'svg';
    if (type.includes('bmp')) return 'bmp';
    return 'png';
  }

  /**
   * Get image dimensions from blob
   */
  async getDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    const img = await this.loadImage(blob);
    return { width: img.width, height: img.height };
  }

  /**
   * Validate image (check if it's a valid image)
   */
  async validate(image: Blob | File | string): Promise<boolean> {
    try {
      await this.loadImage(image);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if image exceeds size limit
   */
  checkSizeLimit(blob: Blob, maxSizeMB: number = 10): boolean {
    return blob.size <= maxSizeMB * 1024 * 1024;
  }

  /**
   * Check if image format is allowed
   */
  checkFormat(blob: Blob, allowedFormats: ImageFormat[] = ['png', 'jpeg', 'jpg', 'webp', 'gif']): boolean {
    const format = this.getFormatFromBlob(blob);
    return allowedFormats.includes(format);
  }
}

/**
 * Create a new image processor instance
 */
export function createImageProcessor(): ImageProcessor {
  return new ImageProcessor();
}

/**
 * Singleton image processor instance
 */
let globalImageProcessor: ImageProcessor | null = null;

/**
 * Get or create the global image processor
 */
export function getImageProcessor(): ImageProcessor {
  if (!globalImageProcessor) {
    globalImageProcessor = new ImageProcessor();
  }
  return globalImageProcessor;
}

/**
 * Set the global image processor
 */
export function setImageProcessor(processor: ImageProcessor): void {
  globalImageProcessor = processor;
}
