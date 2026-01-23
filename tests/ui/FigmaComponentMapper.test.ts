/**
 * Unit tests for FigmaComponentMapper
 * Epic: UI-004 - Figma Design Import Integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { FigmaComponentMapper } from '../../src/ui/FigmaComponentMapper.js';
import type { FigmaDesignContext, FigmaComponentNode } from '../../src/types/ui-004.js';
import type { UIRequirement, AcceptanceCriteriaSpec } from '../../src/types/ui-001.js';

describe('FigmaComponentMapper', () => {
  let mapper: FigmaComponentMapper;

  beforeEach(() => {
    mapper = new FigmaComponentMapper();
  });

  describe('mapComponents', () => {
    it('should map exact name matches with high confidence', () => {
      const figmaContext: FigmaDesignContext = {
        componentHierarchy: [
          { id: '1', name: 'Login Button', type: 'BUTTON' },
        ],
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          {
            id: 'AC-001',
            text: 'User can click login button',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = mapper.mapComponents(figmaContext, uiRequirements);

      expect(result.mappings.length).toBeGreaterThan(0);
      expect(result.mappings[0].figmaNodeName).toBe('Login Button');
      expect(result.mappings[0].acceptanceCriteriaId).toBe('AC-001');
      expect(result.mappings[0].confidence).toBeGreaterThan(0.5);
    });

    it('should handle nested component hierarchy', () => {
      const figmaContext: FigmaDesignContext = {
        componentHierarchy: [
          {
            id: '1',
            name: 'Form Container',
            type: 'FRAME',
            children: [
              { id: '2', name: 'Email Input', type: 'INPUT' },
              { id: '3', name: 'Submit Button', type: 'BUTTON' },
            ],
          },
        ],
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          {
            id: 'AC-001',
            text: 'User can enter email',
            ui_elements: [{ component: 'Input' }],
            user_flow: [],
          },
          {
            id: 'AC-002',
            text: 'User can submit form',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = mapper.mapComponents(figmaContext, uiRequirements);

      // Should map both nested components
      expect(result.mappings.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate coverage correctly', () => {
      const figmaContext: FigmaDesignContext = {
        componentHierarchy: [
          { id: '1', name: 'Button One', type: 'BUTTON' },
        ],
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          {
            id: 'AC-001',
            text: 'User can click button one',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
          {
            id: 'AC-002',
            text: 'User can click button two',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = mapper.mapComponents(figmaContext, uiRequirements);

      // Only one AC mapped out of two = 50% coverage
      expect(result.coverage).toBe(0.5);
      expect(result.unmappedAcceptanceCriteria).toContain('AC-002');
    });
  });

  describe('validateCompleteness', () => {
    it('should mark design as complete with high coverage', () => {
      const mappingResult = {
        mappings: [
          {
            figmaNodeId: '1',
            figmaNodeName: 'Button',
            acceptanceCriteriaId: 'AC-001',
            componentType: 'Button',
            confidence: 0.9,
            matchReason: 'exact match',
          },
        ],
        unmappedFigmaNodes: [],
        unmappedAcceptanceCriteria: [],
        coverage: 1.0,
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          {
            id: 'AC-001',
            text: 'User can click button',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const validation = mapper.validateCompleteness(mappingResult, uiRequirements);

      expect(validation.complete).toBe(true);
      expect(validation.coverage).toBe(1.0);
      expect(validation.missingComponents).toHaveLength(0);
    });

    it('should mark design as incomplete with low coverage', () => {
      const mappingResult = {
        mappings: [
          {
            figmaNodeId: '1',
            figmaNodeName: 'Button',
            acceptanceCriteriaId: 'AC-001',
            componentType: 'Button',
            confidence: 0.9,
            matchReason: 'exact match',
          },
        ],
        unmappedFigmaNodes: [],
        unmappedAcceptanceCriteria: ['AC-002', 'AC-003'],
        coverage: 0.33,
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          { id: 'AC-001', text: 'AC 1', ui_elements: [], user_flow: [] },
          { id: 'AC-002', text: 'AC 2', ui_elements: [], user_flow: [] },
          { id: 'AC-003', text: 'AC 3', ui_elements: [], user_flow: [] },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const validation = mapper.validateCompleteness(mappingResult, uiRequirements);

      expect(validation.complete).toBe(false);
      expect(validation.coverage).toBe(0.33);
      expect(validation.missingComponents).toHaveLength(2);
      expect(validation.warnings.length).toBeGreaterThan(0);
    });

    it('should warn about low confidence mappings', () => {
      const mappingResult = {
        mappings: [
          {
            figmaNodeId: '1',
            figmaNodeName: 'Button',
            acceptanceCriteriaId: 'AC-001',
            componentType: 'Button',
            confidence: 0.5, // Low confidence
            matchReason: 'weak match',
          },
        ],
        unmappedFigmaNodes: [],
        unmappedAcceptanceCriteria: [],
        coverage: 1.0,
      };

      const uiRequirements: UIRequirement = {
        id: 1,
        epic_id: 'epic-001',
        project_name: 'test-project',
        acceptance_criteria: [
          {
            id: 'AC-001',
            text: 'User can click button',
            ui_elements: [{ component: 'Button' }],
            user_flow: [],
          },
        ],
        user_stories: [],
        data_requirements: { entities: [], operations: [] },
        navigation_needs: { pages: [], transitions: [] },
        design_constraints: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const validation = mapper.validateCompleteness(mappingResult, uiRequirements);

      expect(validation.warnings.some(w => w.includes('low confidence'))).toBe(true);
    });
  });
});
