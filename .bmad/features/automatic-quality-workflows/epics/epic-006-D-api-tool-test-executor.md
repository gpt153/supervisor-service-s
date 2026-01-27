# Epic 006-D: API & Tool Test Executor with Level 6 Verification

**Epic ID:** 006-D
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** High (80-100 hours)
**Model:** Haiku for execution, Sonnet for schema validation

---

## Rationale

**Problem:** Current validation agents claim API/MCP tool tests pass without actually calling tools or verifying responses. Research shows agents fake HTTP logs, report success without execution, or accept any response without schema validation.

**Research Findings:**
- **Level 6 verification required**: Must verify tool/service layer (actual API calls, MCP tool execution, response validation)
- **Agents fake tool calls**: Report tool was called without evidence in logs
- **No schema validation**: Accept any response structure without checking against expected schema
- **Missing error handling verification**: Don't test error cases (4xx, 5xx, timeouts)
- **No side effect verification**: Don't check if tool actually modified state (created resource, sent email, etc.)

**Solution:** Build a comprehensive API & Tool test executor that:
1. **Executes real tool calls** (MCP server, HTTP APIs, CLI tools)
2. **Captures complete evidence** (request/response logs, timing, headers)
3. **Validates response schemas** (against OpenAPI/JSON Schema)
4. **Tests error scenarios** (network failures, invalid inputs, auth errors)
5. **Verifies side effects** (check resource created, data modified, external system updated)

**Why Level 6:** Tool tests must verify actual execution, not simulated responses. Must prove tool was called AND worked correctly.

---

## Acceptance Criteria

### AC1: MCP Tool Execution Framework
- [ ] MCP server connection management (connect, disconnect, reconnect)
- [ ] Tool discovery (list available tools)
- [ ] Tool invocation with parameters
- [ ] Response capture (result, errors, timing)
- [ ] Session isolation (each test gets clean context)

### AC2: HTTP API Testing
- [ ] REST API calls (GET, POST, PUT, DELETE, PATCH)
- [ ] Request header injection (auth tokens, content-type)
- [ ] Request body formatting (JSON, form-data, XML)
- [ ] Response capture (status, headers, body, timing)
- [ ] Authentication handling (bearer tokens, API keys, OAuth)

### AC3: Response Validation (Level 6)
- [ ] Schema validation (JSON Schema, OpenAPI spec)
- [ ] Status code verification (expected vs actual)
- [ ] Header verification (content-type, cache-control, etc.)
- [ ] Body structure validation (required fields present)
- [ ] Data type validation (string, number, boolean, array, object)
- [ ] Value range validation (min/max, enum values, regex patterns)

### AC4: Error Scenario Testing
- [ ] Invalid input handling (missing required fields, wrong types)
- [ ] Authentication failures (invalid token, expired token)
- [ ] Authorization failures (insufficient permissions)
- [ ] Network errors (timeout, connection refused, DNS failure)
- [ ] Server errors (500, 503, rate limits)
- [ ] Validate error messages and codes match expected patterns

### AC5: Side Effect Verification
- [ ] Resource creation verification (check resource exists via GET)
- [ ] Data modification verification (check data changed)
- [ ] External system integration (verify webhook sent, email delivered)
- [ ] State change verification (check status transitions)
- [ ] Idempotency verification (multiple calls produce same result)

### AC6: Evidence Collection (Level 6)
- [ ] Log complete HTTP request (method, URL, headers, body)
- [ ] Log complete HTTP response (status, headers, body, timing)
- [ ] Log MCP tool invocation (tool name, parameters)
- [ ] Log MCP tool response (result, error, metadata)
- [ ] Log side effect verification (before/after state)
- [ ] Store evidence with test metadata (timestamp, test ID, epic ID)

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── testing/
│   ├── api/
│   │   ├── APITestExecutor.ts       # NEW - Main API test orchestrator
│   │   ├── MCPToolExecutor.ts       # NEW - Execute MCP tool calls
│   │   ├── HTTPClient.ts            # NEW - HTTP request execution
│   │   ├── ResponseValidator.ts     # NEW - Schema validation, status checks
│   │   ├── ErrorScenarioTester.ts   # NEW - Test error cases
│   │   └── SideEffectVerifier.ts    # NEW - Verify resource creation, state changes

├── evidence/
│   └── APIEvidenceCollector.ts      # MODIFY - Integrate with APITestExecutor

└── types/
    └── api-testing.ts                # NEW - API test type definitions

.claude/commands/subagents/testing/
├── execute-api-test.md               # NEW - API test execution agent
├── validate-api-response.md          # NEW - Response validation agent
└── verify-side-effects.md            # NEW - Side effect verification agent

tests/integration/
└── api-test-executor.test.ts         # NEW - Integration tests for API testing
```

---

## Implementation Notes

### API Test Definition Schema

```typescript
interface APITest {
  id: string;
  name: string;
  description: string;
  type: 'mcp_tool' | 'http_api' | 'cli_tool';

  // For MCP tools
  mcpTool?: {
    server: string;
    tool: string;
    params: Record<string, any>;
  };

  // For HTTP APIs
  httpRequest?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: string;
    headers?: Record<string, string>;
    body?: any;
    auth?: {
      type: 'bearer' | 'api_key' | 'basic';
      value: string;
    };
  };

  // Expected response
  expectedResponse: {
    status?: number;
    schema?: JSONSchema;
    headers?: Record<string, string | RegExp>;
    bodyContains?: string | string[];
  };

  // Side effects to verify
  sideEffects?: SideEffectVerification[];
}

interface SideEffectVerification {
  type: 'resource_created' | 'data_modified' | 'external_call_made';
  verificationMethod: 'http_get' | 'mcp_tool_call' | 'database_query';
  verificationParams: any;
  expectedResult: any;
}
```

### Test Execution Flow

```typescript
class APITestExecutor {
  async executeTest(test: APITest): Promise<APITestResult> {
    // 1. Setup evidence collector
    const evidence = new APIEvidenceCollector(test.id);

    // 2. Execute tool/API call
    let response;
    if (test.type === 'mcp_tool') {
      response = await this.mcpToolExecutor.execute(test.mcpTool);
      evidence.logMCPCall(test.mcpTool, response);
    } else if (test.type === 'http_api') {
      response = await this.httpClient.execute(test.httpRequest);
      evidence.logHTTPCall(test.httpRequest, response);
    }

    // 3. Validate response
    const validationResults = await this.responseValidator.validate(
      response,
      test.expectedResponse
    );

    // 4. Verify side effects
    const sideEffectResults = await this.sideEffectVerifier.verify(
      test.sideEffects
    );

    // 5. Determine pass/fail
    const passed =
      validationResults.every(r => r.passed) &&
      sideEffectResults.every(r => r.passed);

    return {
      testId: test.id,
      passed,
      evidence: evidence.getArtifacts(),
      validationResults,
      sideEffectResults
    };
  }
}
```

### MCP Tool Execution Pattern

```typescript
class MCPToolExecutor {
  async execute(toolCall: MCPToolCall): Promise<MCPToolResponse> {
    const startTime = Date.now();

    // 1. Connect to MCP server
    const client = await this.connectToServer(toolCall.server);

    // 2. Verify tool exists
    const tools = await client.listTools();
    if (!tools.find(t => t.name === toolCall.tool)) {
      throw new Error(`Tool not found: ${toolCall.tool}`);
    }

    // 3. Execute tool
    const response = await client.callTool({
      name: toolCall.tool,
      arguments: toolCall.params
    });

    const endTime = Date.now();

    return {
      tool: toolCall.tool,
      params: toolCall.params,
      result: response.content,
      error: response.error,
      timing: endTime - startTime,
      metadata: {
        server: toolCall.server,
        timestamp: new Date().toISOString()
      }
    };
  }
}
```

### HTTP Client Pattern

```typescript
class HTTPClient {
  async execute(request: HTTPRequest): Promise<HTTPResponse> {
    const startTime = Date.now();

    // 1. Prepare request
    const config: AxiosRequestConfig = {
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      data: request.body
    };

    // 2. Add authentication
    if (request.auth) {
      if (request.auth.type === 'bearer') {
        config.headers['Authorization'] = `Bearer ${request.auth.value}`;
      } else if (request.auth.type === 'api_key') {
        config.headers['X-API-Key'] = request.auth.value;
      }
    }

    // 3. Execute request
    try {
      const response = await axios(config);
      const endTime = Date.now();

      return {
        status: response.status,
        headers: response.headers,
        body: response.data,
        timing: endTime - startTime,
        error: null
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        status: error.response?.status || 0,
        headers: error.response?.headers || {},
        body: error.response?.data || null,
        timing: endTime - startTime,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack
        }
      };
    }
  }
}
```

### Response Validation Pattern

```typescript
class ResponseValidator {
  async validate(
    response: HTTPResponse | MCPToolResponse,
    expected: ExpectedResponse
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // 1. Validate status code
    if (expected.status !== undefined) {
      results.push({
        type: 'status_code',
        passed: response.status === expected.status,
        expected: expected.status,
        actual: response.status
      });
    }

    // 2. Validate schema
    if (expected.schema) {
      const schemaValid = await this.validateSchema(response.body, expected.schema);
      results.push({
        type: 'schema',
        passed: schemaValid.valid,
        expected: 'valid schema',
        actual: schemaValid.valid ? 'valid' : schemaValid.errors.join(', ')
      });
    }

    // 3. Validate headers
    if (expected.headers) {
      for (const [key, value] of Object.entries(expected.headers)) {
        const actualValue = response.headers[key];
        const passed = typeof value === 'string'
          ? actualValue === value
          : value.test(actualValue);

        results.push({
          type: 'header',
          passed,
          expected: value.toString(),
          actual: actualValue
        });
      }
    }

    // 4. Validate body contains
    if (expected.bodyContains) {
      const bodyString = JSON.stringify(response.body);
      const contains = Array.isArray(expected.bodyContains)
        ? expected.bodyContains
        : [expected.bodyContains];

      for (const text of contains) {
        results.push({
          type: 'body_contains',
          passed: bodyString.includes(text),
          expected: `contains "${text}"`,
          actual: bodyString.includes(text) ? 'found' : 'not found'
        });
      }
    }

    return results;
  }

  private async validateSchema(data: any, schema: JSONSchema): Promise<SchemaValidationResult> {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(schema);
    const valid = validate(data);

    return {
      valid,
      errors: valid ? [] : validate.errors.map(e => `${e.instancePath} ${e.message}`)
    };
  }
}
```

### Side Effect Verification Pattern

```typescript
class SideEffectVerifier {
  async verify(sideEffects: SideEffectVerification[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const sideEffect of sideEffects) {
      if (sideEffect.type === 'resource_created') {
        // Verify resource exists via GET request
        const exists = await this.checkResourceExists(sideEffect.verificationParams);
        results.push({
          type: 'resource_created',
          passed: exists,
          description: `Resource should exist at ${sideEffect.verificationParams.url}`,
          evidence: exists ? 'Resource found' : 'Resource not found'
        });
      } else if (sideEffect.type === 'data_modified') {
        // Verify data changed
        const modified = await this.checkDataModified(sideEffect.verificationParams);
        results.push({
          type: 'data_modified',
          passed: modified.changed,
          description: `Data should be modified`,
          evidence: `Before: ${modified.before}, After: ${modified.after}`
        });
      } else if (sideEffect.type === 'external_call_made') {
        // Verify external system received call (check logs, webhooks, etc.)
        const called = await this.checkExternalCall(sideEffect.verificationParams);
        results.push({
          type: 'external_call_made',
          passed: called,
          description: `External system should receive call`,
          evidence: called ? 'Call confirmed' : 'Call not received'
        });
      }
    }

    return results;
  }
}
```

---

## Model Selection

**Test Execution:** Haiku
- HTTP/MCP calls are deterministic (clear API contracts)
- Evidence collection is mechanical (log req/res)
- Schema validation is rule-based (JSON Schema)
- Fast execution for test suites

**Schema Validation:** Sonnet
- Understanding complex schemas (nested objects, conditionals)
- Interpreting validation errors (which field failed, why)
- Designing test cases for edge cases
- Error scenario planning

**Workflow:**
1. Haiku executes all API/tool tests
2. Haiku validates responses against schemas
3. Sonnet reviews failed schema validations
4. Sonnet designs additional error test cases

---

## Estimated Effort

- **MCP tool executor**: 16 hours
- **HTTP client**: 12 hours
- **Response validator (schema, status, headers)**: 16 hours
- **Error scenario tester**: 14 hours
- **Side effect verifier**: 16 hours
- **Evidence integration**: 10 hours
- **Unit tests**: 20 hours
- **Integration tests**: 16 hours

**Total: 120 hours (3 weeks)**

---

## Dependencies

**Blocked By:**
- Epic 006-A (Evidence Collection - needs APIEvidenceCollector)

**Blocks:**
- Epic 006-G (Test Orchestrator - needs API executor component)

---

## Testing Approach

### Unit Tests

**MCPToolExecutor:**
- [ ] Connect to MCP server (success, failure, timeout)
- [ ] List available tools
- [ ] Execute tool with valid params (success)
- [ ] Execute tool with invalid params (error handling)
- [ ] Handle server disconnect during execution

**HTTPClient:**
- [ ] GET request (success, 404, 500)
- [ ] POST request with JSON body
- [ ] Authentication (bearer, API key, basic)
- [ ] Timeout handling
- [ ] Network error handling

**ResponseValidator:**
- [ ] Status code validation (match, mismatch)
- [ ] JSON Schema validation (valid, invalid, missing fields)
- [ ] Header validation (exact match, regex match)
- [ ] Body contains validation (found, not found)

**SideEffectVerifier:**
- [ ] Resource created (exists, doesn't exist)
- [ ] Data modified (changed, unchanged)
- [ ] External call made (confirmed, not received)

### Integration Tests

**End-to-End MCP Tool Test:**
1. Start test MCP server
2. Execute tool call (e.g., Figma get_screenshot)
3. Capture evidence (tool params, response)
4. Validate response schema
5. Verify side effect (screenshot file exists)
6. Generate test report

**End-to-End HTTP API Test:**
1. Mock HTTP server with expected response
2. Execute API call (POST /users)
3. Capture evidence (request, response)
4. Validate status (201), schema (user object)
5. Verify side effect (GET /users/:id returns new user)
6. Generate test report

**Error Scenario Test:**
1. Execute API call with invalid auth token
2. Verify 401 status returned
3. Verify error message matches expected pattern
4. Verify evidence captured (request, error response)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **MCP server unavailable** | Tests can't run | Retry logic, fallback to mock server, alert on repeated failures |
| **Network instability** | Flaky tests | Retry on timeout, configurable retry count, distinguish network errors from test failures |
| **Schema drift** | Tests fail on valid responses | Version schemas, detect schema changes, alert on drift |
| **Side effect pollution** | Tests affect each other | Isolated test environments, cleanup after tests, idempotent operations |

---

## Success Metrics

- **Test execution reliability**: 98% success rate (minimal flakiness)
- **Evidence completeness**: 100% of tests have request/response logs
- **Schema validation accuracy**: 100% (no false positives/negatives)
- **Side effect verification**: 95% of side effects verified correctly
- **Execution speed**: <5 seconds per test (including verification)

---

**Next Steps After Completion:**
1. Integrate with test orchestrator (Epic 006-G)
2. Create API test library for common patterns (CRUD operations, auth flows)
3. Build schema drift detection system

---

**References:**
- MCP Protocol specification
- JSON Schema specification: https://json-schema.org
- OpenAPI specification: https://swagger.io/specification
- Evidence collection framework (Epic 006-A)
