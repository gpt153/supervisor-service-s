/**
 * Design System type definitions for UI-First Development Workflow
 * Epic: UI-002 - Design System Foundation
 */

import { Timestamps } from './database.js';

// ============================================================================
// Design System Core Types
// ============================================================================

/**
 * Design system database record
 */
export interface DesignSystem extends Timestamps {
  id: number;
  project_name: string;
  name: string;
  description: string | null;
  style_config: StyleConfig;
  component_library: ComponentLibrary;
  storybook_port: number | null;
  storybook_url: string | null;
}

/**
 * Style configuration for design tokens
 */
export interface StyleConfig {
  colors: ColorTokens;
  typography: TypographyTokens;
  spacing: SpacingTokens;
  breakpoints?: BreakpointTokens;
  shadows?: ShadowTokens;
  borderRadius?: BorderRadiusTokens;
}

/**
 * Color design tokens
 */
export interface ColorTokens {
  primary: string;
  secondary: string;
  accent?: string;
  background: string;
  surface: string;
  text: TextColorTokens;
  status?: StatusColorTokens;
  [key: string]: string | TextColorTokens | StatusColorTokens | undefined;
}

/**
 * Text color tokens
 */
export interface TextColorTokens {
  primary: string;
  secondary: string;
  disabled?: string;
  inverse?: string;
}

/**
 * Status color tokens
 */
export interface StatusColorTokens {
  success: string;
  warning: string;
  error: string;
  info: string;
}

/**
 * Typography design tokens
 */
export interface TypographyTokens {
  fontFamily: FontFamilyTokens;
  fontSize: FontSizeTokens;
  fontWeight: FontWeightTokens;
  lineHeight: LineHeightTokens;
  letterSpacing?: LetterSpacingTokens;
}

/**
 * Font family tokens
 */
export interface FontFamilyTokens {
  body: string;
  heading: string;
  monospace?: string;
}

/**
 * Font size tokens
 */
export interface FontSizeTokens {
  xs: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  [key: string]: string;
}

/**
 * Font weight tokens
 */
export interface FontWeightTokens {
  normal: number;
  medium: number;
  semibold: number;
  bold: number;
}

/**
 * Line height tokens
 */
export interface LineHeightTokens {
  tight: string;
  normal: string;
  relaxed: string;
  loose: string;
}

/**
 * Letter spacing tokens
 */
export interface LetterSpacingTokens {
  tight: string;
  normal: string;
  wide: string;
}

/**
 * Spacing design tokens
 */
export interface SpacingTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  [key: string]: string;
}

/**
 * Breakpoint tokens for responsive design
 */
export interface BreakpointTokens {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
}

/**
 * Shadow tokens
 */
export interface ShadowTokens {
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

/**
 * Border radius tokens
 */
export interface BorderRadiusTokens {
  none: string;
  sm: string;
  md: string;
  lg: string;
  full: string;
}

/**
 * Component library definition
 */
export interface ComponentLibrary {
  components: ComponentDefinition[];
  version?: string;
}

/**
 * Individual component definition
 */
export interface ComponentDefinition {
  name: string;
  category: ComponentCategory;
  description?: string;
  variants?: ComponentVariant[];
  props?: ComponentProp[];
  figmaNodeId?: string;
  storybookPath?: string;
}

/**
 * Component category
 */
export type ComponentCategory =
  | 'button'
  | 'input'
  | 'form'
  | 'layout'
  | 'navigation'
  | 'feedback'
  | 'data-display'
  | 'overlay'
  | 'typography';

/**
 * Component variant
 */
export interface ComponentVariant {
  name: string;
  description?: string;
  props?: Record<string, any>;
}

/**
 * Component prop definition
 */
export interface ComponentProp {
  name: string;
  type: PropType;
  required: boolean;
  defaultValue?: any;
  description?: string;
}

/**
 * Component prop type
 */
export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'function'
  | 'node'
  | 'enum';

// ============================================================================
// Storybook Configuration Types
// ============================================================================

/**
 * Storybook deployment configuration
 */
export interface StorybookConfig {
  projectName: string;
  port: number;
  publicUrl: string;
  buildDirectory: string;
  staticDirectory?: string;
}

/**
 * Storybook deployment status
 */
export interface StorybookDeployment {
  id: number;
  design_system_id: number;
  port: number;
  url: string;
  status: StorybookStatus;
  build_directory: string;
  process_id: number | null;
  last_deployed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Storybook deployment status
 */
export type StorybookStatus = 'pending' | 'building' | 'running' | 'stopped' | 'failed';

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for creating a design system
 */
export interface CreateDesignSystemParams {
  projectName: string;
  name: string;
  description?: string;
  styleConfig: StyleConfig;
  componentLibrary?: ComponentLibrary;
}

/**
 * Parameters for updating a design system
 */
export interface UpdateDesignSystemParams {
  id: number;
  name?: string;
  description?: string;
  styleConfig?: StyleConfig;
  componentLibrary?: ComponentLibrary;
}

/**
 * Parameters for deploying Storybook
 */
export interface DeployStorybookParams {
  designSystemId: number;
  port?: number;
  publicUrl?: string;
}

/**
 * Parameters for getting a design system
 */
export interface GetDesignSystemParams {
  projectName: string;
  name?: string;
}

/**
 * Parameters for deleting a design system
 */
export interface DeleteDesignSystemParams {
  id: number;
}

// ============================================================================
// Design Token Import/Export Types
// ============================================================================

/**
 * Figma variable import configuration
 */
export interface FigmaVariableImportConfig {
  fileKey: string;
  nodeId?: string;
  variableCollectionName?: string;
}

/**
 * Design token export format
 */
export type TokenExportFormat = 'css' | 'scss' | 'tailwind' | 'json';

/**
 * Design token export configuration
 */
export interface TokenExportConfig {
  format: TokenExportFormat;
  outputPath: string;
  includeComments?: boolean;
  prefix?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Result of creating a design system
 */
export interface CreateDesignSystemResult {
  success: boolean;
  designSystem?: DesignSystem;
  error?: string;
}

/**
 * Result of deploying Storybook
 */
export interface DeployStorybookResult {
  success: boolean;
  deployment?: StorybookDeployment;
  url?: string;
  error?: string;
}

/**
 * Result of importing Figma variables
 */
export interface ImportFigmaVariablesResult {
  success: boolean;
  tokensImported?: number;
  styleConfig?: StyleConfig;
  error?: string;
}

/**
 * Result of exporting design tokens
 */
export interface ExportTokensResult {
  success: boolean;
  outputPath?: string;
  format?: TokenExportFormat;
  error?: string;
}
