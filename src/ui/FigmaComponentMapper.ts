/**
 * Figma Component Mapper
 * Epic: UI-004 - Figma Design Import Integration
 *
 * Maps Figma components to acceptance criteria by:
 * 1. Extracting component hierarchy from Figma design context
 * 2. Matching component names to acceptance criteria text
 * 3. Calculating confidence scores for mappings
 * 4. Validating design completeness against requirements
 */

import type {
  FigmaDesignContext,
  FigmaComponentNode,
  FigmaComponentMapping,
  ComponentMappingResult,
  DesignCompletenessValidation,
  FIGMA_COMPONENT_TYPE_MAP,
} from '../types/ui-004.js';
import type { UIRequirement, AcceptanceCriteriaSpec } from '../types/ui-001.js';

/**
 * FigmaComponentMapper maps Figma components to acceptance criteria
 */
export class FigmaComponentMapper {
  /**
   * Map Figma components to acceptance criteria
   */
  public mapComponents(
    figmaContext: FigmaDesignContext,
    uiRequirements: UIRequirement
  ): ComponentMappingResult {
    const mappings: FigmaComponentMapping[] = [];
    const figmaNodes = this.extractAllNodes(figmaContext.componentHierarchy || []);
    const acceptanceCriteria = uiRequirements.acceptance_criteria;

    // For each Figma node, try to find matching acceptance criteria
    for (const node of figmaNodes) {
      const match = this.findBestMatch(node, acceptanceCriteria);

      if (match) {
        mappings.push({
          figmaNodeId: node.id,
          figmaNodeName: node.name,
          acceptanceCriteriaId: match.criteriaId,
          componentType: this.mapFigmaTypeToComponentType(node.type),
          confidence: match.confidence,
          matchReason: match.reason,
        });
      }
    }

    // Calculate coverage
    const mappedNodeIds = new Set(mappings.map(m => m.figmaNodeId));
    const mappedCriteriaIds = new Set(mappings.map(m => m.acceptanceCriteriaId));

    const unmappedFigmaNodes = figmaNodes
      .filter(n => !mappedNodeIds.has(n.id))
      .map(n => `${n.name} (${n.id})`);

    const unmappedAcceptanceCriteria = acceptanceCriteria
      .filter(ac => !mappedCriteriaIds.has(ac.id))
      .map(ac => ac.id);

    const coverage = acceptanceCriteria.length > 0
      ? mappedCriteriaIds.size / acceptanceCriteria.length
      : 0;

    return {
      mappings,
      unmappedFigmaNodes,
      unmappedAcceptanceCriteria,
      coverage,
    };
  }

  /**
   * Validate design completeness against requirements
   */
  public validateCompleteness(
    mappingResult: ComponentMappingResult,
    uiRequirements: UIRequirement
  ): DesignCompletenessValidation {
    const warnings: string[] = [];
    const missingComponents: string[] = [];

    // Check if coverage is below threshold
    if (mappingResult.coverage < 0.8) {
      warnings.push(
        `Low design coverage: ${(mappingResult.coverage * 100).toFixed(0)}%. Some acceptance criteria may be missing from design.`
      );
    }

    // Check for unmapped acceptance criteria
    if (mappingResult.unmappedAcceptanceCriteria.length > 0) {
      missingComponents.push(...mappingResult.unmappedAcceptanceCriteria);
      warnings.push(
        `${mappingResult.unmappedAcceptanceCriteria.length} acceptance criteria not found in design: ${mappingResult.unmappedAcceptanceCriteria.join(', ')}`
      );
    }

    // Check for unmapped Figma nodes
    if (mappingResult.unmappedFigmaNodes.length > 0) {
      warnings.push(
        `${mappingResult.unmappedFigmaNodes.length} Figma components not mapped to requirements. This may indicate extra UI elements or incorrect naming.`
      );
    }

    // Check for low confidence mappings
    const lowConfidenceMappings = mappingResult.mappings.filter(m => m.confidence < 0.6);
    if (lowConfidenceMappings.length > 0) {
      warnings.push(
        `${lowConfidenceMappings.length} component mappings have low confidence (<60%). Manual review recommended.`
      );
    }

    const complete = mappingResult.coverage >= 0.8 && missingComponents.length === 0;

    return {
      complete,
      coverage: mappingResult.coverage,
      missingComponents,
      warnings,
    };
  }

  /**
   * Extract all nodes from component hierarchy (flatten tree)
   */
  private extractAllNodes(nodes: FigmaComponentNode[]): FigmaComponentNode[] {
    const result: FigmaComponentNode[] = [];

    for (const node of nodes) {
      result.push(node);

      if (node.children && node.children.length > 0) {
        result.push(...this.extractAllNodes(node.children));
      }
    }

    return result;
  }

  /**
   * Find best matching acceptance criteria for a Figma node
   */
  private findBestMatch(
    node: FigmaComponentNode,
    acceptanceCriteria: AcceptanceCriteriaSpec[]
  ): { criteriaId: string; confidence: number; reason: string } | null {
    let bestMatch: { criteriaId: string; confidence: number; reason: string } | null = null;
    let highestConfidence = 0;

    for (const criteria of acceptanceCriteria) {
      const match = this.calculateMatch(node, criteria);

      if (match.confidence > highestConfidence) {
        highestConfidence = match.confidence;
        bestMatch = {
          criteriaId: criteria.id,
          confidence: match.confidence,
          reason: match.reason,
        };
      }
    }

    // Only return matches with confidence > 0.4
    if (bestMatch && bestMatch.confidence > 0.4) {
      return bestMatch;
    }

    return null;
  }

  /**
   * Calculate match score between Figma node and acceptance criteria
   */
  private calculateMatch(
    node: FigmaComponentNode,
    criteria: AcceptanceCriteriaSpec
  ): { confidence: number; reason: string } {
    let confidence = 0;
    const reasons: string[] = [];

    // Normalize strings for comparison
    const nodeName = node.name.toLowerCase();
    const criteriaText = criteria.text.toLowerCase();

    // Check for exact name match (high confidence)
    if (nodeName.includes(criteriaText) || criteriaText.includes(nodeName)) {
      confidence += 0.8;
      reasons.push('exact name match');
    }

    // Check for keyword matches
    const keywords = this.extractKeywords(criteriaText);
    const matchedKeywords = keywords.filter(kw => nodeName.includes(kw));

    if (matchedKeywords.length > 0) {
      const keywordScore = (matchedKeywords.length / keywords.length) * 0.6;
      confidence += keywordScore;
      reasons.push(`${matchedKeywords.length} keyword matches`);
    }

    // Check for component type match
    const expectedComponentType = this.inferComponentTypeFromCriteria(criteria);
    const nodeComponentType = this.mapFigmaTypeToComponentType(node.type);

    if (expectedComponentType && nodeComponentType.toLowerCase().includes(expectedComponentType.toLowerCase())) {
      confidence += 0.3;
      reasons.push('component type match');
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    return {
      confidence,
      reason: reasons.length > 0 ? reasons.join(', ') : 'no strong match',
    };
  }

  /**
   * Extract keywords from criteria text
   */
  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can']);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.has(word));
  }

  /**
   * Infer expected component type from acceptance criteria
   */
  private inferComponentTypeFromCriteria(criteria: AcceptanceCriteriaSpec): string | null {
    const text = criteria.text.toLowerCase();

    // Check UI elements if available
    if (criteria.ui_elements && criteria.ui_elements.length > 0) {
      return criteria.ui_elements[0].component;
    }

    // Fallback to pattern matching
    if (text.includes('button')) return 'Button';
    if (text.includes('input') || text.includes('field')) return 'Input';
    if (text.includes('form')) return 'Form';
    if (text.includes('list')) return 'List';
    if (text.includes('table')) return 'Table';
    if (text.includes('card')) return 'Card';
    if (text.includes('modal') || text.includes('dialog')) return 'Dialog';
    if (text.includes('menu') || text.includes('dropdown')) return 'Dropdown';

    return null;
  }

  /**
   * Map Figma node type to generic component type
   */
  private mapFigmaTypeToComponentType(figmaType: string): string {
    const typeMap: Record<string, string> = {
      FRAME: 'Container',
      RECTANGLE: 'Box',
      TEXT: 'Text',
      BUTTON: 'Button',
      INPUT: 'Input',
      COMPONENT: 'Component',
      INSTANCE: 'ComponentInstance',
      GROUP: 'Group',
      VECTOR: 'Icon',
      ELLIPSE: 'Icon',
      LINE: 'Divider',
    };

    return typeMap[figmaType] || figmaType;
  }
}
