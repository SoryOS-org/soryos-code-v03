/**
 * @soryos/vision
 * Vision AI Types and Interfaces
 */

/**
 * Vision provider types
 */
export type VisionProvider = 'gemini' | 'openai' | 'mistral' | 'anthropic' | 'local';

/**
 * Vision model types
 */
export type VisionModel = 
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  | 'gpt-4-vision-preview'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'mistral-large-latest'
  | 'codestral-latest'
  | 'claude-3-haiku'
  | 'claude-3-sonnet'
  | 'claude-3-opus'
  | 'claude-4'
  | 'claude-4-sonnet'
  | 'claude-4-opus'
  | 'local';

/**
 * Analysis types for vision
 */
export type VisionAnalysisType = 
  | 'description'
  | 'ocr'
  | 'objects'
  | 'text'
  | 'layout'
  | 'colors'
  | 'faces'
  | 'custom';

/**
 * Vision task types
 */
export type VisionTaskType = 
  | 'describe'
  | 'extract_text'
  | 'detect_objects'
  | 'analyze_layout'
  | 'detect_colors'
  | 'detect_faces'
  | 'answer_question'
  | 'custom_prompt';

/**
 * Vision processing state
 */
export type VisionProcessingState = 
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'analyzing'
  | 'completed'
  | 'error';

/**
 * Vision configuration
 */
export interface VisionConfig {
  provider: VisionProvider;
  model: VisionModel;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Default vision configuration
 */
export const DEFAULT_VISION_CONFIG: VisionConfig = {
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  timeout: 120000, // 2 minutes
  maxTokens: 4096,
  temperature: 0.7,
};

/**
 * Vision analysis options
 */
export interface VisionAnalysisOptions {
  sessionId?: string;
  image: Blob | File | string | Uint8Array;
  analysisType?: VisionAnalysisType;
  taskType?: VisionTaskType;
  prompt?: string;
  model?: VisionModel;
  provider?: VisionProvider;
  maxTokens?: number;
  temperature?: number;
  onProgress?: (partialResult: Partial<VisionAnalysisResult>) => void;
  onComplete?: (result: VisionAnalysisResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  success: boolean;
  analysisType: VisionAnalysisType;
  taskType: VisionTaskType;
  provider: VisionProvider;
  model: VisionModel;
  prompt?: string;
  results: VisionResult[];
  text?: string; // Full text response
  confidence?: number;
  durationMs: number;
  timestamp: number;
  sessionId?: string;
  error?: string;
}

/**
 * Individual vision result
 */
export interface VisionResult {
  type: string;
  content: string;
  confidence?: number;
  boundingBox?: BoundingBox;
  metadata?: Record<string, unknown>;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * OCR result
 */
export interface OCRResult {
  text: string;
  lines: OCRLine[];
  words: OCRWord[];
  language?: string;
  confidence?: number;
}

/**
 * OCR line
 */
export interface OCRLine {
  text: string;
  boundingBox: BoundingBox;
  confidence?: number;
  words: OCRWord[];
}

/**
 * OCR word
 */
export interface OCRWord {
  text: string;
  boundingBox: BoundingBox;
  confidence?: number;
}

/**
 * Object detection result
 */
export interface ObjectDetectionResult {
  objects: DetectedObject[];
  count: number;
}

/**
 * Detected object
 */
export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
  category?: string;
  description?: string;
}

/**
 * Layout analysis result
 */
export interface LayoutAnalysisResult {
  elements: LayoutElement[];
  structure: LayoutStructure;
  grid?: LayoutGrid;
}

/**
 * Layout element
 */
export interface LayoutElement {
  type: 'header' | 'footer' | 'navigation' | 'button' | 'input' | 'card' | 'text' | 'image' | 'container' | 'icon' | 'list' | 'form';
  boundingBox: BoundingBox;
  text?: string;
  confidence?: number;
  children?: LayoutElement[];
  properties?: Record<string, string>;
}

/**
 * Layout structure
 */
export interface LayoutStructure {
  type: 'single-column' | 'multi-column' | 'grid' | 'masonry' | 'full-screen' | 'sidebar' | 'custom';
  columns: number;
  rows: number;
  description: string;
}

/**
 * Layout grid
 */
export interface LayoutGrid {
  columns: number;
  rows: number;
  gap: { horizontal: number; vertical: number };
  padding: { top: number; right: number; bottom: number; left: number };
}

/**
 * Color analysis result
 */
export interface ColorAnalysisResult {
  dominantColor: ColorInfo;
  palette: ColorInfo[];
  colorDistribution: Record<string, number>;
}

/**
 * Color information
 */
export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl: { h: number; s: number; l: number };
  name?: string;
  percentage: number;
}

/**
 * Face detection result
 */
export interface FaceDetectionResult {
  faces: DetectedFace[];
  count: number;
}

/**
 * Detected face
 */
export interface DetectedFace {
  boundingBox: BoundingBox;
  confidence: number;
  landmarks?: FaceLandmarks;
  age?: number;
  gender?: string;
  emotion?: string;
}

/**
 * Face landmarks
 */
export interface FaceLandmarks {
  eyeLeft: { x: number; y: number };
  eyeRight: { x: number; y: number };
  nose: { x: number; y: number };
  mouthLeft: { x: number; y: number };
  mouthRight: { x: number; y: number };
  eyebrowLeft: { x: number; y: number };
  eyebrowRight: { x: number; y: number };
}

/**
 * Mockup analysis result
 */
export interface MockupAnalysisResult {
  layout: LayoutAnalysisResult;
  colors: ColorAnalysisResult;
  text?: OCRResult;
  objects?: ObjectDetectionResult;
  suggestions: DesignSuggestion[];
  accessibility: AccessibilityAnalysis;
}

/**
 * Design suggestion
 */
export interface DesignSuggestion {
  type: 'layout' | 'color' | 'contrast' | 'spacing' | 'typography' | 'accessibility' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  fix?: string;
  code?: string;
}

/**
 * Accessibility analysis
 */
export interface AccessibilityAnalysis {
  contrastRatio: number;
  colorBlindFriendly: boolean;
  textReadability: number;
  touchTargetSize: boolean;
  altTextPresent: boolean;
  issues: AccessibilityIssue[];
}

/**
 * Accessibility issue
 */
export interface AccessibilityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  element?: LayoutElement;
  fix: string;
}

/**
 * Vision event types
 */
export type VisionEventType = 
  | 'vision.upload.started'
  | 'vision.upload.completed'
  | 'vision.upload.error'
  | 'vision.analysis.started'
  | 'vision.analysis.progress'
  | 'vision.analysis.completed'
  | 'vision.analysis.error'
  | 'vision.ocr.completed'
  | 'vision.objects.detected'
  | 'vision.mockup.analyzed';

/**
 * Vision event payload
 */
export interface VisionEventPayload {
  type: VisionEventType;
  sessionId?: string;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Vision capabilities
 */
export interface VisionCapabilities {
  providers: VisionProvider[];
  models: VisionModel[];
  analysisTypes: VisionAnalysisType[];
  taskTypes: VisionTaskType[];
  maxImageSizeMB: number;
  maxTokens: number;
}

/**
 * Vision session state
 */
export interface VisionSessionState {
  sessionId: string;
  processingState: VisionProcessingState;
  currentImage?: {
    id: string;
    url: string;
    format: string;
    sizeBytes: number;
  };
  currentAnalysis?: {
    type: VisionAnalysisType;
    startTime: number;
    partialResults: VisionResult[];
  };
  lastError?: Error;
}

/**
 * Image preprocessing options
 */
export interface ImagePreprocessingOptions {
  resize?: {
    width: number;
    height: number;
    maintainAspectRatio: boolean;
  };
  compress?: {
    quality: number; // 0-1
    format: 'jpeg' | 'png' | 'webp';
  };
  convertToBase64?: boolean;
}

/**
 * Vision provider configuration
 */
export interface VisionProviderConfig {
  provider: VisionProvider;
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  defaultModel?: VisionModel;
}
