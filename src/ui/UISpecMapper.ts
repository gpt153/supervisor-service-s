/**
 * UI Spec Mapper
 * Maps parsed epic and analysis results to structured UI specification
 * Epic: UI-001 - Requirements Analysis Engine
 */

import type {
  ParsedEpic,
  RequirementsAnalysis,
  UIRequirement,
  AcceptanceCriteriaSpec,
  UserStory,
  DataRequirements,
  NavigationNeeds,
  DesignConstraints,
  UIElement,
  EntityRequirement,
  DataOperation,
  PageDefinition,
  PageTransition,
} from '../types/ui-001.js';

/**
 * Mapper class for converting parsed epic and analysis to UI specification
 */
export class UISpecMapper {
  /**
   * Map parsed epic and analysis to UI requirement spec
   *
   * @param parsedEpic - Parsed epic data
   * @param analysis - Requirements analysis
   * @returns UI requirement specification (omitting id, created_at, updated_at)
   */
  mapToUISpec(
    parsedEpic: ParsedEpic,
    analysis: RequirementsAnalysis
  ): Omit<UIRequirement, 'id' | 'created_at' | 'updated_at'> {
    return {
      epic_id: parsedEpic.epicId,
      project_name: parsedEpic.projectName,
      acceptance_criteria: this.mapAcceptanceCriteria(parsedEpic, analysis),
      user_stories: this.mapUserStories(parsedEpic),
      data_requirements: this.mapDataRequirements(analysis),
      navigation_needs: this.mapNavigationNeeds(analysis),
      design_constraints: this.mapDesignConstraints(analysis),
    };
  }

  /**
   * Map acceptance criteria with UI elements and flows
   *
   * @param parsedEpic - Parsed epic data
   * @param analysis - Requirements analysis
   * @returns Array of acceptance criteria specifications
   */
  private mapAcceptanceCriteria(
    parsedEpic: ParsedEpic,
    analysis: RequirementsAnalysis
  ): AcceptanceCriteriaSpec[] {
    return parsedEpic.acceptanceCriteria.map(ac => {
      // Find UI elements for this AC
      const uiElements = analysis.uiElements
        .filter(el => el.acceptanceCriterionId === ac.id)
        .map(el => this.mapUIElement(el));

      // Find user flow for this AC
      const flowDetection = analysis.userFlows.find(
        flow => flow.acceptanceCriterionId === ac.id
      );

      const userFlow = flowDetection ? flowDetection.steps : [];

      return {
        id: ac.id,
        text: ac.text,
        ui_elements: uiElements,
        user_flow: userFlow,
      };
    });
  }

  /**
   * Map UI element match to UI element spec
   *
   * @param elementMatch - UI element match from analysis
   * @returns UI element specification
   */
  private mapUIElement(elementMatch: {
    component: string;
    confidence: number;
    extractedProps?: Record<string, any>;
    location?: string;
  }): UIElement {
    return {
      component: elementMatch.component as any,
      props: elementMatch.extractedProps,
      location: elementMatch.location,
    };
  }

  /**
   * Map user stories
   *
   * @param parsedEpic - Parsed epic data
   * @returns Array of user stories
   */
  private mapUserStories(parsedEpic: ParsedEpic): UserStory[] {
    return parsedEpic.userStories.map(story => ({
      role: story.role,
      goal: story.goal,
      benefit: story.benefit,
    }));
  }

  /**
   * Map data requirements
   *
   * @param analysis - Requirements analysis
   * @returns Data requirements specification
   */
  private mapDataRequirements(analysis: RequirementsAnalysis): DataRequirements {
    // Group data needs by entity
    const entitiesByName = new Map<string, EntityRequirement>();

    for (const need of analysis.dataNeeds) {
      const entityName = need.entity;

      // Get or create entity
      let entity = entitiesByName.get(entityName);
      if (!entity) {
        entity = {
          name: entityName,
          fields: need.fields.map(fieldName => ({
            name: fieldName,
            type: this.inferFieldType(fieldName),
            required: false,
          })),
        };
        entitiesByName.set(entityName, entity);
      } else {
        // Add new fields if not already present
        for (const fieldName of need.fields) {
          if (!entity.fields.some(f => f.name === fieldName)) {
            entity.fields.push({
              name: fieldName,
              type: this.inferFieldType(fieldName),
              required: false,
            });
          }
        }
      }
    }

    // Create operations list
    const operations: DataOperation[] = analysis.dataNeeds.map(need => ({
      type: need.operation,
      entity: need.entity,
      fields: need.fields,
    }));

    return {
      entities: Array.from(entitiesByName.values()),
      operations,
    };
  }

  /**
   * Map navigation needs
   *
   * @param analysis - Requirements analysis
   * @returns Navigation needs specification
   */
  private mapNavigationNeeds(analysis: RequirementsAnalysis): NavigationNeeds {
    // Extract unique pages
    const pageNames = new Set<string>();

    for (const nav of analysis.navigationNeeds) {
      if (nav.fromPage !== 'current') {
        pageNames.add(nav.fromPage);
      }
      pageNames.add(nav.toPage);
    }

    // Create page definitions
    const pages: PageDefinition[] = Array.from(pageNames).map(pageName => ({
      name: pageName,
      path: this.pageNameToPath(pageName),
      title: this.pageNameToTitle(pageName),
    }));

    // Create transitions
    const transitions: PageTransition[] = analysis.navigationNeeds.map(nav => ({
      from: nav.fromPage === 'current' ? 'any' : nav.fromPage,
      to: nav.toPage,
      trigger: nav.trigger,
    }));

    return {
      pages,
      transitions,
    };
  }

  /**
   * Map design constraints
   *
   * @param analysis - Requirements analysis
   * @returns Design constraints specification or null
   */
  private mapDesignConstraints(analysis: RequirementsAnalysis): DesignConstraints | null {
    if (analysis.designConstraints.length === 0) {
      return null;
    }

    const constraints: DesignConstraints = {};

    // Check for accessibility constraints
    const hasAccessibility = analysis.designConstraints.some(c => c.type === 'accessibility');
    if (hasAccessibility) {
      constraints.accessibility = {
        wcagLevel: 'AA',
        keyboardNavigation: true,
        screenReaderSupport: true,
        focusIndicators: true,
      };
    }

    // Check for responsive constraints
    const hasResponsive = analysis.designConstraints.some(c => c.type === 'responsive');
    if (hasResponsive) {
      constraints.responsive = {
        breakpoints: ['mobile', 'tablet', 'desktop'],
        mobileFirst: true,
      };
    }

    // Check for performance constraints
    const hasPerformance = analysis.designConstraints.some(c => c.type === 'performance');
    if (hasPerformance) {
      constraints.performance = {
        maxLoadTime: 3000,
        maxInteractionTime: 100,
        lazyLoading: true,
      };
    }

    return Object.keys(constraints).length > 0 ? constraints : null;
  }

  /**
   * Infer field type from field name (heuristic)
   *
   * @param fieldName - Field name
   * @returns Inferred field type
   */
  private inferFieldType(fieldName: string): 'string' | 'number' | 'boolean' | 'date' | 'email' {
    const name = fieldName.toLowerCase();

    if (name.includes('email')) {
      return 'email';
    }
    if (name.includes('date') || name.includes('time')) {
      return 'date';
    }
    if (name.includes('count') || name.includes('number') || name.includes('age')) {
      return 'number';
    }
    if (name.includes('is') || name.includes('has') || name.includes('active')) {
      return 'boolean';
    }

    return 'string';
  }

  /**
   * Convert page name to URL path
   *
   * @param pageName - Page name (e.g., "UserManagementDashboard")
   * @returns URL path (e.g., "/user-management-dashboard")
   */
  private pageNameToPath(pageName: string): string {
    return '/' + pageName
      .replace(/([A-Z])/g, '-$1')
      .toLowerCase()
      .replace(/^-/, '');
  }

  /**
   * Convert page name to human-readable title
   *
   * @param pageName - Page name (e.g., "UserManagementDashboard")
   * @returns Title (e.g., "User Management Dashboard")
   */
  private pageNameToTitle(pageName: string): string {
    return pageName
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/^\w/, c => c.toUpperCase());
  }
}

/**
 * Convenience function to map to UI spec
 *
 * @param parsedEpic - Parsed epic data
 * @param analysis - Requirements analysis
 * @returns UI requirement specification
 */
export function mapToUISpec(
  parsedEpic: ParsedEpic,
  analysis: RequirementsAnalysis
): Omit<UIRequirement, 'id' | 'created_at' | 'updated_at'> {
  const mapper = new UISpecMapper();
  return mapper.mapToUISpec(parsedEpic, analysis);
}
