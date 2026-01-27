# API Test Executor - Usage Examples (Level 6 Verification)

## Overview

The API Test Executor provides comprehensive Level 6 verification for:
- **HTTP APIs**: REST endpoints with full request/response logging
- **MCP Tools**: Tool invocation with execution evidence
- **Side Effects**: Database/file/external system state changes
- **Error Scenarios**: Negative testing for error handling

## Quick Start

### Basic HTTP API Test

```typescript
import { APITestExecutor } from './api/index.js';
import pino from 'pino';

const logger = pino();
const executor = new APITestExecutor(logger, {
  baseUrl: 'https://api.example.com',
  timeout: 30000,
  verbose: true,
});

// Define a test
const testDef = {
  id: 'test-001',
  epicId: 'epic-006-d',
  name: 'GET /users/1',
  type: 'http_api',
  httpRequest: {
    method: 'GET',
    url: '/users/1',
  },
  expectedResponse: {
    status: 200,
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id', 'name', 'email'],
    },
  },
};

// Execute test
const result = await executor.executeTest(testDef);

// Check results
console.log(`Test passed: ${result.passed}`);
console.log(`Status: ${result.responseLog?.status}`);
console.log(`Validation results: ${result.validationResults.length}`);
console.log(`Duration: ${result.durationMs}ms`);
```

## Level 6 Verification Examples

### Level 1-4: Request & Response Verification

```typescript
const testDef = {
  id: 'test-create-user',
  epicId: 'epic-006-d',
  name: 'Create User',
  type: 'http_api',
  httpRequest: {
    method: 'POST',
    url: '/users',
    headers: {
      'Content-Type': 'application/json',
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com',
    },
  },
  expectedResponse: {
    status: 201,  // Level 1: Status code
    schema: {     // Level 3: Structure validation
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: ['id', 'name', 'email', 'createdAt'],
    },
    headers: {    // Level 4: Header validation
      'content-type': 'application/json',
      'x-request-id': /^[a-f0-9-]+$/,  // Regex pattern
    },
    bodyContains: ['john@example.com'],  // Level 4: Value verification
  },
};

const result = await executor.executeTest(testDef);
```

### Level 5: Side Effect Verification

```typescript
const testDef = {
  id: 'test-create-and-verify',
  epicId: 'epic-006-d',
  name: 'Create User with Side Effect Verification',
  type: 'http_api',
  httpRequest: {
    method: 'POST',
    url: '/users',
    body: { name: 'Jane Doe', email: 'jane@example.com' },
  },
  expectedResponse: {
    status: 201,
  },
  // Level 5: Verify resource was created
  sideEffects: [
    {
      type: 'resource_created',
      description: 'User should exist in database',
      verificationMethod: 'http_get',
      verificationParams: {
        url: '/users/jane@example.com',  // Verify by GET
      },
    },
    {
      type: 'resource_modified',
      description: 'User count should increase',
      verificationMethod: 'http_get',
      verificationParams: {
        url: '/users/count',
      },
      expectedResult: { count: 101 },  // Previous count + 1
    },
  ],
};

const result = await executor.executeTest(testDef);
console.log(`Side effects verified: ${result.sideEffectResults?.filter(r => r.passed).length}`);
```

### Level 6: Negative Case Testing (Error Scenarios)

```typescript
const testDef = {
  id: 'test-invalid-input',
  epicId: 'epic-006-d',
  name: 'User Creation with Error Scenarios',
  type: 'http_api',
  httpRequest: {
    method: 'POST',
    url: '/users',
    body: {
      name: 'Test User',
      email: 'test@example.com',
    },
  },
  expectedResponse: {
    status: 201,
  },
  // Level 6: Test error handling
  errorScenarios: [
    {
      type: 'missing_required_field',
      description: 'Missing email should return 400',
      modification: {
        field: 'email',
        action: 'remove',
      },
      expectedErrorStatus: 400,
    },
    {
      type: 'wrong_data_type',
      description: 'Invalid email format should return 400',
      modification: {
        field: 'email',
        action: 'set_to',
        value: 'not-an-email',
      },
      expectedErrorStatus: 400,
      expectedErrorMessage: /invalid email/i,
    },
    {
      type: 'authentication_failure',
      description: 'Missing auth should return 401',
      modification: {
        action: 'remove_auth',
      },
      expectedErrorStatus: 401,
    },
  ],
};

const result = await executor.executeTest(testDef);
console.log(`Error scenarios passed: ${result.errorScenarioResults?.filter(r => r.passed).length}/${result.errorScenarioResults?.length}`);
```

## MCP Tool Testing

```typescript
const testDef = {
  id: 'test-figma-screenshot',
  epicId: 'epic-006-d',
  name: 'Figma Get Screenshot',
  type: 'mcp_tool',
  mcpTool: {
    server: 'figma',
    tool: 'get_screenshot',
    params: {
      fileKey: 'abc123',
      nodeId: '10:20',
    },
  },
  expectedResponse: {
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        width: { type: 'number' },
        height: { type: 'number' },
      },
      required: ['url', 'width', 'height'],
    },
  },
  // Verify screenshot file was actually created
  sideEffects: [
    {
      type: 'resource_created',
      description: 'Screenshot file should exist',
      verificationMethod: 'file_check',
      verificationParams: {
        path: '$(result.url)',  // Reference the tool result
      },
    },
  ],
};

const result = await executor.executeTest(testDef);
```

## Authentication Examples

### Bearer Token

```typescript
httpRequest: {
  method: 'GET',
  url: '/secure-data',
  auth: {
    type: 'bearer',
    value: 'eyJhbGc...',  // JWT token
  },
}
```

### API Key

```typescript
httpRequest: {
  method: 'GET',
  url: '/api/data',
  auth: {
    type: 'api_key',
    value: 'sk-1234567890',
    headerName: 'X-API-Key',  // Custom header name
  },
}
```

### Basic Auth

```typescript
httpRequest: {
  method: 'GET',
  url: '/admin/data',
  auth: {
    type: 'basic',
    value: 'username:password',
  },
}
```

## Response Validation Examples

### Status Code Ranges

```typescript
expectedResponse: {
  status: '2xx',  // Accept any 2xx status (200-299)
}

expectedResponse: {
  status: 201,    // Exact status code
}
```

### Schema Validation

```typescript
expectedResponse: {
  schema: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            value: { type: 'string', minLength: 1, maxLength: 100 },
            score: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['id', 'value'],
        },
      },
    },
  },
}
```

### Header Validation

```typescript
expectedResponse: {
  headers: {
    'content-type': 'application/json',          // Exact match
    'x-request-id': /^[a-f0-9-]{36}$/,         // Regex pattern
    'cache-control': /max-age=\d+/,             // Pattern
  },
}
```

### Response Timing

```typescript
expectedResponse: {
  responseTimeMs: {
    min: 0,
    max: 1000,  // Response must complete in <1 second
  },
}
```

## Complete Integration Example

```typescript
import { APITestExecutor } from './api/index.js';
import pino from 'pino';

async function runCompleteTest() {
  const logger = pino();
  const executor = new APITestExecutor(logger, {
    baseUrl: 'https://api.example.com',
    timeout: 30000,
    evidenceDir: './test-evidence',
  });

  try {
    // Test 1: Create resource
    const createResult = await executor.executeTest({
      id: 'create-001',
      epicId: 'epic-006-d',
      name: 'Create Resource',
      type: 'http_api',
      httpRequest: {
        method: 'POST',
        url: '/resources',
        auth: { type: 'bearer', value: process.env.API_TOKEN! },
        body: { name: 'Test Resource', data: { key: 'value' } },
      },
      expectedResponse: { status: 201 },
    });

    if (!createResult.passed) {
      console.error('Create test failed', createResult);
      return;
    }

    // Test 2: Verify resource was created
    const resourceId = createResult.responseLog?.body.id;
    const getResult = await executor.executeTest({
      id: 'get-001',
      epicId: 'epic-006-d',
      name: 'Get Created Resource',
      type: 'http_api',
      httpRequest: {
        method: 'GET',
        url: `/resources/${resourceId}`,
        auth: { type: 'bearer', value: process.env.API_TOKEN! },
      },
      expectedResponse: {
        status: 200,
        schema: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' },
          },
          required: ['id', 'name'],
        },
      },
    });

    // Test 3: Test error case - invalid ID
    const notFoundResult = await executor.executeTest({
      id: 'error-001',
      epicId: 'epic-006-d',
      name: 'Invalid Resource ID',
      type: 'http_api',
      httpRequest: {
        method: 'GET',
        url: '/resources/invalid-id',
        auth: { type: 'bearer', value: process.env.API_TOKEN! },
      },
      expectedResponse: { status: 404 },
    });

    // Report results
    console.log('Test Results:');
    console.log(`Create test: ${createResult.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Get test: ${getResult.passed ? 'PASS' : 'FAIL'}`);
    console.log(`Error test: ${notFoundResult.passed ? 'PASS' : 'FAIL'}`);

    // Cleanup
    await executor.cleanup();
  } catch (error) {
    console.error('Test suite failed:', error);
  }
}

runCompleteTest();
```

## Evidence Artifacts

All tests automatically generate evidence artifacts:

```
test-evidence/
└── epic-006-d/
    ├── test-001-request.json      # HTTP request details
    ├── test-001-response.json     # HTTP response details
    ├── test-001-validation.json   # Validation results
    ├── test-002-request.json
    ├── test-002-response.json
    └── test-002-validation.json
```

Evidence includes:
- Complete HTTP request (method, URL, headers, body)
- Complete HTTP response (status, headers, body, timing)
- Validation results for each rule
- Side effect verification results
- Error scenario test results

## Key Features

1. **Level 6 Verification**: Proves tools actually work (not simulated)
2. **Complete Logging**: Request/response pairs with timing
3. **Schema Validation**: JSON Schema validation with detailed errors
4. **Side Effect Verification**: Before/after state snapshots
5. **Error Scenario Testing**: Negative test cases for robustness
6. **Evidence Artifacts**: All test data preserved for analysis
7. **Flexible Authentication**: Bearer, API Key, Basic Auth
8. **Timeout & Retry**: Configurable timeouts and retry logic
9. **Performance Metrics**: Response timing tracked
10. **Error Details**: Stack traces and error messages preserved

## Testing Best Practices

1. **Order tests**: Create → Read → Update → Delete
2. **Capture IDs**: Store resource IDs from create responses
3. **Verify side effects**: Always test side effect verification
4. **Test errors**: Include negative test cases
5. **Use schemas**: Define expected response structures
6. **Log evidence**: Review generated artifacts for debugging
7. **Clean up**: Close executor and connections after tests
8. **Use appropriate timeouts**: Set realistic timeout values
9. **Test authentication**: Include auth failure scenarios
10. **Batch related tests**: Group tests by resource type
