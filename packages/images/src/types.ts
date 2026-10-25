/**
 * @soryos/images
 * Image Input Types and Interfaces
 */

/**
 * Image provider types
 */
export type ImageProvider = 'browser' | 'clipboard' | 'file-upload' | 'camera' | 'url';

/**
 * Image format types
 */
export type ImageFormat = 'png' | 'jpeg' | 'jpg' | 'webp' | 'gif' | 'svg' | 'bmp' | 'tiff';

/**
 * Image analysis types
 */
export type ImageAnalysisType = 'description' | 'ocr' | 'objects' | 'colors' | 'faces' | 'text' | 'layout' | 'custom';

/**
 * Vision model types
 */
export type VisionModel = 'gemini-vision' | 'gpt-4-vision' | 'mistral-vision' | 'claude-vision' | 'local';

/**
 * Image processing state
 */
export type ImageProcessingState = 'idle' | 'uploading' | 'processing' | 'analyzing' | 'completed' | 'error';

/**
 * Image upload options
 */
export interface ImageUploadOptions {
  sessionId?: string;
  maxSizeMB?: number;
  allowedFormats?: ImageFormat[];
  maxDimensions?: { width: number; height: number };
  autoCompress?: boolean;
  compressQuality?: number; // 0-1
  onProgress?: (progress: number) => void;
  onComplete?: (result: ImageUploadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Image upload result
 */
export interface ImageUploadResult {
  success: boolean;
  id: string;
  url?: string;
  base64?: string;
  blob?: Blob;
  file?: File;
  format: ImageFormat;
  width: number;
  height: number;
  sizeBytes: number;
  sessionId?: string;
  timestamp: number;
  error?: string;
}

/**
 * Image processing options
 */
export interface ImageProcessingOptions {
  sessionId?: string;
  image: Blob | File | string | HTMLImageElement | ImageData;
  operations?: ImageOperation[];
  onProgress?: (progress: number) => void;
  onComplete?: (result: ImageProcessingResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Image operation types
 */
export interface ImageOperation {
  type: 'resize' | 'crop' | 'rotate' | 'compress' | 'convert' | 'filter' | 'enhance';
  params?: Record<string, unknown>;
}

/**
 * Image processing result
 */
export interface ImageProcessingResult {
  success: boolean;
  image: Blob | string;
  format: ImageFormat;
  width: number;
  height: number;
  sizeBytes: number;
  operationsApplied: ImageOperation[];
  timestamp: number;
  error?: string;
}

/**
 * Image analysis options
 */
export interface ImageAnalysisOptions {
  sessionId?: string;
  image: Blob | File | string | HTMLImageElement;
  analysisType?: ImageAnalysisType;
  provider?: VisionModel;
  model?: string;
  prompt?: string; // For custom analysis
  maxTokens?: number;
  onProgress?: (partialResult: Partial<ImageAnalysisResult>) => void;
  onComplete?: (result: ImageAnalysisResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Image analysis result
 */
export interface ImageAnalysisResult<T = any> {
  success: boolean;
  analysisType: ImageAnalysisType;
  provider: VisionModel;
  model?: string;
  results: T[];
  timestamp: number;
  error?: string;
  sessionId?: string;
}

/**
 * Image analysis data (varies by analysis type)
 */
export interface ImageAnalysisData {
  type: string;
  content: string;
  confidence?: number;
  boundingBox?: { x: number; y: number; width: number; height: number };
  metadata?: Record<string, unknown>;
}

/**
 * OCR (text recognition) result
 */
export interface OCRResult extends ImageAnalysisResult {
  analysisType: 'ocr';
  results: OCRTextRegion[];
  fullText: string;
}

/**
 * OCR text region
 */
export interface OCRTextRegion {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  language?: string;
  lines?: OCRTextLine[];
}

/**
 * OCR text line
 */
export interface OCRTextLine {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  words?: OCRWord[];
}

/**
 * OCR word
 */
export interface OCRWord {
  text: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
}

/**
 * Object detection result
 */
export interface ObjectDetectionResult extends ImageAnalysisResult {
  analysisType: 'objects';
  results: DetectedObject[];
}

/**
 * Detected object
 */
export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: { x: number; y: number; width: number; height: number };
  category?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Image description result
 */
export interface ImageDescriptionResult extends ImageAnalysisResult {
  analysisType: 'description';
  results: ImageDescription[];
  summary: string;
}

/**
 * Image description
 */
export interface ImageDescription {
  text: string;
  confidence?: number;
  type?: 'caption' | 'detailed' | 'tags';
}

/**
 * Image input event types
 */
export type ImageEventType =
  | 'upload.started'
  | 'upload.progress'
  | 'upload.completed'
  | 'upload.error'
  | 'processing.started'
  | 'processing.progress'
  | 'processing.completed'
  | 'processing.error'
  | 'analysis.started'
  | 'analysis.progress'
  | 'analysis.completed'
  | 'analysis.error'
  | 'image.input';

/**
 * Image event payload
 */
export interface ImageEventPayload {
  type: ImageEventType;
  sessionId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Image input result for agent
 */
export interface ImageInputResult {
  success: boolean;
  image?: Blob | string;
  analysis?: ImageAnalysisResult;
  upload?: ImageUploadResult;
  processing?: ImageProcessingResult;
  error?: string;
  timestamp: number;
  sessionId?: string;
}

/**
 * Image capabilities
 */
export interface ImageCapabilities {
  upload: boolean;
  processing: boolean;
  analysis: boolean;
  camera: boolean;
  clipboard: boolean;
  providers: VisionModel[];
  formats: ImageFormat[];
  maxSizeMB: number;
}

/**
 * Image session state
 */
export interface ImageSessionState {
  sessionId: string;
  uploadState: ImageProcessingState;
  processingState: ImageProcessingState;
  analysisState: ImageProcessingState;
  currentImage?: ImageUploadResult;
  currentAnalysis?: ImageAnalysisResult;
  lastError?: Error;
}

/**
 * Mockup/image input for design analysis
 */
export interface MockupInput {
  sessionId?: string;
  image: Blob | File | string;
  description?: string;
  analyzeLayout?: boolean;
  extractText?: boolean;
  detectColors?: boolean;
}

/**
 * Mockup analysis result
 */
export interface MockupAnalysisResult {
  layout?: {
    elements: LayoutElement[];
    structure: string;
  };
  text?: string;
  colors?: ColorPalette;
  suggestions?: string[];
}

/**
 * Layout element
 */
export interface LayoutElement {
  type: 'header' | 'footer' | 'navigation' | 'button' | 'input' | 'card' | 'text' | 'image' | 'container';
  boundingBox: { x: number; y: number; width: number; height: number };
  text?: string;
  confidence?: number;
}

/**
 * Color palette
 */
export interface ColorPalette {
  primary?: string;
  secondary?: string;
  background?: string;
  text?: string;
  accent?: string;
  colors: ColorInfo[];
}

/**
 * Color information
 */
export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  percentage: number;
}
