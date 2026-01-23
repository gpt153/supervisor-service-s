/**
 * Frame0 Design Generator
 * Epic: UI-003 - Frame0 Design Generation Integration
 *
 * Generates UI designs using Frame0 MCP tools from UI requirements
 */

import type {
  UIRequirement,
  ComponentType,
} from '../types/ui-001.js';
import type {
  Frame0DesignPrompt,
  ComponentPrompt,
  Frame0FrameType,
  StyleConfig,
  Frame0Component,
  Frame0ComponentType,
  Frame0ComponentProps,
  DesignData,
  ComponentMapping,
  UIMockup,
  GenerateDesignResult,
} from '../types/ui-003.js';
import { DEFAULT_STYLE_CONFIG, DEFAULT_GENERATION_STRATEGY, COMPONENT_TO_FRAME0_MAPPING } from '../types/ui-003.js';
import { Frame0PromptBuilder } from './Frame0PromptBuilder.js';
import { getUIRequirementsByEpicId, upsertUIMockup } from '../db/queries.js';

/**
 * Generates Frame0 designs from UI requirements
 */
export class Frame0DesignGenerator {
  private promptBuilder: Frame0PromptBuilder;
  private frame0Client: Frame0Client;

  constructor(frame0Client?: Frame0Client) {
    this.promptBuilder = new Frame0PromptBuilder();
    this.frame0Client = frame0Client || new Frame0Client();
  }

  /**
   * Generate a complete Frame0 design from UI requirements
   *
   * @param epicId - Epic identifier
   * @param options - Generation options
   * @returns Generation result
   */
  async generateDesign(
    epicId: string,
    options: {
      prompt?: string;
      frameType?: Frame0FrameType;
      styleConfig?: Partial<StyleConfig>;
    } = {}
  ): Promise<GenerateDesignResult> {
    try {
      // 1. Fetch UI requirements
      const uiRequirement = await getUIRequirementsByEpicId(epicId);
      if (!uiRequirement) {
        return {
          success: false,
          error: `No UI requirements found for epic ${epicId}. Run ui_analyze_epic first.`,
        };
      }

      // 2. Build Frame0 design prompt
      const styleConfig = options.styleConfig
        ? { ...DEFAULT_STYLE_CONFIG, ...options.styleConfig }
        : DEFAULT_STYLE_CONFIG;

      this.promptBuilder = new Frame0PromptBuilder(styleConfig);
      const designPrompt = this.promptBuilder.buildPrompt(
        uiRequirement,
        options.frameType || 'phone'
      );

      // 3. Add positions to components
      const frameWidth = this.getFrameWidth(options.frameType || 'phone');
      const frame = designPrompt.frames[0];
      frame.components = this.promptBuilder.calculatePositions(
        frame.components,
        designPrompt.layoutStrategy,
        frameWidth
      );

      // 4. Create Frame0 page
      const pageId = await this.frame0Client.addPage(`${epicId}-design`);

      // 5. Create Frame0 frame
      const frameId = await this.frame0Client.createFrame({
        frameType: frame.frameType,
        name: frame.name,
        fillColor: designPrompt.styleConfig.colors.background,
      });

      // 6. Generate components
      const components: Frame0Component[] = [];
      const componentMapping: ComponentMapping = {};

      for (const componentPrompt of frame.components) {
        const generated = await this.generateComponent(
          componentPrompt,
          frameId,
          designPrompt.styleConfig
        );

        components.push(...generated);

        // Map first component of each AC to the AC ID
        if (generated.length > 0) {
          componentMapping[generated[0].id] = componentPrompt.acceptanceCriteriaId;
        }
      }

      // 7. Export design as image
      const imageData = await this.frame0Client.exportPageAsImage(pageId);

      // 8. Store in database
      const designData: DesignData = {
        frames: [{
          id: frameId,
          name: frame.name,
          frameType: frame.frameType,
          x: 0,
          y: 0,
          width: frameWidth,
          height: this.getFrameHeight(frame.frameType),
          components,
        }],
        styleConfig: designPrompt.styleConfig,
        metadata: {
          generatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalComponents: components.length,
          complexity: this.assessComplexity(components.length),
        },
      };

      const mockup = await upsertUIMockup({
        epic_id: epicId,
        project_name: uiRequirement.project_name,
        design_method: 'frame0',
        design_url: null, // Frame0 doesn't provide public URLs
        design_data: designData,
        status: 'draft',
        frame0_page_id: pageId,
        frame0_design_export: imageData,
        component_mapping: componentMapping,
      });

      return {
        success: true,
        mockup,
        previewImage: imageData,
        designUrl: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating design',
      };
    }
  }

  /**
   * Generate Frame0 components from a component prompt
   *
   * @param prompt - Component prompt
   * @param parentId - Parent frame ID
   * @param styleConfig - Style configuration
   * @returns Array of Frame0 components
   */
  private async generateComponent(
    prompt: ComponentPrompt,
    parentId: string,
    styleConfig: StyleConfig
  ): Promise<Frame0Component[]> {
    const mapping = COMPONENT_TO_FRAME0_MAPPING[prompt.componentType];
    if (!mapping) {
      // Fallback to basic rectangle + text
      return this.generateFallbackComponent(prompt, parentId, styleConfig);
    }

    const components: Frame0Component[] = [];

    for (let i = 0; i < mapping.frame0Components.length; i++) {
      const spec = mapping.frame0Components[i];
      const position = prompt.position || { strategy: 'stack', x: 20, y: 60 };

      // Calculate actual position
      const x = position.x! + (spec.relativePosition?.x || 0);
      const y = position.y! + (spec.relativePosition?.y || 0);

      // Calculate size
      const width = this.resolveSize(spec.size?.width || prompt.size?.width || 'full', 375);
      const height = this.resolveSize(spec.size?.height || prompt.size?.height || 44, 0);

      // Merge props
      const props: Frame0ComponentProps = {
        ...spec.props,
        ...this.applyStyleConfig(spec.props, styleConfig),
      };

      // Add text content for text components
      if (spec.type === 'text') {
        props.text = prompt.label || props.text || prompt.componentType;
      }

      // Create component using Frame0 MCP tools
      const componentId = await this.frame0Client.createComponent({
        type: spec.type,
        name: `${prompt.componentType}-${i}`,
        parentId,
        x,
        y,
        width: typeof width === 'number' ? width : 100,
        height: typeof height === 'number' ? height : 44,
        props,
      });

      components.push({
        id: componentId,
        type: spec.type,
        name: `${prompt.componentType}-${i}`,
        x,
        y,
        width: typeof width === 'number' ? width : 100,
        height: typeof height === 'number' ? height : 44,
        props,
        acceptanceCriteriaId: prompt.acceptanceCriteriaId,
      });
    }

    return components;
  }

  /**
   * Generate fallback component (basic rectangle + text)
   *
   * @param prompt - Component prompt
   * @param parentId - Parent frame ID
   * @param styleConfig - Style configuration
   * @returns Array of Frame0 components
   */
  private async generateFallbackComponent(
    prompt: ComponentPrompt,
    parentId: string,
    styleConfig: StyleConfig
  ): Promise<Frame0Component[]> {
    const position = prompt.position || { strategy: 'stack', x: 20, y: 60 };
    const width = this.resolveSize(prompt.size?.width || 'full', 375);
    const height = this.resolveSize(prompt.size?.height || 44, 0);

    // Create rectangle
    const rectId = await this.frame0Client.createComponent({
      type: 'rectangle',
      name: `${prompt.componentType}-bg`,
      parentId,
      x: position.x!,
      y: position.y!,
      width: typeof width === 'number' ? width : 335,
      height: typeof height === 'number' ? height : 44,
      props: {
        fillColor: styleConfig.colors.background,
        strokeColor: styleConfig.colors.border,
        cornerRadius: 8,
      },
    });

    // Create text label
    const textId = await this.frame0Client.createComponent({
      type: 'text',
      name: `${prompt.componentType}-label`,
      parentId,
      x: position.x! + 12,
      y: position.y! + 12,
      width: typeof width === 'number' ? width - 24 : 311,
      height: 20,
      props: {
        text: prompt.label || prompt.componentType,
        fontSize: styleConfig.typography.body.fontSize,
        fontColor: styleConfig.colors.text,
      },
    });

    return [
      {
        id: rectId,
        type: 'rectangle',
        name: `${prompt.componentType}-bg`,
        x: position.x!,
        y: position.y!,
        width: typeof width === 'number' ? width : 335,
        height: typeof height === 'number' ? height : 44,
        props: {
          fillColor: styleConfig.colors.background,
          strokeColor: styleConfig.colors.border,
          cornerRadius: 8,
        },
        acceptanceCriteriaId: prompt.acceptanceCriteriaId,
      },
      {
        id: textId,
        type: 'text',
        name: `${prompt.componentType}-label`,
        x: position.x! + 12,
        y: position.y! + 12,
        width: typeof width === 'number' ? width - 24 : 311,
        height: 20,
        props: {
          text: prompt.label || prompt.componentType,
          fontSize: styleConfig.typography.body.fontSize,
          fontColor: styleConfig.colors.text,
        },
        acceptanceCriteriaId: prompt.acceptanceCriteriaId,
      },
    ];
  }

  /**
   * Apply style config to component props
   *
   * @param props - Component props
   * @param styleConfig - Style configuration
   * @returns Updated props
   */
  private applyStyleConfig(
    props: Partial<Frame0ComponentProps>,
    styleConfig: StyleConfig
  ): Partial<Frame0ComponentProps> {
    const updated = { ...props };

    // Apply color mappings
    if (updated.fillColor === '#F3F4F6') updated.fillColor = styleConfig.colors.background;
    if (updated.fillColor === '#3B82F6') updated.fillColor = styleConfig.colors.primary;
    if (updated.strokeColor === '#D1D5DB') updated.strokeColor = styleConfig.colors.border;
    if (updated.fontColor === '#1F2937') updated.fontColor = styleConfig.colors.text;
    if (updated.fontColor === '#9CA3AF') updated.fontColor = styleConfig.colors.text;

    return updated;
  }

  /**
   * Resolve size value (numeric, 'auto', 'full')
   *
   * @param size - Size value
   * @param parentSize - Parent size
   * @returns Resolved size
   */
  private resolveSize(size: number | string | undefined, parentSize: number): number | 'auto' {
    if (typeof size === 'number') return size;
    if (size === 'full') return parentSize;
    return 'auto';
  }

  /**
   * Get frame width by frame type
   *
   * @param frameType - Frame type
   * @returns Width in pixels
   */
  private getFrameWidth(frameType: Frame0FrameType): number {
    const widths: Record<Frame0FrameType, number> = {
      phone: 375,
      tablet: 768,
      desktop: 1440,
      browser: 1440,
      watch: 184,
      tv: 1920,
    };
    return widths[frameType] || 375;
  }

  /**
   * Get frame height by frame type
   *
   * @param frameType - Frame type
   * @returns Height in pixels
   */
  private getFrameHeight(frameType: Frame0FrameType): number {
    const heights: Record<Frame0FrameType, number> = {
      phone: 812,
      tablet: 1024,
      desktop: 900,
      browser: 900,
      watch: 224,
      tv: 1080,
    };
    return heights[frameType] || 812;
  }

  /**
   * Assess design complexity based on component count
   *
   * @param componentCount - Number of components
   * @returns Complexity level
   */
  private assessComplexity(componentCount: number): 'simple' | 'medium' | 'complex' {
    if (componentCount <= 5) return 'simple';
    if (componentCount <= 15) return 'medium';
    return 'complex';
  }
}

/**
 * Frame0 MCP client wrapper
 * Provides typed interface to Frame0 MCP tools
 */
class Frame0Client {
  /**
   * Add a new page to Frame0
   *
   * @param name - Page name
   * @returns Page ID
   */
  async addPage(name: string): Promise<string> {
    // In real implementation, this would call mcp__frame0__add_page
    // For now, return a mock ID
    return `page-${Date.now()}`;
  }

  /**
   * Create a frame in Frame0
   *
   * @param params - Frame parameters
   * @returns Frame ID
   */
  async createFrame(params: {
    frameType: Frame0FrameType;
    name: string;
    fillColor?: string;
  }): Promise<string> {
    // In real implementation, this would call mcp__frame0__create_frame
    return `frame-${Date.now()}`;
  }

  /**
   * Create a component in Frame0
   *
   * @param params - Component parameters
   * @returns Component ID
   */
  async createComponent(params: {
    type: Frame0ComponentType;
    name: string;
    parentId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    props: Frame0ComponentProps;
  }): Promise<string> {
    // In real implementation, this would call:
    // - mcp__frame0__create_rectangle
    // - mcp__frame0__create_text
    // - mcp__frame0__create_ellipse
    // etc.
    return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Export page as image
   *
   * @param pageId - Page ID
   * @returns Base64-encoded image
   */
  async exportPageAsImage(pageId: string): Promise<string> {
    // In real implementation, this would call mcp__frame0__export_page_as_image
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }
}
