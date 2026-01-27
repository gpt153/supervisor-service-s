/**
 * Type definitions for Figma Design Import Integration (Epic UI-004)
 *
 * This module defines types for importing Figma designs as UI mockups,
 * extracting design context and tokens, and mapping components.
 */

import { Timestamps } from './database.js';

// ============================================================================
// Database Types
// ============================================================================

/**
 * UI Mockup database record with Figma data
 *
 * Stores imported Figma designs and their metadata
 */
export interface UIMockup extends Timestamps {
  id: number;
  epic_id: string;
  project_name: string;
  design_method: 'frame0' | 'figma';
  design_url: string | null;
  design_data: any | null;
  dev_port: number | null;
  dev_url: string | null;
  status: 'draft' | 'approved' | 'connected' | 'archived';

  // Frame0 fields
  frame0_page_id: string | null;
  frame0_design_export: string | null;
  component_mapping: any | null;

  // Figma fields
  figma_url: string | null;
  figma_file_key: string | null;
  figma_node_id: string | null;
  figma_design_context: FigmaDesignContext | null;
  figma_design_tokens: FigmaDesignTokens | null;
  figma_screenshot_data: string | null;
}

// ============================================================================
// Figma URL Parsing Types
// ============================================================================

/**
 * Parsed Figma URL components
 */
export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId: string;
  branchKey?: string;
  originalUrl: string;
}

/**
 * Figma URL validation result
 */
export interface FigmaUrlValidation {
  valid: boolean;
  error?: string;
  parsed?: ParsedFigmaUrl;
}

// ============================================================================
// Figma Design Context Types
// ============================================================================

/**
 * Design context from Figma MCP get_design_context
 */
export interface FigmaDesignContext {
  code?: string;
  metadata?: FigmaMetadata;
  assets?: Record<string, string>;
  codeConnect?: FigmaCodeConnect[];
  componentHierarchy?: FigmaComponentNode[];
}

/**
 * Figma metadata from design context
 */
export interface FigmaMetadata {
  fileName?: string;
  nodeName?: string;
  nodeType?: string;
  width?: number;
  height?: number;
  lastModified?: string;
}

/**
 * Figma Code Connect mapping
 */
export interface FigmaCodeConnect {
  nodeId: string;
  codeConnectSrc?: string;
  codeConnectName?: string;
}

/**
 * Figma component node in hierarchy
 */
export interface FigmaComponentNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaComponentNode[];
  visible?: boolean;
  locked?: boolean;
}

// ============================================================================
// Figma Design Tokens Types
// ============================================================================

/**
 * Design tokens extracted from Figma variables
 */
export interface FigmaDesignTokens {
  colors?: Record<string, string>;
  typography?: Record<string, TypographyToken>;
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
  effects?: Record<string, any>;
  raw?: Record<string, any>;
}

/**
 * Typography token definition
 */
export interface TypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
}

// ============================================================================
// Figma Screenshot Types
// ============================================================================

/**
 * Screenshot from Figma MCP get_screenshot
 */
export interface FigmaScreenshot {
  data: string;
  format: 'png' | 'jpeg';
  width?: number;
  height?: number;
}

// ============================================================================
// Component Mapping Types
// ============================================================================

/**
 * Mapping between Figma components and acceptance criteria
 */
export interface FigmaComponentMapping {
  figmaNodeId: string;
  figmaNodeName: string;
  acceptanceCriteriaId: string;
  componentType: string;
  confidence: number;
  matchReason: string;
}

/**
 * Component mapping result
 */
export interface ComponentMappingResult {
  mappings: FigmaComponentMapping[];
  unmappedFigmaNodes: string[];
  unmappedAcceptanceCriteria: string[];
  coverage: number;
}

// ============================================================================
// Import Types
// ============================================================================

/**
 * Parameters for importing Figma design
 */
export interface ImportFigmaDesignParams {
  epicId: string;
  figmaUrl: string;
  projectName?: string;
}

/**
 * Result of Figma design import
 */
export interface ImportFigmaDesignResult {
  success: boolean;
  mockup?: UIMockup;
  error?: string;
  warnings?: string[];
}

/**
 * Import progress callback
 */
export type ImportProgressCallback = (step: string, progress: number) => void;

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for ui_generate_design MCP tool (Figma method)
 */
export interface GenerateDesignFigmaParams {
  epicId: string;
  method: 'figma';
  figmaUrl: string;
  projectName?: string;
}

/**
 * Result of ui_generate_design MCP tool (Figma method)
 */
export interface GenerateDesignFigmaResult {
  success: boolean;
  mockup?: UIMockup;
  screenshot?: string;
  designContext?: FigmaDesignContext;
  designTokens?: FigmaDesignTokens;
  componentMapping?: ComponentMappingResult;
  error?: string;
  warnings?: string[];
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Design completeness validation result
 */
export interface DesignCompletenessValidation {
  complete: boolean;
  coverage: number;
  missingComponents: string[];
  warnings: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Figma URL patterns
 */
export const FIGMA_URL_PATTERNS = {
  DESIGN: /^https:\/\/(?:www\.)?figma\.com\/design\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/,
  FILE: /^https:\/\/(?:www\.)?figma\.com\/file\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/,
  BRANCH: /^https:\/\/(?:www\.)?figma\.com\/design\/([^/]+)\/branch\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/,
} as const;

/**
 * Figma component type mapping to generic component types
 */
export const FIGMA_COMPONENT_TYPE_MAP: Record<string, string> = {
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
} as const;
