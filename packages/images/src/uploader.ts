/**
 * @soryos/images
 * Image Uploader - Image upload handling for various sources
 * 
 * Features:
 * - File upload from file input
 * - Drag and drop upload
 * - Clipboard paste upload
 * - Camera capture
 * - URL upload
 * - Progress tracking
 */

import {
  ImageUploadOptions,
  ImageUploadResult,
  ImageFormat,
  ImageProcessingState,
} from './types';

/**
 * Image uploader class for handling various upload sources
 */
export class ImageUploader {
  private state: ImageProcessingState = 'idle';
  private options: ImageUploadOptions;

  constructor(options: ImageUploadOptions = {}) {
    this.options = options;
  }

  /**
   * Check if image uploader is supported in the browser
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof FileReader !== 'undefined' &&
      typeof Blob !== 'undefined'
    );
  }

  /**
   * Upload image from file input
   */
  async uploadFromFile(file: File, options?: ImageUploadOptions): Promise<ImageUploadResult> {
    const mergedOptions = { ...this.options, ...options };

    // Validate file
    const validation = this.validateFile(file, mergedOptions);
    if (!validation.valid) {
      return {
        success: false,
        id: '',
        error: validation.error,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };
    }

    this.state = 'uploading';

    try {
      // Read file as data URL
      const dataUrl = await this.readFileAsDataUrl(file);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(dataUrl);

      // Generate unique ID
      const id = this.generateId();

      const result: ImageUploadResult = {
        success: true,
        id,
        url: dataUrl,
        base64: dataUrl,
        blob: file,
        file,
        format: this.getFormatFromFile(file),
        width: dimensions.width,
        height: dimensions.height,
        sizeBytes: file.size,
        sessionId: mergedOptions.sessionId,
        timestamp: Date.now(),
      };

      if (mergedOptions.onComplete) {
        mergedOptions.onComplete(result);
      }

      this.state = 'completed';
      return result;

    } catch (error) {
      this.state = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: ImageUploadResult = {
        success: false,
        id: '',
        error: errorMessage,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };

      if (mergedOptions.onError) {
        mergedOptions.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  }

  /**
   * Upload image from data URL
   */
  async uploadFromDataUrl(dataUrl: string, options?: ImageUploadOptions): Promise<ImageUploadResult> {
    const mergedOptions = { ...this.options, ...options };

    this.state = 'uploading';

    try {
      // Convert data URL to blob
      const blob = await this.dataUrlToBlob(dataUrl);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(dataUrl);

      // Generate unique ID
      const id = this.generateId();

      const result: ImageUploadResult = {
        success: true,
        id,
        url: dataUrl,
        base64: dataUrl,
        blob,
        format: this.getFormatFromBlob(blob),
        width: dimensions.width,
        height: dimensions.height,
        sizeBytes: blob.size,
        sessionId: mergedOptions.sessionId,
        timestamp: Date.now(),
      };

      if (mergedOptions.onComplete) {
        mergedOptions.onComplete(result);
      }

      this.state = 'completed';
      return result;

    } catch (error) {
      this.state = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: ImageUploadResult = {
        success: false,
        id: '',
        error: errorMessage,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };

      if (mergedOptions.onError) {
        mergedOptions.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  }

  /**
   * Upload image from URL
   */
  async uploadFromUrl(url: string, options?: ImageUploadOptions): Promise<ImageUploadResult> {
    const mergedOptions = { ...this.options, ...options };

    this.state = 'uploading';

    try {
      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const blob = await response.blob();

      // Validate blob
      const validation = this.validateBlob(blob, mergedOptions);
      if (!validation.valid) {
        return {
          success: false,
          id: '',
          error: validation.error,
          format: 'png',
          width: 0,
          height: 0,
          sizeBytes: 0,
          timestamp: Date.now(),
        };
      }

      // Convert to data URL for preview
      const dataUrl = URL.createObjectURL(blob);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(dataUrl);

      // Generate unique ID
      const id = this.generateId();

      const result: ImageUploadResult = {
        success: true,
        id,
        url: dataUrl,
        base64: await this.blobToDataUrl(blob),
        blob,
        format: this.getFormatFromBlob(blob),
        width: dimensions.width,
        height: dimensions.height,
        sizeBytes: blob.size,
        sessionId: mergedOptions.sessionId,
        timestamp: Date.now(),
      };

      if (mergedOptions.onComplete) {
        mergedOptions.onComplete(result);
      }

      this.state = 'completed';
      return result;

    } catch (error) {
      this.state = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: ImageUploadResult = {
        success: false,
        id: '',
        error: errorMessage,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };

      if (mergedOptions.onError) {
        mergedOptions.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  }

  /**
   * Upload image from clipboard
   */
  async uploadFromClipboard(options?: ImageUploadOptions): Promise<ImageUploadResult | null> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return null;
    }

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            return this.uploadFromBlob(blob, options);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[Images] Failed to read from clipboard:', error);
      return null;
    }
  }

  /**
   * Upload image from blob
   */
  async uploadFromBlob(blob: Blob, options?: ImageUploadOptions): Promise<ImageUploadResult> {
    const mergedOptions = { ...this.options, ...options };

    // Validate blob
    const validation = this.validateBlob(blob, mergedOptions);
    if (!validation.valid) {
      return {
        success: false,
        id: '',
        error: validation.error,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };
    }

    this.state = 'uploading';

    try {
      // Convert to data URL
      const dataUrl = await this.blobToDataUrl(blob);

      // Get image dimensions
      const dimensions = await this.getImageDimensions(dataUrl);

      // Generate unique ID
      const id = this.generateId();

      const result: ImageUploadResult = {
        success: true,
        id,
        url: dataUrl,
        base64: dataUrl,
        blob,
        format: this.getFormatFromBlob(blob),
        width: dimensions.width,
        height: dimensions.height,
        sizeBytes: blob.size,
        sessionId: mergedOptions.sessionId,
        timestamp: Date.now(),
      };

      if (mergedOptions.onComplete) {
        mergedOptions.onComplete(result);
      }

      this.state = 'completed';
      return result;

    } catch (error) {
      this.state = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: ImageUploadResult = {
        success: false,
        id: '',
        error: errorMessage,
        format: 'png',
        width: 0,
        height: 0,
        sizeBytes: 0,
        timestamp: Date.now(),
      };

      if (mergedOptions.onError) {
        mergedOptions.onError(error instanceof Error ? error : new Error(errorMessage));
      }

      throw error;
    }
  }

  /**
   * Capture image from camera
   */
  async captureFromCamera(options?: ImageUploadOptions & { 
    videoElement?: HTMLVideoElement;
    canvasElement?: HTMLCanvasElement;
  }): Promise<ImageUploadResult> {
    if (typeof document === 'undefined') {
      throw new Error('Camera capture requires a browser environment');
    }

    const mergedOptions = { ...this.options, ...options };

    return new Promise((resolve, reject) => {
      // Check if we have video element
      let videoElement = mergedOptions.videoElement;
      let canvasElement = mergedOptions.canvasElement;

      const cleanup = () => {
        if (videoElement && videoElement.srcObject) {
          (videoElement.srcObject as MediaStream).getTracks().forEach(track => track.stop());
          videoElement.srcObject = null;
        }
      };

      try {
        // Create video element if not provided
        if (!videoElement) {
          videoElement = document.createElement('video');
          videoElement.autoplay = true;
          videoElement.playsInline = true;
        }

        // Create canvas element if not provided
        if (!canvasElement) {
          canvasElement = document.createElement('canvas');
        }

        // Get user media
        navigator.mediaDevices.getUserMedia({ video: true })
          .then(stream => {
            videoElement!.srcObject = stream;
            
            // Wait for video to be ready
            videoElement!.onloadedmetadata = () => {
              // Set canvas dimensions
              canvasElement!.width = videoElement!.videoWidth;
              canvasElement!.height = videoElement!.videoHeight;

              // Draw video frame to canvas
              const ctx = canvasElement!.getContext('2d');
              ctx!.drawImage(videoElement!, 0, 0, canvasElement!.width, canvasElement!.height);

              // Convert canvas to blob
              canvasElement!.toBlob(blob => {
                if (!blob) {
                  cleanup();
                  reject(new Error('Failed to capture image from camera'));
                  return;
                }

                cleanup();
                
                // Upload the blob
                this.uploadFromBlob(blob, mergedOptions)
                  .then(result => resolve(result))
                  .catch(error => {
                    cleanup();
                    reject(error);
                  });
              }, 'image/png');
            };

            // Timeout for camera access
            setTimeout(() => {
              cleanup();
              reject(new Error('Camera access timeout'));
            }, 10000);
          })
          .catch(error => {
            cleanup();
            reject(error);
          });

      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File, options: ImageUploadOptions): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File is not an image' };
    }

    // Check file size
    const maxSizeBytes = (options.maxSizeMB || 10) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${options.maxSizeMB || 10}MB limit` };
    }

    // Check format
    const format = this.getFormatFromFile(file);
    const allowedFormats = options.allowedFormats || ['png', 'jpeg', 'jpg', 'webp', 'gif'];
    if (!allowedFormats.includes(format)) {
      return { valid: false, error: `Image format ${format} is not allowed` };
    }

    return { valid: true };
  }

  /**
   * Validate blob before upload
   */
  private validateBlob(blob: Blob, options: ImageUploadOptions): { valid: boolean; error?: string } {
    // Check blob type
    if (!blob.type.startsWith('image/')) {
      return { valid: false, error: 'Blob is not an image' };
    }

    // Check blob size
    const maxSizeBytes = (options.maxSizeMB || 10) * 1024 * 1024;
    if (blob.size > maxSizeBytes) {
      return { valid: false, error: `Blob size exceeds ${options.maxSizeMB || 10}MB limit` };
    }

    // Check format
    const format = this.getFormatFromBlob(blob);
    const allowedFormats = options.allowedFormats || ['png', 'jpeg', 'jpg', 'webp', 'gif'];
    if (!allowedFormats.includes(format)) {
      return { valid: false, error: `Image format ${format} is not allowed` };
    }

    return { valid: true };
  }

  /**
   * Read file as data URL
   */
  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert data URL to blob
   */
  private dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      fetch(dataUrl)
        .then(response => response.blob())
        .then(blob => resolve(blob))
        .catch(error => reject(error));
    });
  }

  /**
   * Get image dimensions from data URL
   */
  private async getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to get image dimensions'));
      img.src = dataUrl;
    });
  }

  /**
   * Get format from file
   */
  private getFormatFromFile(file: File): ImageFormat {
    const type = file.type.toLowerCase();
    if (type.includes('jpeg') || type.includes('jpg')) return 'jpeg';
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('gif')) return 'gif';
    if (type.includes('svg')) return 'svg';
    if (type.includes('bmp')) return 'bmp';
    return 'png';
  }

  /**
   * Get format from blob
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
   * Generate unique ID
   */
  private generateId(): string {
    return `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current state
   */
  getState(): ImageProcessingState {
    return this.state;
  }
}

/**
 * Create a new image uploader instance
 */
export function createImageUploader(options?: ImageUploadOptions): ImageUploader {
  return new ImageUploader(options);
}

/**
 * Singleton image uploader instance
 */
let globalImageUploader: ImageUploader | null = null;

/**
 * Get or create the global image uploader
 */
export function getImageUploader(options?: ImageUploadOptions): ImageUploader {
  if (!globalImageUploader) {
    globalImageUploader = new ImageUploader(options);
  }
  return globalImageUploader;
}

/**
 * Set the global image uploader
 */
export function setImageUploader(uploader: ImageUploader): void {
  globalImageUploader = uploader;
}

/**
 * Setup drag and drop upload on an element
 */
export function setupDragAndDrop(
  element: HTMLElement,
  onDrop: (files: File[]) => void,
  options?: {
    accept?: string;
    multiple?: boolean;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDragOver?: () => void;
  }
): void {
  if (typeof document === 'undefined') {
    return;
  }

  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (options?.onDragOver) options.onDragOver();
  });

  element.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (options?.onDragEnter) options.onDragEnter();
  });

  element.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (options?.onDragLeave) options.onDragLeave();
  });

  element.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      // Filter for images only
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onDrop(imageFiles);
      }
    }
  });
}

/**
 * Setup clipboard paste on an element
 */
export function setupClipboardPaste(
  element: HTMLElement,
  onPaste: (blob: Blob) => void,
  options?: {
    onError?: (error: Error) => void;
  }
): void {
  if (typeof document === 'undefined') {
    return;
  }

  element.addEventListener('paste', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const clipboardItems = await navigator.clipboard.read();
      
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            onPaste(blob);
            return;
          }
        }
      }
    } catch (error) {
      if (options?.onError) {
        options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
}
