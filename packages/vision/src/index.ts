/**
 * @soryos/vision
 * Vision AI Package - Main exports
 * 
 * Provides comprehensive vision AI capabilities for SoryOS-Code:
 * - Multi-provider support (Gemini, OpenAI GPT-4, Mistral, Anthropic Claude)
 * - Image analysis (description, OCR, objects, layout, colors, faces)
 * - Specialized analyzers (OCR, Object Detection, Layout, Color, Face, Mockup)
 * - Streaming analysis support
 * - Automatic provider selection
 * - Error handling and retries
 */

// Re-export types
export * from './types';

// Re-export providers
export * from './providers';

// Re-export analyzer
export * from './analyzer';

// Main exports
import {
  VisionProvider,
  VisionModel,
  VisionAnalysisType,
  VisionTaskType,
  VisionConfig,
  DEFAULT_VISION_CONFIG,
  VisionAnalysisOptions,
  VisionAnalysisResult,
} from './types';

import {
  VisionProviderInterface,
  BaseVisionProvider,
  VisionProviderFactory,
  getVisionProvider,
  getDefaultVisionProvider,
  GeminiVisionProvider,
  OpenAIVisionProvider,
  MistralVisionProvider,
  AnthropicVisionProvider,
  LocalVisionProvider,
} from './providers';

import {
  VisionAnalyzer,
  OCRAnalyzer,
  ObjectDetectionAnalyzer,
  LayoutAnalyzer,
  ColorAnalyzer,
  FaceDetector,
  MockupAnalyzer,
  createVisionAnalyzer,
  getVisionAnalyzer,
  setVisionAnalyzer,
} from './analyzer';

/**
 * Vision Manager - High-level vision operations
 */
export class VisionManager {
  private analyzer: VisionAnalyzer;
  private config: VisionConfig;

  constructor(config?: VisionConfig) {
    this.config = { ...DEFAULT_VISION_CONFIG, ...config };
    this.analyzer = new VisionAnalyzer();
  }

  /**
   * Create a new vision manager
   */
  static create(config?: VisionConfig): VisionManager {
    return new VisionManager(config);
  }

  /**
   * Analyze image
   */
  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    return this.analyzer.analyze(options);
  }

  /**
   * Stream image analysis
   */
  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    yield* this.analyzer.streamAnalyze(options);
  }

  /**
   * Extract text from image (OCR)
   */
  async extractText(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.extractText(options);
  }

  /**
   * Detect objects in image
   */
  async detectObjects(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.detectObjects(options);
  }

  /**
   * Analyze layout
   */
  async analyzeLayout(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.analyzeLayout(options);
  }

  /**
   * Analyze colors
   */
  async analyzeColors(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.analyzeColors(options);
  }

  /**
   * Detect faces
   */
  async detectFaces(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.detectFaces(options);
  }

  /**
   * Analyze mockup
   */
  async analyzeMockup(options: VisionAnalysisOptions): Promise<any> {
    return this.analyzer.analyzeMockup(options);
  }

  /**
   * Get vision analyzer
   */
  getAnalyzer(): VisionAnalyzer {
    return this.analyzer;
  }

  /**
   * Get configuration
   */
  getConfig(): VisionConfig {
    return { ...this.config };
  }

  /**
   * Set configuration
   */
  setConfig(config: Partial<VisionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set provider
   */
  setProvider(provider: VisionProviderInterface): void {
    this.analyzer.setProvider(provider);
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): VisionProvider[] {
    return ['gemini', 'openai', 'mistral', 'anthropic', 'local'];
  }

  /**
   * Get available models
   */
  getAvailableModels(): VisionModel[] {
    return [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gpt-4-vision-preview',
      'gpt-4o',
      'gpt-4o-mini',
      'mistral-large-latest',
      'codestral-latest',
      'claude-3-haiku',
      'claude-3-sonnet',
      'claude-3-opus',
      'claude-4',
      'claude-4-sonnet',
      'claude-4-opus',
    ];
  }

  /**
   * Get available analysis types
   */
  getAvailableAnalysisTypes(): VisionAnalysisType[] {
    return ['description', 'ocr', 'objects', 'text', 'layout', 'colors', 'faces', 'custom'];
  }

  /**
   * Get available task types
   */
  getAvailableTaskTypes(): VisionTaskType[] {
    return ['describe', 'extract_text', 'detect_objects', 'analyze_layout', 'detect_colors', 'detect_faces', 'answer_question', 'custom_prompt'];
  }
}

/**
 * Singleton vision manager
 */
let globalVisionManager: VisionManager | null = null;

/**
 * Get or create global vision manager
 */
export function getVisionManager(config?: VisionConfig): VisionManager {
  if (!globalVisionManager) {
    globalVisionManager = new VisionManager(config);
  }
  return globalVisionManager;
}

/**
 * Set global vision manager
 */
export function setVisionManager(manager: VisionManager): void {
  globalVisionManager = manager;
}

/**
 * Initialize vision with specific provider
 */
export function initializeVision(
  provider: VisionProvider,
  config?: VisionConfig
): VisionManager {
  const manager = new VisionManager(config);
  const providerInstance = getVisionProvider(provider, config);
  manager.setProvider(providerInstance);
  return manager;
}

// Export all types for convenience
export type {
  VisionProcessingState,
  VisionResult,
  BoundingBox,
  OCRResult,
  OCRLine,
  OCRWord,
  ObjectDetectionResult,
  DetectedObject,
  LayoutAnalysisResult,
  LayoutElement,
  LayoutStructure,
  LayoutGrid,
  ColorAnalysisResult,
  ColorInfo,
  FaceDetectionResult,
  DetectedFace,
  FaceLandmarks,
  MockupAnalysisResult,
  DesignSuggestion,
  AccessibilityAnalysis,
  AccessibilityIssue,
  VisionEventType,
  VisionEventPayload,
  VisionCapabilities,
  VisionSessionState,
  ImagePreprocessingOptions,
  VisionProviderConfig,
} from './types';
