/**
 * Requirements Analyzer
 * Analyzes acceptance criteria to extract UI elements, flows, and data needs
 * Epic: UI-001 - Requirements Analysis Engine
 */

import type {
  ParsedAcceptanceCriterion,
  RequirementsAnalysis,
  UIElementMatch,
  UserFlowDetection,
  DataNeedDetection,
  NavigationDetection,
  DesignConstraintDetection,
  ComponentType,
  OperationType,
  AnalysisPattern,
  PatternMatch,
} from '../types/ui-001.js';

/**
 * Analyzer class for extracting UI requirements from acceptance criteria
 */
export class RequirementsAnalyzer {
  private patterns: AnalysisPattern[];

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Analyze acceptance criteria to extract UI requirements
   *
   * @param criteria - Array of parsed acceptance criteria
   * @returns Requirements analysis with UI elements, flows, data needs, etc.
   */
  analyze(criteria: ParsedAcceptanceCriterion[]): RequirementsAnalysis {
    const uiElements: UIElementMatch[] = [];
    const userFlows: UserFlowDetection[] = [];
    const dataNeeds: DataNeedDetection[] = [];
    const navigationNeeds: NavigationDetection[] = [];
    const designConstraints: DesignConstraintDetection[] = [];

    for (const ac of criteria) {
      // Detect UI elements
      const elements = this.detectUIElements(ac);
      uiElements.push(...elements);

      // Detect user flows
      const flows = this.detectUserFlows(ac);
      if (flows) {
        userFlows.push(flows);
      }

      // Detect data needs
      const data = this.detectDataNeeds(ac);
      dataNeeds.push(...data);

      // Detect navigation
      const nav = this.detectNavigation(ac);
      if (nav) {
        navigationNeeds.push(nav);
      }

      // Detect design constraints
      const constraints = this.detectDesignConstraints(ac);
      designConstraints.push(...constraints);
    }

    return {
      uiElements,
      userFlows,
      dataNeeds,
      navigationNeeds,
      designConstraints,
    };
  }

  /**
   * Detect UI elements from acceptance criterion
   *
   * @param ac - Acceptance criterion
   * @returns Array of detected UI elements
   */
  private detectUIElements(ac: ParsedAcceptanceCriterion): UIElementMatch[] {
    const elements: UIElementMatch[] = [];
    const text = ac.text.toLowerCase();

    // Try each pattern
    for (const pattern of this.patterns) {
      const match = text.match(pattern.pattern);
      if (match) {
        const props = pattern.extractProps ? pattern.extractProps(match) : undefined;

        elements.push({
          acceptanceCriterionId: ac.id,
          component: pattern.componentType,
          confidence: pattern.confidence || 0.8,
          matchedPattern: pattern.name,
          extractedProps: props,
        });
      }
    }

    return elements;
  }

  /**
   * Detect user flows from acceptance criterion
   *
   * @param ac - Acceptance criterion
   * @returns Detected user flow or null
   */
  private detectUserFlows(ac: ParsedAcceptanceCriterion): UserFlowDetection | null {
    const text = ac.text.toLowerCase();

    // Look for action sequences (e.g., "click X then Y", "after X, Y happens")
    const flowPatterns = [
      /(\w+)\s+(?:clicks?|presses?|taps?)\s+(.+?)\s+(?:then|and)\s+(.+)/i,
      /(?:when|after)\s+(.+?),\s+(.+)/i,
      /(.+?)\s+triggers?\s+(.+)/i,
    ];

    for (const pattern of flowPatterns) {
      const match = text.match(pattern);
      if (match) {
        const steps = this.extractFlowSteps(ac.text);
        if (steps.length > 0) {
          return {
            acceptanceCriterionId: ac.id,
            steps,
            confidence: 0.7,
            matchedPattern: 'flow_sequence',
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract flow steps from AC text
   *
   * @param text - AC text
   * @returns Array of flow steps
   */
  private extractFlowSteps(text: string): Array<{ step: number; action: string }> {
    const steps: Array<{ step: number; action: string }> = [];

    // Look for numbered steps or sequential actions
    const actionWords = ['click', 'press', 'tap', 'enter', 'select', 'submit', 'navigate'];
    const words = text.toLowerCase().split(/\s+/);

    let stepNum = 1;
    for (let i = 0; i < words.length; i++) {
      if (actionWords.some(action => words[i].includes(action))) {
        // Extract action context (5 words before and after)
        const start = Math.max(0, i - 5);
        const end = Math.min(words.length, i + 6);
        const action = words.slice(start, end).join(' ');

        steps.push({
          step: stepNum++,
          action: this.cleanActionText(action),
        });
      }
    }

    return steps;
  }

  /**
   * Detect data needs from acceptance criterion
   *
   * @param ac - Acceptance criterion
   * @returns Array of detected data needs
   */
  private detectDataNeeds(ac: ParsedAcceptanceCriterion): DataNeedDetection[] {
    const needs: DataNeedDetection[] = [];
    const text = ac.text.toLowerCase();

    // Detect CRUD operations
    const operations: Array<{ keywords: string[]; op: OperationType }> = [
      { keywords: ['create', 'add', 'new', 'register'], op: 'create' },
      { keywords: ['view', 'display', 'show', 'list', 'get'], op: 'list' },
      { keywords: ['edit', 'update', 'modify', 'change'], op: 'update' },
      { keywords: ['delete', 'remove', 'ban', 'deactivate'], op: 'delete' },
      { keywords: ['search', 'filter', 'find', 'query'], op: 'search' },
    ];

    for (const { keywords, op } of operations) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          // Extract entity name (heuristic: noun after keyword)
          const entity = this.extractEntityName(text, keyword);

          // Extract field names if present
          const fields = this.extractFieldNames(text);

          needs.push({
            entity,
            operation: op,
            fields,
            confidence: 0.6,
            matchedPattern: keyword,
          });

          break; // Only match first keyword per operation
        }
      }
    }

    return needs;
  }

  /**
   * Detect navigation from acceptance criterion
   *
   * @param ac - Acceptance criterion
   * @returns Detected navigation or null
   */
  private detectNavigation(ac: ParsedAcceptanceCriterion): NavigationDetection | null {
    const text = ac.text.toLowerCase();

    // Look for navigation keywords
    const navPatterns = [
      { pattern: /navigate\s+(?:to|from)\s+(.+?)\s+(?:to|page)/i, confidence: 0.9 },
      { pattern: /(?:go|redirect)\s+to\s+(.+)/i, confidence: 0.8 },
      { pattern: /(?:open|view)\s+(.+?)\s+(?:page|screen|view)/i, confidence: 0.7 },
    ];

    for (const { pattern, confidence } of navPatterns) {
      const match = text.match(pattern);
      if (match) {
        const toPage = this.cleanPageName(match[1]);

        return {
          fromPage: 'current',
          toPage,
          trigger: 'user_action',
          confidence,
          matchedPattern: 'navigation',
        };
      }
    }

    return null;
  }

  /**
   * Detect design constraints from acceptance criterion
   *
   * @param ac - Acceptance criterion
   * @returns Array of detected design constraints
   */
  private detectDesignConstraints(ac: ParsedAcceptanceCriterion): DesignConstraintDetection[] {
    const constraints: DesignConstraintDetection[] = [];
    const text = ac.text.toLowerCase();

    // Accessibility patterns
    if (/(keyboard|screen reader|wcag|accessible|aria)/i.test(text)) {
      constraints.push({
        type: 'accessibility',
        constraint: 'Requires accessibility support',
        confidence: 0.8,
        matchedPattern: 'accessibility',
      });
    }

    // Responsive patterns
    if (/(mobile|tablet|desktop|responsive|breakpoint)/i.test(text)) {
      constraints.push({
        type: 'responsive',
        constraint: 'Requires responsive design',
        confidence: 0.8,
        matchedPattern: 'responsive',
      });
    }

    // Performance patterns
    if (/(fast|quick|instant|loading|performance)/i.test(text)) {
      constraints.push({
        type: 'performance',
        constraint: 'Has performance requirements',
        confidence: 0.7,
        matchedPattern: 'performance',
      });
    }

    return constraints;
  }

  /**
   * Initialize UI element detection patterns
   *
   * @returns Array of analysis patterns
   */
  private initializePatterns(): AnalysisPattern[] {
    return [
      {
        name: 'search',
        pattern: /search|filter|find/i,
        componentType: 'SearchBar',
        extractProps: (match) => ({
          placeholder: 'Search...',
        }),
        confidence: 0.9,
      },
      {
        name: 'form',
        pattern: /form|input|enter|submit/i,
        componentType: 'Form',
        confidence: 0.8,
      },
      {
        name: 'list',
        pattern: /list|display.*items|show.*results/i,
        componentType: 'List',
        confidence: 0.8,
      },
      {
        name: 'table',
        pattern: /table|grid|column/i,
        componentType: 'Table',
        confidence: 0.9,
      },
      {
        name: 'button',
        pattern: /button|click|action/i,
        componentType: 'Button',
        confidence: 0.7,
      },
      {
        name: 'badge',
        pattern: /badge|label|tag|status/i,
        componentType: 'Badge',
        confidence: 0.8,
      },
      {
        name: 'dialog',
        pattern: /dialog|modal|popup|confirm/i,
        componentType: 'Dialog',
        confidence: 0.9,
      },
      {
        name: 'dropdown',
        pattern: /dropdown|select|choose/i,
        componentType: 'Dropdown',
        confidence: 0.8,
      },
      {
        name: 'checkbox',
        pattern: /checkbox|check|toggle/i,
        componentType: 'Checkbox',
        confidence: 0.8,
      },
      {
        name: 'radio',
        pattern: /radio|option|choice/i,
        componentType: 'Radio',
        confidence: 0.7,
      },
      {
        name: 'tabs',
        pattern: /tab|section|panel/i,
        componentType: 'Tabs',
        confidence: 0.7,
      },
      {
        name: 'navigation',
        pattern: /navigate|menu|sidebar/i,
        componentType: 'Navigation',
        confidence: 0.8,
      },
      {
        name: 'alert',
        pattern: /alert|warning|error|notification/i,
        componentType: 'Alert',
        confidence: 0.8,
      },
      {
        name: 'card',
        pattern: /card|tile|panel/i,
        componentType: 'Card',
        confidence: 0.7,
      },
    ];
  }

  /**
   * Extract entity name from text (heuristic)
   *
   * @param text - AC text
   * @param keyword - Operation keyword
   * @returns Extracted entity name
   */
  private extractEntityName(text: string, keyword: string): string {
    // Simple heuristic: Look for noun after keyword
    const pattern = new RegExp(`${keyword}\\s+(\\w+)`, 'i');
    const match = text.match(pattern);

    if (match) {
      const entity = match[1];
      // Capitalize first letter
      return entity.charAt(0).toUpperCase() + entity.slice(1);
    }

    return 'Entity';
  }

  /**
   * Extract field names from text (heuristic)
   *
   * @param text - AC text
   * @returns Array of field names
   */
  private extractFieldNames(text: string): string[] {
    const fields: string[] = [];

    // Look for common field indicators
    const fieldPatterns = [
      /by\s+(email|name|id|status|role|date)/gi,
      /(?:show|display)\s+(name|email|status|role|id)/gi,
    ];

    for (const pattern of fieldPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        fields.push(match[1].toLowerCase());
      }
    }

    return [...new Set(fields)]; // Remove duplicates
  }

  /**
   * Clean action text for user flow steps
   *
   * @param action - Raw action text
   * @returns Cleaned action text
   */
  private cleanActionText(action: string): string {
    return action.trim().replace(/\s+/g, ' ').substring(0, 100);
  }

  /**
   * Clean page name for navigation
   *
   * @param pageName - Raw page name
   * @returns Cleaned page name
   */
  private cleanPageName(pageName: string): string {
    return pageName
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}

/**
 * Convenience function to analyze acceptance criteria
 *
 * @param criteria - Array of parsed acceptance criteria
 * @returns Requirements analysis
 */
export function analyzeRequirements(
  criteria: ParsedAcceptanceCriterion[]
): RequirementsAnalysis {
  const analyzer = new RequirementsAnalyzer();
  return analyzer.analyze(criteria);
}
