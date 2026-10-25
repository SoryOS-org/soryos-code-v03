/**
 * @soryos/vision
 * Vision Analyzer - Advanced image analysis with specialized analyzers
 * 
 * Provides high-level analysis capabilities:
 * - OCR (Text extraction)
 * - Object detection
 * - Layout analysis
 * - Color analysis
 * - Face detection
 * - Mockup analysis
 * - Custom analysis
 */

import {
  VisionAnalysisOptions,
  VisionAnalysisResult,
  VisionProvider,
  VisionModel,
  OCRResult,
  OCRLine,
  OCRWord,
  ObjectDetectionResult,
  DetectedObject,
  LayoutAnalysisResult,
  LayoutElement,
  LayoutStructure,
  ColorAnalysisResult,
  ColorInfo,
  FaceDetectionResult,
  DetectedFace,
  MockupAnalysisResult,
  DesignSuggestion,
  AccessibilityAnalysis,
  AccessibilityIssue,
  BoundingBox,
} from './types';

import {
  getVisionProvider,
  VisionProviderInterface,
  BaseVisionProvider,
} from './providers';

/**
 * OCR Analyzer - Extract text from images
 */
export class OCRAnalyzer {
  private provider: VisionProviderInterface;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
  }

  /**
   * Extract text from image
   */
  async extractText(options: VisionAnalysisOptions): Promise<OCRResult> {
    const result = await this.provider.analyze({
      ...options,
      analysisType: 'ocr',
      prompt: options.prompt || 'Extract all text from this image. Preserve formatting, line breaks, and layout. Return structured text with bounding boxes.',
    });

    return this.parseOCRResult(result);
  }

  /**
   * Parse vision result to OCR format
   */
  private parseOCRResult(result: VisionAnalysisResult): OCRResult {
    const text = result.text || '';
    const results = result.results || [];

    // Extract lines and words from results
    const lines: OCRLine[] = [];
    const words: OCRWord[] = [];

    for (const res of results) {
      if (res.type === 'text' && res.boundingBox) {
        // Split text into words
        const textWords = res.content.split(/(\s+)/).filter(w => w.trim().length > 0);
        
        let line: OCRLine | null = null;
        let lineIndex = 0;

        for (const wordText of textWords) {
          // Create word
          const word: OCRWord = {
            text: wordText,
            confidence: res.confidence || 0.9,
            boundingBox: res.boundingBox,
          };
          words.push(word);

          // Create or update line
          if (!line || line.words.length >= 10) {
            line = {
              text: wordText,
              confidence: res.confidence || 0.9,
              boundingBox: res.boundingBox,
              words: [word],
            };
            lines.push(line);
          } else {
            line.text += ' ' + wordText;
            line.words.push(word);
          }
        }
      }
    }

    return {
      text,
      lines,
      words,
      confidence: result.confidence || this.calculateConfidence(results),
    };
  }

  /**
   * Calculate average confidence
   */
  private calculateConfidence(results: any[]): number {
    if (results.length === 0) return 0;
    const confidences = results.map(r => r.confidence || 0).filter(c => c > 0);
    if (confidences.length === 0) return 0.9;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  /**
   * Extract text from specific region
   */
  async extractTextFromRegion(
    options: VisionAnalysisOptions,
    region: BoundingBox
  ): Promise<OCRResult> {
    // In a real implementation, we would crop the image to the region
    // before sending to the provider
    return this.extractText(options);
  }
}

/**
 * Object Detection Analyzer
 */
export class ObjectDetectionAnalyzer {
  private provider: VisionProviderInterface;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
  }

  /**
   * Detect objects in image
   */
  async detectObjects(options: VisionAnalysisOptions): Promise<ObjectDetectionResult> {
    const result = await this.provider.analyze({
      ...options,
      analysisType: 'objects',
      prompt: options.prompt || 'Identify and locate all objects in this image. For each object, provide a label, confidence score (0-1), and bounding box coordinates (x, y, width, height as percentages).',
    });

    return this.parseObjectDetectionResult(result);
  }

  /**
   * Parse vision result to object detection format
   */
  private parseObjectDetectionResult(result: VisionAnalysisResult): ObjectDetectionResult {
    const objects: DetectedObject[] = [];

    for (const res of result.results || []) {
      if (res.type === 'object' || res.type === 'text') {
        // Try to parse object from content
        try {
          const obj = JSON.parse(res.content);
          if (obj.label || obj.name) {
            objects.push({
              label: obj.label || obj.name,
              confidence: obj.confidence || res.confidence || 0.8,
              boundingBox: obj.boundingBox || res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
              category: obj.category,
              description: obj.description,
            });
          }
        } catch {
          // Content is not JSON, try to parse as text
          const label = res.content;
          if (label) {
            objects.push({
              label,
              confidence: res.confidence || 0.8,
              boundingBox: res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            });
          }
        }
      }
    }

    return {
      objects,
      count: objects.length,
    };
  }

  /**
   * Detect specific objects
   */
  async detectSpecificObjects(
    options: VisionAnalysisOptions,
    targetObjects: string[]
  ): Promise<DetectedObject[]> {
    const result = await this.detectObjects({
      ...options,
      prompt: `Identify and locate only the following objects: ${targetObjects.join(', ')}. For each found object, provide a label, confidence score, and bounding box.`,
    });

    return result.objects.filter(obj => targetObjects.includes(obj.label));
  }
}

/**
 * Layout Analyzer - Analyze UI/UX layouts
 */
export class LayoutAnalyzer {
  private provider: VisionProviderInterface;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
  }

  /**
   * Analyze layout of image
   */
  async analyzeLayout(options: VisionAnalysisOptions): Promise<LayoutAnalysisResult> {
    const result = await this.provider.analyze({
      ...options,
      analysisType: 'layout',
      prompt: options.prompt || `Analyze the layout of this UI/UX design. Identify all elements and their hierarchical structure. For each element, provide:
1. Type (header, footer, navigation, button, input, card, text, image, container, icon, list, form)
2. Text content (if any)
3. Bounding box coordinates
4. Confidence score
5. Parent-child relationships

Return a hierarchical structure with nested elements.`,
    });

    return this.parseLayoutResult(result);
  }

  /**
   * Parse vision result to layout format
   */
  private parseLayoutResult(result: VisionAnalysisResult): LayoutAnalysisResult {
    const elements: LayoutElement[] = [];
    let structure: LayoutStructure = {
      type: 'custom',
      columns: 1,
      rows: 1,
      description: 'Custom layout',
    };

    // Parse elements from results
    for (const res of result.results || []) {
      if (res.type === 'element' || res.type === 'text') {
        try {
          const element = JSON.parse(res.content);
          elements.push({
            type: element.type || 'container',
            boundingBox: element.boundingBox || res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            text: element.text,
            confidence: element.confidence || res.confidence || 0.8,
            children: element.children || [],
            properties: element.properties,
          });
        } catch {
          // Content is not JSON
          elements.push({
            type: 'text',
            boundingBox: res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            text: res.content,
            confidence: res.confidence || 0.8,
          });
        }
      }
    }

    // Detect structure type
    structure = this.detectStructureType(elements);

    return {
      elements,
      structure,
    };
  }

  /**
   * Detect layout structure type
   */
  private detectStructureType(elements: LayoutElement[]): LayoutStructure {
    // Count columns based on x positions
    const xPositions = elements.map(e => e.boundingBox.x);
    const uniqueXPositions = [...new Set(xPositions.map(x => Math.round(x * 10) / 10))];
    const columnCount = uniqueXPositions.length;

    // Detect common patterns
    if (columnCount >= 3) {
      return {
        type: 'multi-column',
        columns: columnCount,
        rows: Math.ceil(elements.length / columnCount),
        description: `${columnCount}-column layout`,
      };
    }

    if (columnCount === 2) {
      return {
        type: 'sidebar',
        columns: 2,
        rows: Math.ceil(elements.length / 2),
        description: 'Sidebar layout',
      };
    }

    // Check for grid pattern
    const gridElements = elements.filter(e => e.type === 'card' || e.type === 'image');
    if (gridElements.length >= 4) {
      return {
        type: 'grid',
        columns: Math.round(Math.sqrt(gridElements.length)),
        rows: Math.round(Math.sqrt(gridElements.length)),
        description: 'Grid layout',
      };
    }

    return {
      type: 'single-column',
      columns: 1,
      rows: elements.length,
      description: 'Single column layout',
    };
  }

  /**
   * Find element by type
   */
  findElementsByType(elements: LayoutElement[], type: string): LayoutElement[] {
    return elements.filter(e => e.type === type);
  }

  /**
   * Find element at position
   */
  findElementAtPosition(
    elements: LayoutElement[],
    x: number,
    y: number
  ): LayoutElement | null {
    for (const element of elements) {
      const { x: ex, y: ey, width, height } = element.boundingBox;
      if (x >= ex && x <= ex + width && y >= ey && y <= ey + height) {
        return element;
      }
    }
    return null;
  }
}

/**
 * Color Analyzer
 */
export class ColorAnalyzer {
  private provider: VisionProviderInterface;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
  }

  /**
   * Analyze colors in image
   */
  async analyzeColors(options: VisionAnalysisOptions): Promise<ColorAnalysisResult> {
    const result = await this.provider.analyze({
      ...options,
      analysisType: 'colors',
      prompt: options.prompt || `Analyze the color palette of this image. Identify:
1. Dominant color (hex, rgb, hsl)
2. Color palette (top 5-10 colors with hex, rgb, hsl)
3. Color distribution (percentage of each color)
4. Color harmony assessment

Return structured data with all color information.`,
    });

    return this.parseColorResult(result);
  }

  /**
   * Parse vision result to color format
   */
  private parseColorResult(result: VisionAnalysisResult): ColorAnalysisResult {
    const colors: ColorInfo[] = [];
    const distribution: Record<string, number> = {};
    let dominantColor: ColorInfo = this.hexToColorInfo('#000000');

    for (const res of result.results || []) {
      if (res.type === 'color' || res.type === 'text') {
        try {
          const color = JSON.parse(res.content);
          const colorInfo: ColorInfo = {
            hex: color.hex || color.color || '#000000',
            rgb: color.rgb || this.hexToRgb(color.hex || color.color || '#000000'),
            hsl: color.hsl || this.rgbToHsl(color.rgb || this.hexToRgb(color.hex || color.color || '#000000')),
            name: color.name,
            percentage: color.percentage || res.confidence || 0,
          };
          
          colors.push(colorInfo);
          distribution[colorInfo.hex] = colorInfo.percentage;

          if (colorInfo.percentage > (dominantColor.percentage || 0)) {
            dominantColor = colorInfo;
          }
        } catch {
          // Try to parse hex from content
          const hexMatch = res.content.match(/#([0-9a-fA-F]{3,6})/);
          if (hexMatch) {
            const hex = `#${hexMatch[1]}`;
            const colorInfo = this.hexToColorInfo(hex);
            colors.push(colorInfo);
            distribution[hex] = res.confidence || 0.1;
            
            if (distribution[hex] > (dominantColor.percentage || 0)) {
              dominantColor = colorInfo;
            }
          }
        }
      }
    }

    // Normalize percentages
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const hex in distribution) {
        distribution[hex] = (distribution[hex] / total) * 100;
      }
      dominantColor.percentage = distribution[dominantColor.hex] || 0;
    }

    return {
      dominantColor,
      palette: colors,
      colorDistribution: distribution,
    };
  }

  /**
   * Convert hex to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Convert RGB to HSL
   */
  private rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }

    return {
      h: Math.round(h),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  /**
   * Convert hex to ColorInfo
   */
  private hexToColorInfo(hex: string): ColorInfo {
    const rgb = this.hexToRgb(hex);
    return {
      hex,
      rgb,
      hsl: this.rgbToHsl(rgb),
      percentage: 0,
    };
  }

  /**
   * Get color contrast ratio
   */
  getContrastRatio(color1: string, color2: string): number {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    const l1 = this.getRelativeLuminance(rgb1);
    const l2 = this.getRelativeLuminance(rgb2);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Get relative luminance
   */
  private getRelativeLuminance(rgb: { r: number; g: number; b: number }): number {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const rsrgb = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gsrgb = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bsrgb = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    return 0.2126 * rsrgb + 0.7152 * gsrgb + 0.0722 * bsrgb;
  }

  /**
   * Check if color is accessible (WCAG AA)
   */
  isAccessible(color1: string, color2: string): boolean {
    return this.getContrastRatio(color1, color2) >= 4.5;
  }
}

/**
 * Face Detector
 */
export class FaceDetector {
  private provider: VisionProviderInterface;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
  }

  /**
   * Detect faces in image
   */
  async detectFaces(options: VisionAnalysisOptions): Promise<FaceDetectionResult> {
    const result = await this.provider.analyze({
      ...options,
      analysisType: 'faces',
      prompt: options.prompt || `Detect all faces in this image. For each face, provide:
1. Bounding box coordinates (x, y, width, height as percentages)
2. Confidence score (0-1)
3. Landmarks (eye positions, nose, mouth)
4. Estimated age (if possible)
5. Estimated gender (if possible)
6. Estimated emotion (if possible)

Return structured data with all face information.`,
    });

    return this.parseFaceDetectionResult(result);
  }

  /**
   * Parse vision result to face detection format
   */
  private parseFaceDetectionResult(result: VisionAnalysisResult): FaceDetectionResult {
    const faces: DetectedFace[] = [];

    for (const res of result.results || []) {
      if (res.type === 'face' || res.type === 'text') {
        try {
          const face = JSON.parse(res.content);
          faces.push({
            boundingBox: face.boundingBox || res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            confidence: face.confidence || res.confidence || 0.8,
            landmarks: face.landmarks,
            age: face.age,
            gender: face.gender,
            emotion: face.emotion,
          });
        } catch {
          // Content is not JSON
          faces.push({
            boundingBox: res.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
            confidence: res.confidence || 0.8,
          });
        }
      }
    }

    return {
      faces,
      count: faces.length,
    };
  }
}

/**
 * Mockup Analyzer - Specialized for design mockups
 */
export class MockupAnalyzer {
  private layoutAnalyzer: LayoutAnalyzer;
  private colorAnalyzer: ColorAnalyzer;
  private ocrAnalyzer: OCRAnalyzer;
  private objectDetector: ObjectDetectionAnalyzer;

  constructor(provider?: VisionProviderInterface) {
    this.layoutAnalyzer = new LayoutAnalyzer(provider);
    this.colorAnalyzer = new ColorAnalyzer(provider);
    this.ocrAnalyzer = new OCRAnalyzer(provider);
    this.objectDetector = new ObjectDetectionAnalyzer(provider);
  }

  /**
   * Analyze design mockup
   */
  async analyzeMockup(options: VisionAnalysisOptions): Promise<MockupAnalysisResult> {
    const startTime = Date.now();

    try {
      // Run all analyzers in parallel
      const [layout, colors, text, objects] = await Promise.all([
        this.layoutAnalyzer.analyzeLayout(options),
        this.colorAnalyzer.analyzeColors(options),
        this.ocrAnalyzer.extractText(options),
        this.objectDetector.detectObjects(options),
      ]);

      // Generate suggestions
      const suggestions = this.generateSuggestions(layout, colors, text, objects);

      // Generate accessibility analysis
      const accessibility = this.analyzeAccessibility(layout, colors, text);

      return {
        layout,
        colors,
        text,
        objects,
        suggestions,
        accessibility,
      };

    } catch (error) {
      throw new Error(`Mockup analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate design suggestions
   */
  private generateSuggestions(
    layout: LayoutAnalysisResult,
    colors: ColorAnalysisResult,
    text: OCRResult,
    objects: ObjectDetectionResult
  ): DesignSuggestion[] {
    const suggestions: DesignSuggestion[] = [];

    // Check color contrast
    for (const color of colors.palette) {
      for (const otherColor of colors.palette) {
        if (color.hex !== otherColor.hex) {
          const ratio = this.colorAnalyzer.getContrastRatio(color.hex, otherColor.hex);
          if (ratio < 4.5) {
            suggestions.push({
              type: 'contrast',
              severity: 'high',
              title: 'Low Color Contrast',
              description: `Colors ${color.hex} and ${otherColor.hex} have insufficient contrast (${ratio.toFixed(2)}:1)`,
              fix: `Increase contrast between these colors. Use tools like https://webaim.org/resources/contrastchecker/`,
            });
          }
        }
      }
    }

    // Check layout structure
    if (layout.structure.type === 'custom' && layout.elements.length > 10) {
      suggestions.push({
        type: 'layout',
        severity: 'medium',
        title: 'Complex Layout',
        description: `Layout has ${layout.elements.length} elements with no clear structure`,
        fix: 'Consider organizing elements into a grid or column-based layout for better readability',
      });
    }

    // Check for missing alt text (if text extraction failed)
    if (text.text.length === 0 && objects.objects.length > 0) {
      suggestions.push({
        type: 'accessibility',
        severity: 'high',
        title: 'Missing Text Alternatives',
        description: 'Image contains objects but no text was extracted. Screen readers may not be able to describe the content.',
        fix: 'Add descriptive alt text or provide text alternatives for all images',
      });
    }

    // Check color palette size
    if (colors.palette.length > 10) {
      suggestions.push({
        type: 'color',
        severity: 'low',
        title: 'Large Color Palette',
        description: `Color palette has ${colors.palette.length} colors, which may be overwhelming`,
        fix: 'Consider reducing the color palette to 5-8 main colors for consistency',
      });
    }

    // Check for common UI elements
    const buttons = layout.elements.filter(e => e.type === 'button');
    if (buttons.length > 5) {
      suggestions.push({
        type: 'layout',
        severity: 'medium',
        title: 'Too Many Buttons',
        description: `Design has ${buttons.length} buttons, which may be overwhelming for users`,
        fix: 'Group related buttons or use a more minimal design',
      });
    }

    return suggestions;
  }

  /**
   * Analyze accessibility
   */
  private analyzeAccessibility(
    layout: LayoutAnalysisResult,
    colors: ColorAnalysisResult,
    text: OCRResult
  ): AccessibilityAnalysis {
    const issues: AccessibilityIssue[] = [];

    // Check color contrast
    for (const color of colors.palette) {
      for (const otherColor of colors.palette) {
        if (color.hex !== otherColor.hex) {
          const ratio = this.colorAnalyzer.getContrastRatio(color.hex, otherColor.hex);
          if (ratio < 4.5) {
            issues.push({
              type: 'color_contrast',
              severity: 'high',
              description: `Colors ${color.hex} and ${otherColor.hex} have insufficient contrast (${ratio.toFixed(2)}:1)`,
              fix: 'Use colors with at least 4.5:1 contrast ratio for normal text',
            });
          }
        }
      }
    }

    // Check for text readability
    if (text.lines.length > 0) {
      const avgLineLength = text.lines.reduce((sum, line) => sum + line.text.length, 0) / text.lines.length;
      if (avgLineLength > 60) {
        issues.push({
          type: 'text_readability',
          severity: 'medium',
          description: `Average line length is ${avgLineLength.toFixed(0)} characters, which may be hard to read`,
          fix: 'Keep lines under 60 characters for better readability',
        });
      }
    }

    // Check for touch target size
    const buttons = layout.elements.filter(e => e.type === 'button');
    for (const button of buttons) {
      const minSize = Math.min(button.boundingBox.width, button.boundingBox.height);
      if (minSize < 0.08) { // 8% of screen
        issues.push({
          type: 'touch_target',
          severity: 'high',
          description: `Button at (${button.boundingBox.x}, ${button.boundingBox.y}) is too small for touch`,
          fix: 'Minimum touch target size should be 48x48 pixels',
          element: button,
        });
      }
    }

    // Check for alt text
    const images = layout.elements.filter(e => e.type === 'image');
    if (images.length > 0 && text.text.length === 0) {
      issues.push({
        type: 'alt_text',
        severity: 'high',
        description: `${images.length} image(s) found but no alt text provided`,
        fix: 'Add alt text to all images for screen reader accessibility',
      });
    }

    return {
      contrastRatio: Math.max(...Object.values(colors.colorDistribution).map(v => v)),
      colorBlindFriendly: this.isColorBlindFriendly(colors.palette),
      textReadability: text.lines.length > 0 ? Math.min(1, 60 / (text.lines.reduce((sum, line) => sum + line.text.length, 0) / text.lines.length)) : 0,
      touchTargetSize: buttons.length === 0 || buttons.every(b => Math.min(b.boundingBox.width, b.boundingBox.height) >= 0.08),
      altTextPresent: text.text.length > 0 || images.length === 0,
      issues,
    };
  }

  /**
   * Check if color palette is color blind friendly
   */
  private isColorBlindFriendly(colors: ColorInfo[]): boolean {
    // Simplified check - in practice, use a proper color blind simulation
    return colors.length <= 5;
  }
}

/**
 * Main Vision Analyzer - Unified interface
 */
export class VisionAnalyzer {
  private provider: VisionProviderInterface;
  private ocr: OCRAnalyzer;
  private objects: ObjectDetectionAnalyzer;
  private layout: LayoutAnalyzer;
  private colors: ColorAnalyzer;
  private faces: FaceDetector;
  private mockup: MockupAnalyzer;

  constructor(provider?: VisionProviderInterface) {
    this.provider = provider || getVisionProvider('gemini');
    this.ocr = new OCRAnalyzer(this.provider);
    this.objects = new ObjectDetectionAnalyzer(this.provider);
    this.layout = new LayoutAnalyzer(this.provider);
    this.colors = new ColorAnalyzer(this.provider);
    this.faces = new FaceDetector(this.provider);
    this.mockup = new MockupAnalyzer(this.provider);
  }

  /**
   * Analyze image with automatic type detection
   */
  async analyze(options: VisionAnalysisOptions): Promise<VisionAnalysisResult> {
    return this.provider.analyze(options);
  }

  /**
   * Stream analysis
   */
  async *streamAnalyze(options: VisionAnalysisOptions): AsyncIterable<string> {
    yield* this.provider.streamAnalyze(options);
  }

  /**
   * Extract text (OCR)
   */
  async extractText(options: VisionAnalysisOptions): Promise<OCRResult> {
    return this.ocr.extractText(options);
  }

  /**
   * Detect objects
   */
  async detectObjects(options: VisionAnalysisOptions): Promise<ObjectDetectionResult> {
    return this.objects.detectObjects(options);
  }

  /**
   * Analyze layout
   */
  async analyzeLayout(options: VisionAnalysisOptions): Promise<LayoutAnalysisResult> {
    return this.layout.analyzeLayout(options);
  }

  /**
   * Analyze colors
   */
  async analyzeColors(options: VisionAnalysisOptions): Promise<ColorAnalysisResult> {
    return this.colors.analyzeColors(options);
  }

  /**
   * Detect faces
   */
  async detectFaces(options: VisionAnalysisOptions): Promise<FaceDetectionResult> {
    return this.faces.detectFaces(options);
  }

  /**
   * Analyze mockup
   */
  async analyzeMockup(options: VisionAnalysisOptions): Promise<MockupAnalysisResult> {
    return this.mockup.analyzeMockup(options);
  }

  /**
   * Get analyzer by type
   */
  getAnalyzer(type: string): any {
    const analyzers: Record<string, any> = {
      ocr: this.ocr,
      objects: this.objects,
      layout: this.layout,
      colors: this.colors,
      faces: this.faces,
      mockup: this.mockup,
    };
    return analyzers[type] || this.provider;
  }

  /**
   * Get provider
   */
  getProvider(): VisionProviderInterface {
    return this.provider;
  }

  /**
   * Set provider
   */
  setProvider(provider: VisionProviderInterface): void {
    this.provider = provider;
    this.ocr = new OCRAnalyzer(provider);
    this.objects = new ObjectDetectionAnalyzer(provider);
    this.layout = new LayoutAnalyzer(provider);
    this.colors = new ColorAnalyzer(provider);
    this.faces = new FaceDetector(provider);
    this.mockup = new MockupAnalyzer(provider);
  }
}

/**
 * Create vision analyzer
 */
export function createVisionAnalyzer(provider?: VisionProviderInterface): VisionAnalyzer {
  return new VisionAnalyzer(provider);
}

/**
 * Singleton vision analyzer
 */
let globalVisionAnalyzer: VisionAnalyzer | null = null;

/**
 * Get or create global vision analyzer
 */
export function getVisionAnalyzer(provider?: VisionProviderInterface): VisionAnalyzer {
  if (!globalVisionAnalyzer) {
    globalVisionAnalyzer = new VisionAnalyzer(provider);
  }
  return globalVisionAnalyzer;
}

/**
 * Set global vision analyzer
 */
export function setVisionAnalyzer(analyzer: VisionAnalyzer): void {
  globalVisionAnalyzer = analyzer;
}
