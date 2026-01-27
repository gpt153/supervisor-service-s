/**
 * Type definitions for Requirements Analysis Engine (Epic UI-001)
 *
 * This module defines types for parsing epic markdown files to extract
 * UI requirements, acceptance criteria, user stories, and data needs.
 */

import { Timestamps } from './database.js';

// ============================================================================
// Database Types
// ============================================================================

/**
 * UI Requirements database record
 *
 * Stores structured UI requirements extracted from epic acceptance criteria
 */
export interface UIRequirement extends Timestamps {
  id: number;
  epic_id: string;
  project_name: string;
  acceptance_criteria: AcceptanceCriteriaSpec[];
  user_stories: UserStory[];
  data_requirements: DataRequirements;
  navigation_needs: NavigationNeeds;
  design_constraints: DesignConstraints | null;
}

// ============================================================================
// Acceptance Criteria Types
// ============================================================================

/**
 * Structured acceptance criteria with UI elements and user flows
 */
export interface AcceptanceCriteriaSpec {
  id: string;
  text: string;
  ui_elements: UIElement[];
  user_flow: UserFlowStep[];
}

/**
 * UI element identified from acceptance criteria
 */
export interface UIElement {
  component: ComponentType;
  props?: Record<string, any>;
  variants?: string[];
  location?: string;
  permissions?: string[];
  confirmation?: boolean;
}

/**
 * Common component types detected from acceptance criteria
 */
export type ComponentType =
  | 'SearchBar'
  | 'Button'
  | 'Form'
  | 'Input'
  | 'Select'
  | 'Checkbox'
  | 'Radio'
  | 'List'
  | 'Table'
  | 'Card'
  | 'Badge'
  | 'Dialog'
  | 'Modal'
  | 'Dropdown'
  | 'Tabs'
  | 'Navigation'
  | 'Menu'
  | 'Toast'
  | 'Alert';

/**
 * Step in a user flow
 */
export interface UserFlowStep {
  step: number;
  action: string;
  condition?: string;
  error_handling?: string;
}

// ============================================================================
// User Story Types
// ============================================================================

/**
 * User story extracted from epic
 */
export interface UserStory {
  role: string;
  goal: string;
  benefit: string;
  acceptance_criteria_ids?: string[];
}

// ============================================================================
// Data Requirements Types
// ============================================================================

/**
 * Data requirements for the UI
 */
export interface DataRequirements {
  entities: EntityRequirement[];
  operations: DataOperation[];
}

/**
 * Entity (data model) requirement
 */
export interface EntityRequirement {
  name: string;
  fields: EntityField[];
  relationships?: EntityRelationship[];
}

/**
 * Field definition for an entity
 */
export interface EntityField {
  name: string;
  type: FieldType;
  required: boolean;
  displayLabel?: string;
  validations?: FieldValidation[];
}

/**
 * Field data type
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'enum'
  | 'array'
  | 'object'
  | 'json';

/**
 * Field validation rule
 */
export interface FieldValidation {
  type: ValidationType;
  value?: any;
  message?: string;
}

/**
 * Validation type
 */
export type ValidationType =
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'url'
  | 'unique';

/**
 * Entity relationship
 */
export interface EntityRelationship {
  type: RelationType;
  targetEntity: string;
  foreignKey?: string;
}

/**
 * Relationship type
 */
export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many';

/**
 * Data operation required by UI
 */
export interface DataOperation {
  type: OperationType;
  entity: string;
  fields?: string[];
  filters?: Record<string, any>;
  sorts?: SortDefinition[];
  pagination?: boolean;
}

/**
 * Data operation type
 */
export type OperationType =
  | 'list'
  | 'get'
  | 'create'
  | 'update'
  | 'delete'
  | 'search'
  | 'filter'
  | 'sort';

/**
 * Sort definition
 */
export interface SortDefinition {
  field: string;
  direction: 'asc' | 'desc';
}

// ============================================================================
// Navigation Types
// ============================================================================

/**
 * Navigation requirements for the UI
 */
export interface NavigationNeeds {
  pages: PageDefinition[];
  transitions: PageTransition[];
}

/**
 * Page definition
 */
export interface PageDefinition {
  name: string;
  path: string;
  title: string;
  description?: string;
  access?: AccessControl;
}

/**
 * Access control for pages
 */
export interface AccessControl {
  permissions?: string[];
  roles?: string[];
  authenticated?: boolean;
}

/**
 * Navigation transition between pages
 */
export interface PageTransition {
  from: string;
  to: string;
  trigger: string;
  conditions?: string[];
}

// ============================================================================
// Design Constraints Types
// ============================================================================

/**
 * Design constraints extracted from epic
 */
export interface DesignConstraints {
  accessibility?: AccessibilityRequirements;
  responsive?: ResponsiveRequirements;
  branding?: BrandingRequirements;
  performance?: PerformanceRequirements;
}

/**
 * Accessibility requirements
 */
export interface AccessibilityRequirements {
  wcagLevel?: 'A' | 'AA' | 'AAA';
  keyboardNavigation: boolean;
  screenReaderSupport: boolean;
  colorContrastRatio?: number;
  focusIndicators: boolean;
}

/**
 * Responsive design requirements
 */
export interface ResponsiveRequirements {
  breakpoints: string[];
  mobileFirst: boolean;
  touchOptimized?: boolean;
}

/**
 * Branding requirements
 */
export interface BrandingRequirements {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

/**
 * Performance requirements
 */
export interface PerformanceRequirements {
  maxLoadTime?: number;
  maxInteractionTime?: number;
  lazyLoading?: boolean;
}

// ============================================================================
// Parser Types
// ============================================================================

/**
 * Raw parsed epic data
 */
export interface ParsedEpic {
  epicId: string;
  projectName: string;
  title: string;
  status: EpicStatus;
  description?: string;
  acceptanceCriteria: ParsedAcceptanceCriterion[];
  userStories: ParsedUserStory[];
  technicalNotes?: string;
  dependencies?: EpicDependency[];
}

/**
 * Epic status
 */
export type EpicStatus = 'Planned' | 'In Progress' | 'Completed' | 'Blocked';

/**
 * Parsed acceptance criterion (before analysis)
 */
export interface ParsedAcceptanceCriterion {
  id: string;
  text: string;
  rawText: string;
}

/**
 * Parsed user story (before analysis)
 */
export interface ParsedUserStory {
  role: string;
  goal: string;
  benefit: string;
  rawText: string;
}

/**
 * Epic dependency
 */
export interface EpicDependency {
  type: 'blocks' | 'blocked_by' | 'related';
  epicId: string;
  description?: string;
}

// ============================================================================
// Analysis Types
// ============================================================================

/**
 * Analysis result from requirements analyzer
 */
export interface RequirementsAnalysis {
  uiElements: UIElementMatch[];
  userFlows: UserFlowDetection[];
  dataNeeds: DataNeedDetection[];
  navigationNeeds: NavigationDetection[];
  designConstraints: DesignConstraintDetection[];
}

/**
 * UI element match from pattern detection
 */
export interface UIElementMatch {
  acceptanceCriterionId: string;
  component: ComponentType;
  confidence: number;
  matchedPattern: string;
  extractedProps?: Record<string, any>;
  location?: string;
}

/**
 * User flow detection result
 */
export interface UserFlowDetection {
  acceptanceCriterionId: string;
  steps: UserFlowStep[];
  confidence: number;
  matchedPattern: string;
}

/**
 * Data need detection result
 */
export interface DataNeedDetection {
  entity: string;
  operation: OperationType;
  fields: string[];
  confidence: number;
  matchedPattern: string;
}

/**
 * Navigation detection result
 */
export interface NavigationDetection {
  fromPage: string;
  toPage: string;
  trigger: string;
  confidence: number;
  matchedPattern: string;
}

/**
 * Design constraint detection result
 */
export interface DesignConstraintDetection {
  type: 'accessibility' | 'responsive' | 'branding' | 'performance';
  constraint: string;
  confidence: number;
  matchedPattern: string;
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for ui_analyze_epic MCP tool
 */
export interface AnalyzeEpicParams {
  epicId: string;
  projectName?: string;
  reanalyze?: boolean;
}

/**
 * Result of ui_analyze_epic MCP tool
 */
export interface AnalyzeEpicResult {
  success: boolean;
  uiRequirement?: UIRequirement;
  error?: string;
  warnings?: string[];
}

/**
 * Parameters for getting UI requirements
 */
export interface GetUIRequirementsParams {
  epicId: string;
}

/**
 * Parameters for updating UI requirements
 */
export interface UpdateUIRequirementsParams {
  epicId: string;
  acceptanceCriteria?: AcceptanceCriteriaSpec[];
  userStories?: UserStory[];
  dataRequirements?: DataRequirements;
  navigationNeeds?: NavigationNeeds;
  designConstraints?: DesignConstraints;
}

// ============================================================================
// Pattern Matching Types
// ============================================================================

/**
 * Pattern definition for AC analysis
 */
export interface AnalysisPattern {
  name: string;
  pattern: RegExp;
  componentType: ComponentType;
  extractProps?: (match: RegExpMatchArray) => Record<string, any>;
  confidence?: number;
}

/**
 * Pattern match result
 */
export interface PatternMatch {
  pattern: AnalysisPattern;
  match: RegExpMatchArray;
  confidence: number;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Epic validation result
 */
export interface EpicValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  type: 'missing_section' | 'invalid_format' | 'missing_required_field';
  message: string;
  location?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  type: 'incomplete_ac' | 'vague_requirement' | 'missing_user_flow';
  message: string;
  location?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Common AC patterns for UI element detection
 */
export const AC_PATTERNS = {
  SEARCH: /search|filter|find/i,
  FORM: /form|input|enter|submit/i,
  LIST: /list|display.*items|show.*results/i,
  TABLE: /table|grid|column/i,
  BUTTON: /button|click|action/i,
  NAVIGATION: /navigate|go to|redirect/i,
  DIALOG: /dialog|modal|popup|confirm/i,
  BADGE: /badge|label|tag|status/i,
} as const;

/**
 * Data operation keywords
 */
export const DATA_OPERATION_KEYWORDS = {
  CREATE: ['create', 'add', 'new', 'register'],
  READ: ['view', 'display', 'show', 'list', 'get'],
  UPDATE: ['edit', 'update', 'modify', 'change'],
  DELETE: ['delete', 'remove', 'ban', 'deactivate'],
  SEARCH: ['search', 'filter', 'find', 'query'],
} as const;
