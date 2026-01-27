/**
 * Type definitions for Frame0 Design Generation (Epic UI-003)
 *
 * This module defines types for generating UI designs using Frame0 from
 * structured UI requirements extracted in Epic UI-001.
 */

import { Timestamps } from './database.js';
import type { UIRequirement, ComponentType, AcceptanceCriteriaSpec } from './ui-001.js';

// ============================================================================
// Database Types
// ============================================================================

/**
 * UI Mockup database record (extends existing ui_mockups table)
 */
export interface UIMockup extends Timestamps {
  id: number;
  epic_id: string;
  project_name: string;
  design_method: DesignMethod;
  design_url: string | null;
  design_data: DesignData | null;
  dev_port: number | null;
  dev_url: string | null;
  status: MockupStatus;
  // Frame0-specific fields (added in migration 1769174510000)
  frame0_page_id: string | null;
  frame0_design_export: string | null; // Base64-encoded image
  component_mapping: ComponentMapping | null;
}

/**
 * Design generation method
 */
export type DesignMethod = 'frame0' | 'figma';

/**
 * Mockup status
 */
export type MockupStatus = 'draft' | 'approved' | 'connected' | 'archived';

/**
 * Design data (JSONB stored in design_data column)
 */
export interface DesignData {
  frames: Frame0Frame[];
  styleConfig?: StyleConfig;
  metadata?: DesignMetadata;
}

/**
 * Mapping of Frame0 shape IDs to acceptance criteria IDs
 */
export interface ComponentMapping {
  [shapeId: string]: string; // shape ID -> AC ID
}

// ============================================================================
// Frame0 Design Types
// ============================================================================

/**
 * Frame0 frame (container for UI components)
 */
export interface Frame0Frame {
  id: string;
  name: string;
  frameType: Frame0FrameType;
  x: number;
  y: number;
  width: number;
  height: number;
  components: Frame0Component[];
}

/**
 * Frame0 frame types
 */
export type Frame0FrameType = 'phone' | 'tablet' | 'desktop' | 'browser' | 'watch' | 'tv';

/**
 * Frame0 component (rectangle, text, button, etc.)
 */
export interface Frame0Component {
  id: string;
  type: Frame0ComponentType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  props: Frame0ComponentProps;
  acceptanceCriteriaId?: string; // Link to AC that generated this component
}

/**
 * Frame0 component types
 */
export type Frame0ComponentType =
  | 'rectangle'
  | 'text'
  | 'ellipse'
  | 'line'
  | 'icon'
  | 'group';

/**
 * Frame0 component properties
 */
export interface Frame0ComponentProps {
  // Common properties
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;

  // Text-specific
  text?: string;
  fontSize?: number;
  fontColor?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';

  // Rectangle-specific
  cornerRadius?: number;
  corners?: [number, number, number, number]; // [TL, TR, BR, BL]

  // Icon-specific
  iconName?: string;
  iconSize?: 'small' | 'medium' | 'large' | 'extra-large';

  // Custom props
  [key: string]: any;
}

/**
 * Style configuration
 */
export interface StyleConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    text: string;
    border: string;
  };
  typography: {
    fontFamily: string;
    heading: { fontSize: number; fontWeight: string };
    body: { fontSize: number; fontWeight: string };
    small: { fontSize: number; fontWeight: string };
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

/**
 * Design metadata
 */
export interface DesignMetadata {
  generatedAt: string;
  version: string;
  totalComponents: number;
  complexity: 'simple' | 'medium' | 'complex';
}

// ============================================================================
// Prompt Generation Types
// ============================================================================

/**
 * Frame0 design prompt (generated from UI requirements)
 */
export interface Frame0DesignPrompt {
  frames: Frame0FramePrompt[];
  styleConfig: StyleConfig;
  layoutStrategy: LayoutStrategy;
}

/**
 * Frame0 frame prompt
 */
export interface Frame0FramePrompt {
  name: string;
  frameType: Frame0FrameType;
  components: ComponentPrompt[];
}

/**
 * Component prompt (instructions for creating a component)
 */
export interface ComponentPrompt {
  componentType: ComponentType; // From UI-001
  acceptanceCriteriaId: string;
  label?: string;
  placeholder?: string;
  options?: string[];
  variant?: string;
  position?: ComponentPosition;
  size?: ComponentSize;
}

/**
 * Component position strategy
 */
export interface ComponentPosition {
  strategy: 'stack' | 'grid' | 'absolute';
  x?: number;
  y?: number;
  row?: number;
  col?: number;
  offset?: { x: number; y: number };
}

/**
 * Component size
 */
export interface ComponentSize {
  width: number | 'auto' | 'full';
  height: number | 'auto';
}

/**
 * Layout strategy for arranging components
 */
export type LayoutStrategy = 'vertical' | 'horizontal' | 'grid' | 'custom';

// ============================================================================
// Component Mapping Types
// ============================================================================

/**
 * Maps UI component types to Frame0 component specifications
 */
export interface ComponentMappingSpec {
  componentType: ComponentType;
  frame0Components: Frame0ComponentSpec[];
  spacing: { x: number; y: number };
}

/**
 * Frame0 component specification
 */
export interface Frame0ComponentSpec {
  type: Frame0ComponentType;
  props: Partial<Frame0ComponentProps>;
  relativePosition?: { x: number; y: number };
  size?: ComponentSize;
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for ui_generate_design MCP tool
 */
export interface GenerateDesignParams {
  epicId: string;
  method: DesignMethod;
  prompt?: string; // Optional custom prompt override
  frameType?: Frame0FrameType;
  styleConfig?: Partial<StyleConfig>;
}

/**
 * Result of ui_generate_design MCP tool
 */
export interface GenerateDesignResult {
  success: boolean;
  mockup?: UIMockup;
  previewImage?: string; // Base64-encoded image
  designUrl?: string; // Frame0 design URL
  error?: string;
  warnings?: string[];
}

/**
 * Parameters for iterating on a design
 */
export interface IterateDesignParams {
  epicId: string;
  feedback: string;
  preserveComponents?: string[]; // AC IDs to preserve
}

/**
 * Result of design iteration
 */
export interface IterateDesignResult {
  success: boolean;
  mockup?: UIMockup;
  previewImage?: string;
  changes?: DesignChange[];
  error?: string;
}

/**
 * Design change description
 */
export interface DesignChange {
  componentId: string;
  changeType: 'added' | 'removed' | 'modified';
  before?: Frame0Component;
  after?: Frame0Component;
}

// ============================================================================
// Generation Strategy Types
// ============================================================================

/**
 * Design generation strategy
 */
export interface GenerationStrategy {
  layoutStrategy: LayoutStrategy;
  componentSpacing: number;
  frameWidth: number;
  frameHeight: number;
  startPosition: { x: number; y: number };
  groupByPage?: boolean;
}

/**
 * Component layout context (tracks position during generation)
 */
export interface LayoutContext {
  currentX: number;
  currentY: number;
  maxWidth: number;
  rowHeight: number;
  components: Frame0Component[];
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Design validation result
 */
export interface DesignValidationResult {
  valid: boolean;
  errors: DesignValidationError[];
  warnings: DesignValidationWarning[];
  metrics: DesignMetrics;
}

/**
 * Design validation error
 */
export interface DesignValidationError {
  type: 'missing_component' | 'overlapping_components' | 'invalid_position' | 'size_constraint_violation';
  message: string;
  componentId?: string;
  acceptanceCriteriaId?: string;
}

/**
 * Design validation warning
 */
export interface DesignValidationWarning {
  type: 'poor_spacing' | 'inconsistent_sizing' | 'missing_labels' | 'accessibility_issue';
  message: string;
  componentId?: string;
}

/**
 * Design quality metrics
 */
export interface DesignMetrics {
  totalComponents: number;
  averageSpacing: number;
  componentDensity: number;
  coveragePercentage: number; // % of ACs represented
  consistencyScore: number; // 0-100
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default style configuration
 */
export const DEFAULT_STYLE_CONFIG: StyleConfig = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    background: '#FFFFFF',
    text: '#1F2937',
    border: '#E5E7EB',
  },
  typography: {
    fontFamily: 'Inter, sans-serif',
    heading: { fontSize: 24, fontWeight: 'bold' },
    body: { fontSize: 16, fontWeight: 'normal' },
    small: { fontSize: 14, fontWeight: 'normal' },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};

/**
 * Default generation strategy
 */
export const DEFAULT_GENERATION_STRATEGY: GenerationStrategy = {
  layoutStrategy: 'vertical',
  componentSpacing: 16,
  frameWidth: 375,
  frameHeight: 812,
  startPosition: { x: 20, y: 60 },
  groupByPage: false,
};

/**
 * Component type to Frame0 mapping (partial - extend as needed)
 */
export const COMPONENT_TO_FRAME0_MAPPING: Partial<Record<ComponentType, ComponentMappingSpec>> = {
  SearchBar: {
    componentType: 'SearchBar',
    frame0Components: [
      {
        type: 'rectangle',
        props: { cornerRadius: 8, fillColor: '#F3F4F6', strokeColor: '#D1D5DB' },
        size: { width: 'full', height: 44 },
      },
      {
        type: 'text',
        props: { text: 'Search...', fontSize: 16, fontColor: '#9CA3AF' },
        relativePosition: { x: 12, y: 12 },
        size: { width: 'auto', height: 'auto' },
      },
    ],
    spacing: { x: 16, y: 8 },
  },
  Button: {
    componentType: 'Button',
    frame0Components: [
      {
        type: 'rectangle',
        props: { cornerRadius: 6, fillColor: '#3B82F6', strokeColor: 'transparent' },
        size: { width: 'auto', height: 44 },
      },
      {
        type: 'text',
        props: { fontSize: 16, fontColor: '#FFFFFF', fontWeight: 'semibold' },
        relativePosition: { x: 16, y: 12 },
        size: { width: 'auto', height: 'auto' },
      },
    ],
    spacing: { x: 16, y: 8 },
  },
  List: {
    componentType: 'List',
    frame0Components: [
      {
        type: 'rectangle',
        props: { cornerRadius: 8, fillColor: '#FFFFFF', strokeColor: '#E5E7EB' },
        size: { width: 'full', height: 72 },
      },
      {
        type: 'text',
        props: { fontSize: 16, fontColor: '#1F2937', fontWeight: 'medium' },
        relativePosition: { x: 16, y: 16 },
        size: { width: 'auto', height: 'auto' },
      },
      {
        type: 'text',
        props: { fontSize: 14, fontColor: '#6B7280' },
        relativePosition: { x: 16, y: 40 },
        size: { width: 'auto', height: 'auto' },
      },
    ],
    spacing: { x: 16, y: 8 },
  },
  // Add more mappings as needed
} as const;
