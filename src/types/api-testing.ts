/**
 * API & Tool Test Execution type definitions (Level 6 Verification)
 * Supports HTTP API testing, MCP tool execution, and error scenario verification
 *
 * Level 6 Verification: Existence → Execution → Structure → Values → Side Effects → Negative Cases
 */

// ============================================================================
// HTTP Request/Response Types
// ============================================================================

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type AuthType = 'bearer' | 'api_key' | 'basic' | 'none';
export type StatusCodeRange = '2xx' | '3xx' | '4xx' | '5xx' | number;

export interface HTTPRequest {
  method: HTTPMethod;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  auth?: {
    type: AuthType;
    value: string;
    headerName?: string; // For custom auth headers
  };
  timeout?: number; // milliseconds
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export interface HTTPResponse {
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  body: any;
  rawBody?: string;
  timing: {
    dns?: number; // milliseconds
    connect?: number;
    tls?: number;
    wait?: number;
    receive?: number;
    total: number;
  };
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

export interface HTTPRequestLog {
  timestamp: Date;
  method: HTTPMethod;
  url: string;
  headers: Record<string, string>;
  body?: any;
  auth?: {
    type: AuthType;
    hasValue: boolean; // Never log actual token
  };
}

// ============================================================================
// MCP Tool Types
// ============================================================================

export interface MCPToolCall {
  server: string; // MCP server name (e.g., 'figma', 'github', 'slack')
  tool: string; // Tool name (e.g., 'get_screenshot', 'create_issue')
  params: Record<string, any>;
}

export interface MCPToolResponse {
  tool: string;
  params: Record<string, any>;
  result?: any;
  error?: {
    message: string;
    code?: string;
  };
  timing: number; // milliseconds
  metadata: {
    server: string;
    timestamp: string;
    executionTime: number;
  };
}

export interface MCPToolLog {
  timestamp: Date;
  server: string;
  tool: string;
  params: Record<string, any>;
  result?: any;
  error?: {
    message: string;
    code?: string;
  };
  executionTime: number;
}

// ============================================================================
// JSON Schema & Response Validation (Level 6 - Structure Verification)
// ============================================================================

export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: any[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  default?: any;
  example?: any;
  description?: string;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors?: {
    path: string;
    message: string;
    expected?: any;
    actual?: any;
  }[];
}

export interface ValidationRule {
  type:
    | 'status_code'
    | 'schema'
    | 'header'
    | 'body_field'
    | 'body_contains'
    | 'response_time';
  passed: boolean;
  expected?: any;
  actual?: any;
  message?: string;
  details?: Record<string, any>;
}

// ============================================================================
// Side Effect Verification (Level 6 - Behavioral Verification)
// ============================================================================

export type SideEffectType =
  | 'resource_created'
  | 'resource_modified'
  | 'resource_deleted'
  | 'database_change'
  | 'external_call_made'
  | 'message_sent'
  | 'cache_updated';

export interface SideEffectVerification {
  type: SideEffectType;
  description: string;
  verificationMethod: 'http_get' | 'mcp_tool_call' | 'database_query' | 'file_check';
  verificationParams: Record<string, any>;
  expectedResult?: any;
  beforeSnapshot?: any;
  afterSnapshot?: any;
}

export interface SideEffectVerificationResult {
  type: SideEffectType;
  description: string;
  passed: boolean;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  changeDetected?: boolean;
  details?: string;
  evidence?: any;
}

// ============================================================================
// Error Scenario Testing (Level 6 - Negative Case Verification)
// ============================================================================

export type ErrorScenarioType =
  | 'invalid_input'
  | 'missing_required_field'
  | 'wrong_data_type'
  | 'authentication_failure'
  | 'authorization_failure'
  | 'resource_not_found'
  | 'rate_limit'
  | 'server_error'
  | 'network_timeout'
  | 'connection_refused'
  | 'dns_failure'
  | 'invalid_json'
  | 'invalid_content_type';

export interface ErrorScenario {
  type: ErrorScenarioType;
  description: string;
  modification: {
    field?: string; // Field to modify
    action: 'remove' | 'invalidate' | 'set_to' | 'corrupt_json' | 'timeout' | 'remove_auth' | 'invalid_content_type' | 'large_payload' | 'invalid_url_param'; // What to do
    value?: any; // New value if set_to
  };
  expectedErrorStatus?: number | number[];
  expectedErrorMessage?: string | RegExp;
  expectedErrorCode?: string;
}

export interface ErrorScenarioResult {
  scenario: ErrorScenario;
  passed: boolean;
  actualStatus?: number;
  actualError?: {
    message: string;
    code?: string;
  };
  evidence: {
    request: HTTPRequestLog;
    response: HTTPResponse;
  };
}

// ============================================================================
// Test Definition (Level 6 - Comprehensive)
// ============================================================================

export interface ExpectedResponse {
  status?: StatusCodeRange;
  headers?: Record<string, string | RegExp>;
  schema?: JSONSchema;
  bodyContains?: string | string[];
  responseTimeMs?: {
    min?: number;
    max?: number;
  };
  validationRules?: ValidationRule[];
}

export interface APITestDefinition {
  id: string;
  epicId: string;
  name: string;
  description?: string;
  type: 'mcp_tool' | 'http_api';

  // MCP tool definition
  mcpTool?: MCPToolCall;

  // HTTP API definition
  httpRequest?: HTTPRequest;

  // Expected response (Level 6)
  expectedResponse: ExpectedResponse;

  // Side effects to verify (Level 6)
  sideEffects?: SideEffectVerification[];

  // Error scenarios to test (Level 6)
  errorScenarios?: ErrorScenario[];

  // Test metadata
  timeout?: number;
  retries?: number;
  tags?: string[];
}

// ============================================================================
// Test Execution Results (Level 6 - Complete Evidence)
// ============================================================================

export interface APITestResult {
  testId: string;
  testName: string;
  passed: boolean;
  durationMs: number;
  startedAt: Date;
  completedAt: Date;

  // Request/Response evidence (Level 6)
  requestLog?: HTTPRequestLog;
  responseLog?: HTTPResponse;
  mcpToolLog?: MCPToolLog;

  // Validation results (Level 6)
  validationResults: ValidationRule[];
  schemaValidation?: SchemaValidationResult;

  // Side effect verification results (Level 6)
  sideEffectResults?: SideEffectVerificationResult[];

  // Error scenario results (Level 6)
  errorScenarioResults?: ErrorScenarioResult[];

  // Failure details
  failures?: {
    type: 'validation_failed' | 'schema_failed' | 'side_effect_failed' | 'error_scenario_failed';
    description: string;
    evidence?: any;
  }[];

  // Complete evidence artifact
  evidence: {
    testId: string;
    testName: string;
    type: 'api_test';
    requestSummary?: {
      method?: string;
      url?: string;
      tool?: string;
    };
    responseSummary?: {
      status?: number;
      contentType?: string;
    };
    validationSummary: string;
    sideEffectSummary?: string;
    errorScenarioSummary?: string;
    passFail: 'pass' | 'fail';
  };

  // Error details if failed
  errorMessage?: string;
  stackTrace?: string;
}

// ============================================================================
// Test Suite
// ============================================================================

export interface APITestSuite {
  id: string;
  name: string;
  description?: string;
  tests: APITestDefinition[];
  beforeEach?: () => Promise<void>;
  afterEach?: () => Promise<void>;
}

export interface APITestSuiteResult {
  suiteId: string;
  suiteName: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  results: APITestResult[];
}

// ============================================================================
// Configuration
// ============================================================================

export interface APITestExecutorConfig {
  baseUrl?: string;
  timeout?: number; // milliseconds
  retries?: number;
  evidenceDir?: string;
  verbose?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  followRedirects?: boolean;
  validateSSL?: boolean;
}

export interface MCPConnectionConfig {
  server: string;
  host: string;
  port: number;
  protocol?: 'stdio' | 'http' | 'websocket';
  timeout?: number;
  reconnectAttempts?: number;
}

// ============================================================================
// Evidence Collection (Integration with Epic 006-A)
// ============================================================================

export interface APITestArtifact {
  testId: string;
  testType: 'api_test';
  artifacts: {
    requestLog?: string; // file path
    responseLog?: string; // file path
    validationReport?: string; // file path
    sideEffectReport?: string; // file path
    errorScenarioReport?: string; // file path
  };
  metadata: {
    timestamp: Date;
    epicId: string;
    toolName?: string;
    apiPath?: string;
    duration: number;
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class APITestError extends Error {
  constructor(
    message: string,
    public testId: string,
    public testType: 'api_test',
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APITestError';
  }
}

export class HTTPClientError extends Error {
  constructor(
    message: string,
    public request: HTTPRequest,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'HTTPClientError';
  }
}

export class MCPToolExecutionError extends Error {
  constructor(
    message: string,
    public tool: string,
    public server: string,
    public response?: any
  ) {
    super(message);
    this.name = 'MCPToolExecutionError';
  }
}

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public schema: JSONSchema,
    public data: any,
    public errors?: any[]
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}
