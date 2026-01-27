/**
 * UI Testing Type Definitions (Level 5 Verification)
 * Complete schema for browser automation, visual verification, and rendered state validation
 */

// ============================================================================
// Viewport Configuration
// ============================================================================

export interface ViewportConfig {
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

export interface BrowserConfig {
  headless?: boolean;
  browserType: 'chromium' | 'firefox' | 'webkit';
  viewport?: ViewportConfig;
  timeout?: number; // milliseconds
  recordVideo?: boolean;
  recordHar?: boolean;
}

// ============================================================================
// User Actions (Deterministic Playwright operations)
// ============================================================================

export type UIActionType =
  | 'click'
  | 'type'
  | 'scroll'
  | 'hover'
  | 'drag'
  | 'keyboard'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'press';

export interface UIAction {
  id?: string;
  type: UIActionType;
  selector: string; // CSS selector or XPath
  value?: string; // For type, fill, select actions
  targetSelector?: string; // For drag (destination)
  key?: string; // For keyboard/press actions
  delay?: number; // Milliseconds between key presses
  waitFor?: WaitCondition; // Wait before action
  waitAfter?: WaitCondition; // Wait after action
  timeout?: number; // Action timeout in milliseconds
  screenshotBefore?: boolean; // Capture screenshot before action
  screenshotAfter?: boolean; // Capture screenshot after action
  description?: string; // Human-readable description
}

export interface WaitCondition {
  type: 'element' | 'url' | 'function' | 'networkidle' | 'load';
  selector?: string; // For element wait
  urlPattern?: string; // For URL wait
  timeout?: number; // milliseconds
}

// ============================================================================
// Expectations & Verification
// ============================================================================

export type ExpectationType =
  | 'element_visible'
  | 'element_hidden'
  | 'element_enabled'
  | 'element_disabled'
  | 'text_present'
  | 'text_absent'
  | 'css_property'
  | 'attribute_value'
  | 'url_contains'
  | 'console_no_errors'
  | 'network_success'
  | 'element_count'
  | 'visual_diff'
  | 'accessibility_valid';

export interface UIExpectation {
  id?: string;
  type: ExpectationType;
  selector?: string; // CSS selector for element-based expectations
  property?: string; // CSS property name or attribute name
  expectedValue?: any; // Expected value for verification
  operator?: 'equals' | 'contains' | 'matches' | 'greater' | 'less';
  tolerance?: number; // Percentage tolerance for visual diffs
  description?: string;
  critical?: boolean; // If true, test fails if expectation fails

  // Filled during execution
  actualValue?: any;
  passed?: boolean;
  evidence?: ExpectationEvidence;
}

export interface ExpectationEvidence {
  screenshot?: string; // Path to screenshot when expectation checked
  domSnapshot?: string; // DOM at time of check
  consoleOutput?: string; // Console logs at time of check
  timestamp: Date;
  message: string; // Detailed result message
}

// ============================================================================
// UI Test Definition & Results
// ============================================================================

export interface UITestDefinition {
  id: string;
  name: string;
  description: string;
  url: string;
  viewport: ViewportConfig;
  browser?: BrowserConfig;

  // Test execution
  actions: UIAction[];
  expectations: UIExpectation[];

  // Test metadata
  tags?: string[];
  priority?: 'high' | 'medium' | 'low';
  timeout?: number; // Total test timeout
  retries?: number; // Number of retries on failure
}

export interface UITestResult {
  testId: string;
  testName: string;
  passed: boolean;
  partialPass?: boolean; // Some expectations failed but non-critical
  durationMs: number;
  startedAt: Date;
  completedAt: Date;

  // Execution details
  actionsExecuted: number;
  expectationResults: ExpectationResult[];
  failures?: TestFailure[];

  // Evidence collection
  evidence: UITestEvidence;

  // Error handling
  errorMessage?: string;
  stackTrace?: string;
}

export interface ExpectationResult {
  expectationId?: string;
  type: ExpectationType;
  description?: string;
  passed: boolean;
  actualValue?: any;
  expectedValue?: any;
  evidence?: ExpectationEvidence;
}

export interface TestFailure {
  actionId?: string;
  expectationId?: string;
  type: 'action_failed' | 'expectation_failed';
  message: string;
  evidence?: string; // Path to screenshot/evidence
}

// ============================================================================
// Visual Evidence (Level 5 - CRITICAL)
// ============================================================================

export interface ScreenshotMetadata {
  timestamp: Date;
  url: string;
  viewport: ViewportConfig;
  phase: 'baseline' | 'before_action' | 'after_action' | 'final';
  actionId?: string;
  selector?: string; // For element-specific screenshots
}

export interface UITestEvidence {
  testId: string;
  testName: string;
  epicId?: string;

  // Visual evidence (Level 5)
  screenshotBaseline?: string; // Full page after navigation
  screenshotsFinal?: string; // Full page after all actions
  elementScreenshots?: {
    [key: string]: {
      before?: string;
      after?: string;
    };
  };
  visualDiffs?: {
    [key: string]: string; // Path to diff image
  };

  // Rendered state evidence
  domSnapshots?: {
    baseline?: string;
    final?: string;
  };
  cssProperties?: {
    [selector: string]: Record<string, string>;
  };
  elementLayout?: {
    [selector: string]: ElementBoundingBox;
  };

  // Console & Network
  consoleLogs: ConsoleLog[];
  networkActivity: NetworkActivity[];
  performanceMetrics?: PerformanceMetrics;

  // Accessibility
  accessibilityIssues?: AccessibilityIssue[];

  // User-facing summary
  expectedOutcome: string;
  actualOutcome: string;
  passFail: 'pass' | 'fail';
}

export interface ElementBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  interactive: boolean;
}

export interface ConsoleLog {
  level: 'log' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  args?: any[];
  stackTrace?: string;
  timestamp: Date;
}

export interface NetworkActivity {
  method: string; // GET, POST, PUT, DELETE
  url: string;
  statusCode: number;
  statusText: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  responseTime?: number; // milliseconds
  requestBody?: any;
  responseBody?: any;
  resourceType?: string; // xhr, fetch, document, image, stylesheet, etc.
  timestamp: Date;
  failed?: boolean; // 4xx or 5xx
}

export interface PerformanceMetrics {
  firstContentfulPaint?: number; // milliseconds
  largestContentfulPaint?: number; // milliseconds
  timeToInteractive?: number; // milliseconds
  navigationStart: number;
  domContentLoaded?: number;
  pageLoad?: number;
}

export interface AccessibilityIssue {
  rule: string; // axe rule ID
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  message: string;
  selector: string;
  help?: string;
  helpUrl?: string;
}

// ============================================================================
// State Verification Results
// ============================================================================

export interface VisibilityState {
  visible: boolean;
  display: string;
  visibility: string;
  opacity: number;
  hidden: boolean;
}

export interface InteractivityState {
  clickable: boolean;
  disabled: boolean;
  covered: boolean;
  inViewport: boolean;
}

export interface ElementState {
  exists: boolean;
  visibility: VisibilityState;
  interactivity: InteractivityState;
  text?: string;
  html?: string;
  cssProperties?: Record<string, string>;
  attributes?: Record<string, string>;
  ariaLabels?: Record<string, string>;
}

// ============================================================================
// Rendering State Snapshot
// ============================================================================

export interface RenderedState {
  url: string;
  timestamp: Date;
  viewport: ViewportConfig;
  documentReady: boolean;
  elements: {
    [selector: string]: ElementState;
  };
  errorCount: number;
  warningCount: number;
}

// ============================================================================
// Visual Diff Configuration
// ============================================================================

export interface VisualDiffConfig {
  threshold?: number; // Pixel threshold for considering pixels different (0-255)
  includeAA?: boolean; // Include anti-aliased pixels in diff
  alpha?: number; // Alpha channel weight (0-1)
  aaColor?: [number, number, number]; // Color for anti-aliased pixels
  diffColor?: [number, number, number]; // Color for different pixels (default red)
}

export interface VisualDiffResult {
  identical: boolean;
  percentDifferent: number; // Percentage of pixels different
  diffPath?: string; // Path to diff image
  pixelsChanged: number;
}

// ============================================================================
// Test Batch Execution
// ============================================================================

export interface UITestBatch {
  id: string;
  name: string;
  description?: string;
  tests: UITestDefinition[];
  parallel?: boolean; // Run tests in parallel
  stopOnFailure?: boolean; // Stop batch on first failure
  tags?: string[];
}

export interface UITestBatchResult {
  batchId: string;
  batchName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  durationMs: number;
  startedAt: Date;
  completedAt: Date;
  testResults: UITestResult[];
  summary: string;
  failureReport?: FailureReport;
}

export interface FailureReport {
  totalFailures: number;
  failedTests: {
    testId: string;
    testName: string;
    failures: TestFailure[];
  }[];
  commonPatterns?: string[];
  recommendations?: string[];
}

// ============================================================================
// Configuration & Defaults
// ============================================================================

export const DEFAULT_VIEWPORT: ViewportConfig = {
  width: 1920,
  height: 1080,
};

export const DEFAULT_BROWSER_CONFIG: BrowserConfig = {
  headless: true,
  browserType: 'chromium',
  viewport: DEFAULT_VIEWPORT,
  timeout: 30000,
};

export const DEFAULT_ACTION_TIMEOUT = 10000; // milliseconds
export const DEFAULT_TEST_TIMEOUT = 120000; // milliseconds

export const VISUAL_DIFF_DEFAULT_CONFIG: VisualDiffConfig = {
  threshold: 0,
  includeAA: true,
  alpha: 0.1,
  aaColor: [175, 175, 175],
  diffColor: [255, 0, 0], // red for differences
};
