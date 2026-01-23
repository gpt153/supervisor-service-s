/**
 * Frame0 Prompt Builder
 * Epic: UI-003 - Frame0 Design Generation Integration
 *
 * Converts UI requirements into Frame0 design prompts with component specifications
 */

import type {
  UIRequirement,
  AcceptanceCriteriaSpec,
  ComponentType,
} from '../types/ui-001.js';
import type {
  Frame0DesignPrompt,
  Frame0FramePrompt,
  ComponentPrompt,
  StyleConfig,
  LayoutStrategy,
  Frame0FrameType,
  ComponentPosition,
  ComponentSize,
} from '../types/ui-003.js';
import { DEFAULT_STYLE_CONFIG } from '../types/ui-003.js';

/**
 * Builds Frame0 design prompts from UI requirements
 */
export class Frame0PromptBuilder {
  private styleConfig: StyleConfig;

  constructor(styleConfig?: Partial<StyleConfig>) {
    this.styleConfig = { ...DEFAULT_STYLE_CONFIG, ...styleConfig };
  }

  /**
   * Build a complete Frame0 design prompt from UI requirements
   *
   * @param uiRequirement - Structured UI requirements from Epic UI-001
   * @param frameType - Frame type (default: 'phone')
   * @returns Frame0 design prompt
   */
  buildPrompt(
    uiRequirement: UIRequirement,
    frameType: Frame0FrameType = 'phone'
  ): Frame0DesignPrompt {
    const componentPrompts = this.buildComponentPrompts(uiRequirement.acceptance_criteria);
    const layoutStrategy = this.determineLayoutStrategy(componentPrompts);

    const frame: Frame0FramePrompt = {
      name: `${uiRequirement.epic_id} - Main View`,
      frameType,
      components: componentPrompts,
    };

    return {
      frames: [frame],
      styleConfig: this.styleConfig,
      layoutStrategy,
    };
  }

  /**
   * Build component prompts from acceptance criteria
   *
   * @param acceptanceCriteria - Acceptance criteria specs
   * @returns Array of component prompts
   */
  private buildComponentPrompts(acceptanceCriteria: AcceptanceCriteriaSpec[]): ComponentPrompt[] {
    const prompts: ComponentPrompt[] = [];

    for (const ac of acceptanceCriteria) {
      // Extract components from this AC
      const components = this.extractComponentsFromAC(ac);
      prompts.push(...components);
    }

    return prompts;
  }

  /**
   * Extract component prompts from a single acceptance criterion
   *
   * @param ac - Acceptance criterion spec
   * @returns Array of component prompts
   */
  private extractComponentsFromAC(ac: AcceptanceCriteriaSpec): ComponentPrompt[] {
    const prompts: ComponentPrompt[] = [];

    for (const uiElement of ac.ui_elements) {
      const prompt: ComponentPrompt = {
        componentType: uiElement.component,
        acceptanceCriteriaId: ac.id,
        ...this.extractComponentMetadata(uiElement),
      };

      prompts.push(prompt);
    }

    return prompts;
  }

  /**
   * Extract component metadata from UI element
   *
   * @param uiElement - UI element from AC
   * @returns Partial component prompt data
   */
  private extractComponentMetadata(uiElement: any): Partial<ComponentPrompt> {
    const metadata: Partial<ComponentPrompt> = {};

    // Extract label from props
    if (uiElement.props?.label) {
      metadata.label = uiElement.props.label;
    }

    // Extract placeholder
    if (uiElement.props?.placeholder) {
      metadata.placeholder = uiElement.props.placeholder;
    }

    // Extract options (for select, dropdown, radio)
    if (uiElement.props?.options) {
      metadata.options = uiElement.props.options;
    }

    // Extract variant
    if (uiElement.variants && uiElement.variants.length > 0) {
      metadata.variant = uiElement.variants[0];
    }

    return metadata;
  }

  /**
   * Determine optimal layout strategy based on component types
   *
   * @param components - Component prompts
   * @returns Layout strategy
   */
  private determineLayoutStrategy(components: ComponentPrompt[]): LayoutStrategy {
    const types = components.map(c => c.componentType);

    // Check for form-like patterns
    const hasForm = types.some(t => ['Form', 'Input', 'Select', 'Checkbox'].includes(t));
    if (hasForm) {
      return 'vertical';
    }

    // Check for list/table patterns
    const hasList = types.some(t => ['List', 'Table', 'Card'].includes(t));
    if (hasList) {
      return 'vertical';
    }

    // Check for grid-like patterns
    const hasCards = types.filter(t => t === 'Card').length >= 3;
    if (hasCards) {
      return 'grid';
    }

    // Default to vertical
    return 'vertical';
  }

  /**
   * Calculate component positions based on layout strategy
   *
   * @param components - Component prompts
   * @param layoutStrategy - Layout strategy
   * @param frameWidth - Frame width
   * @returns Components with calculated positions
   */
  calculatePositions(
    components: ComponentPrompt[],
    layoutStrategy: LayoutStrategy,
    frameWidth: number
  ): ComponentPrompt[] {
    switch (layoutStrategy) {
      case 'vertical':
        return this.calculateVerticalLayout(components, frameWidth);
      case 'horizontal':
        return this.calculateHorizontalLayout(components, frameWidth);
      case 'grid':
        return this.calculateGridLayout(components, frameWidth);
      default:
        return components;
    }
  }

  /**
   * Calculate vertical layout positions
   *
   * @param components - Component prompts
   * @param frameWidth - Frame width
   * @returns Components with positions
   */
  private calculateVerticalLayout(
    components: ComponentPrompt[],
    frameWidth: number
  ): ComponentPrompt[] {
    let currentY = 60; // Start below header
    const spacing = this.styleConfig.spacing.md;
    const padding = this.styleConfig.spacing.md;

    return components.map(component => {
      const size = this.getComponentSize(component.componentType, frameWidth - padding * 2);
      const position: ComponentPosition = {
        strategy: 'stack',
        x: padding,
        y: currentY,
      };

      const heightValue = typeof size.height === 'number' ? size.height : 44;
      currentY += heightValue + spacing;

      return {
        ...component,
        position,
        size,
      };
    });
  }

  /**
   * Calculate horizontal layout positions
   *
   * @param components - Component prompts
   * @param frameWidth - Frame width
   * @returns Components with positions
   */
  private calculateHorizontalLayout(
    components: ComponentPrompt[],
    frameWidth: number
  ): ComponentPrompt[] {
    let currentX = this.styleConfig.spacing.md;
    const currentY = 60;
    const spacing = this.styleConfig.spacing.sm;

    return components.map(component => {
      const componentWidth = (frameWidth - this.styleConfig.spacing.md * 2 - spacing * (components.length - 1)) / components.length;
      const size = this.getComponentSize(component.componentType, componentWidth);
      const position: ComponentPosition = {
        strategy: 'stack',
        x: currentX,
        y: currentY,
      };

      const widthValue = typeof size.width === 'number' ? size.width : componentWidth;
      currentX += widthValue + spacing;

      return {
        ...component,
        position,
        size,
      };
    });
  }

  /**
   * Calculate grid layout positions
   *
   * @param components - Component prompts
   * @param frameWidth - Frame width
   * @returns Components with positions
   */
  private calculateGridLayout(
    components: ComponentPrompt[],
    frameWidth: number
  ): ComponentPrompt[] {
    const columns = 2;
    const padding = this.styleConfig.spacing.md;
    const spacing = this.styleConfig.spacing.md;
    const columnWidth = (frameWidth - padding * 2 - spacing * (columns - 1)) / columns;

    let row = 0;
    let col = 0;
    let currentY = 60;

    return components.map(component => {
      const size = this.getComponentSize(component.componentType, columnWidth);
      const x = padding + col * (columnWidth + spacing);
      const y = currentY;

      const position: ComponentPosition = {
        strategy: 'grid',
        row,
        col,
        x,
        y,
      };

      // Move to next position
      col++;
      if (col >= columns) {
        col = 0;
        row++;
        const heightValue = typeof size.height === 'number' ? size.height : 120;
        currentY += heightValue + spacing;
      }

      return {
        ...component,
        position,
        size,
      };
    });
  }

  /**
   * Get default size for component type
   *
   * @param componentType - Component type
   * @param availableWidth - Available width
   * @returns Component size
   */
  private getComponentSize(componentType: ComponentType, availableWidth: number): ComponentSize {
    const sizes: Record<ComponentType, ComponentSize> = {
      SearchBar: { width: availableWidth, height: 44 },
      Button: { width: 'auto', height: 44 },
      Form: { width: availableWidth, height: 'auto' },
      Input: { width: availableWidth, height: 44 },
      Select: { width: availableWidth, height: 44 },
      Checkbox: { width: 'auto', height: 24 },
      Radio: { width: 'auto', height: 24 },
      List: { width: availableWidth, height: 72 },
      Table: { width: availableWidth, height: 'auto' },
      Card: { width: availableWidth, height: 120 },
      Badge: { width: 'auto', height: 24 },
      Dialog: { width: availableWidth, height: 'auto' },
      Modal: { width: availableWidth - 32, height: 'auto' },
      Dropdown: { width: availableWidth, height: 44 },
      Tabs: { width: availableWidth, height: 48 },
      Navigation: { width: availableWidth, height: 56 },
      Menu: { width: 'auto', height: 'auto' },
      Toast: { width: availableWidth, height: 64 },
      Alert: { width: availableWidth, height: 72 },
    };

    return sizes[componentType] || { width: availableWidth, height: 44 };
  }

  /**
   * Generate a text description of the design for Frame0
   *
   * @param prompt - Frame0 design prompt
   * @returns Text description
   */
  generateTextDescription(prompt: Frame0DesignPrompt): string {
    const frame = prompt.frames[0];
    const lines: string[] = [];

    lines.push(`Design a ${frame.frameType} UI for: ${frame.name}`);
    lines.push(`Layout: ${prompt.layoutStrategy}`);
    lines.push('');

    lines.push('Components:');
    frame.components.forEach((component, index) => {
      const desc = this.describeComponent(component);
      lines.push(`${index + 1}. ${desc}`);
    });

    lines.push('');
    lines.push('Style:');
    lines.push(`- Primary color: ${prompt.styleConfig.colors.primary}`);
    lines.push(`- Font: ${prompt.styleConfig.typography.fontFamily}`);
    lines.push(`- Spacing: ${prompt.styleConfig.spacing.md}px`);

    return lines.join('\n');
  }

  /**
   * Describe a component in text
   *
   * @param component - Component prompt
   * @returns Text description
   */
  private describeComponent(component: ComponentPrompt): string {
    const parts: string[] = [component.componentType];

    if (component.label) {
      parts.push(`"${component.label}"`);
    }

    if (component.placeholder) {
      parts.push(`(placeholder: "${component.placeholder}")`);
    }

    if (component.options && component.options.length > 0) {
      parts.push(`with options: ${component.options.slice(0, 3).join(', ')}`);
    }

    if (component.variant) {
      parts.push(`[${component.variant}]`);
    }

    return parts.join(' ');
  }
}
