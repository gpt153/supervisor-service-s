/**
 * Integration Tests for API Test Executor (Level 6 Verification)
 * Tests complete API testing workflows with real HTTP calls, validation, and side effect verification
 *
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Logger } from 'pino';
import { APITestExecutor } from '../../src/testing/api/index.js';
import { HTTPClient } from '../../src/testing/api/HTTPClient.js';
import { ResponseValidator } from '../../src/testing/api/ResponseValidator.js';
import { ErrorScenarioTester } from '../../src/testing/api/ErrorScenarioTester.js';
import {
  APITestDefinition,
  APITestResult,
  ErrorScenario,
  JSONSchema,
  ExpectedResponse,
} from '../../src/types/api-testing.js';

// Mock logger for testing
const mockLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
} as any;

describe('API Test Executor - Level 6 Verification', () => {
  let executor: APITestExecutor;
  let httpClient: HTTPClient;
  let responseValidator: ResponseValidator;

  beforeEach(() => {
    executor = new APITestExecutor(mockLogger, {
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 10000,
      verbose: true,
    });
    httpClient = new HTTPClient(mockLogger);
    responseValidator = new ResponseValidator(mockLogger);
  });

  afterEach(async () => {
    await executor.cleanup();
  });

  // ========================================================================
  // HTTP API Testing (Level 6)
  // ========================================================================

  describe('HTTP API Testing', () => {
    it('should execute GET request and validate response status', async () => {
      const testDef: APITestDefinition = {
        id: 'test-001-get',
        epicId: 'epic-006-d',
        name: 'GET /posts/1',
        description: 'Test GET request to fetch a post',
        type: 'http_api',
        httpRequest: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
        },
        expectedResponse: {
          status: 200,
          schema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number' },
              title: { type: 'string' },
              body: { type: 'string' },
            },
            required: ['id', 'title', 'body'],
          },
        },
      };

      const result = await executor.executeTest(testDef);

      expect(result.testId).toBe('test-001-get');
      expect(result.passed).toBe(true);
      expect(result.responseLog?.status).toBe(200);
      expect(result.validationResults.length).toBeGreaterThan(0);
      expect(
        result.validationResults.some((r) => r.type === 'status_code')
      ).toBe(true);
    });

    it('should execute POST request with JSON body', async () => {
      const testDef: APITestDefinition = {
        id: 'test-002-post',
        epicId: 'epic-006-d',
        name: 'POST /posts',
        description: 'Test POST request to create a post',
        type: 'http_api',
        httpRequest: {
          method: 'POST',
          url: 'https://jsonplaceholder.typicode.com/posts',
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            title: 'Test Post',
            body: 'This is a test post',
            userId: 1,
          },
        },
        expectedResponse: {
          status: 201,
        },
      };

      const result = await executor.executeTest(testDef);

      expect(result.testId).toBe('test-002-post');
      expect(result.responseLog?.status).toBe(201);
      expect(result.requestLog?.body).toEqual({
        title: 'Test Post',
        body: 'This is a test post',
        userId: 1,
      });
    });

    it('should validate response schema (Level 6 - structure verification)', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          body: { type: 'string' },
          userId: { type: 'number' },
        },
        required: ['id', 'title', 'body'],
      };

      const testDef: APITestDefinition = {
        id: 'test-003-schema',
        epicId: 'epic-006-d',
        name: 'Schema Validation',
        type: 'http_api',
        httpRequest: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
        },
        expectedResponse: {
          status: 200,
          schema,
        },
      };

      const result = await executor.executeTest(testDef);

      expect(result.passed).toBe(true);
      const schemaValidation = result.validationResults.find(
        (r) => r.type === 'schema'
      );
      expect(schemaValidation?.passed).toBe(true);
    });

    it('should capture complete request/response logs (Level 6 - evidence)', async () => {
      const testDef: APITestDefinition = {
        id: 'test-004-evidence',
        epicId: 'epic-006-d',
        name: 'Request/Response Logging',
        type: 'http_api',
        httpRequest: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
          headers: {
            'Accept': 'application/json',
          },
        },
        expectedResponse: {
          status: 200,
        },
      };

      const result = await executor.executeTest(testDef);

      // Verify request log
      expect(result.requestLog).toBeDefined();
      expect(result.requestLog?.method).toBe('GET');
      expect(result.requestLog?.url).toContain('/posts/1');
      expect(result.requestLog?.timestamp).toBeDefined();

      // Verify response log
      expect(result.responseLog).toBeDefined();
      expect(result.responseLog?.status).toBe(200);
      expect(result.responseLog?.body).toBeDefined();
      expect(result.responseLog?.timing).toBeDefined();
    });
  });

  // ========================================================================
  // Response Validation (Level 6 - Structure & Values)
  // ========================================================================

  describe('Response Validation', () => {
    it('should validate status codes', async () => {
      const expectedResponse: ExpectedResponse = {
        status: 200,
      };

      const httpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: {},
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const statusValidation = results.find((r) => r.type === 'status_code');
      expect(statusValidation?.passed).toBe(true);
    });

    it('should validate status code ranges (2xx, 4xx, etc)', async () => {
      const expectedResponse: ExpectedResponse = {
        status: '2xx',
      };

      const httpResponse = {
        status: 201,
        statusText: 'Created',
        headers: {},
        body: {},
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const statusValidation = results.find((r) => r.type === 'status_code');
      expect(statusValidation?.passed).toBe(true);
    });

    it('should validate JSON schema with detailed error messages', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          age: { type: 'number', minimum: 0, maximum: 150 },
        },
        required: ['id', 'name'],
      };

      const expectedResponse: ExpectedResponse = {
        schema,
      };

      const httpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: {
          id: 1,
          name: 'Test User',
          age: 30,
        },
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const schemaValidation = results.find((r) => r.type === 'schema');
      expect(schemaValidation?.passed).toBe(true);
    });

    it('should detect schema validation failures', async () => {
      const schema: JSONSchema = {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      };

      const expectedResponse: ExpectedResponse = {
        schema,
      };

      const httpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: {
          id: 'not-a-number', // Wrong type
          // Missing required 'name' field
        },
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const schemaValidation = results.find((r) => r.type === 'schema');
      expect(schemaValidation?.passed).toBe(false);
      expect(schemaValidation?.details).toBeDefined();
    });

    it('should validate response headers', async () => {
      const expectedResponse: ExpectedResponse = {
        headers: {
          'content-type': 'application/json',
          'x-custom-header': /^value-\d+$/,
        },
      };

      const httpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'value-123',
        },
        body: {},
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const headerValidations = results.filter((r) => r.type === 'header');
      expect(headerValidations.length).toBe(2);
      expect(headerValidations.every((r) => r.passed)).toBe(true);
    });

    it('should validate body contains specific text', async () => {
      const expectedResponse: ExpectedResponse = {
        bodyContains: ['hello', 'world'],
      };

      const httpResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        body: {
          message: 'hello world test',
        },
        timing: { total: 100 },
      };

      const results = await responseValidator.validateHTTPResponse(
        httpResponse,
        expectedResponse
      );

      const containsValidations = results.filter(
        (r) => r.type === 'body_contains'
      );
      expect(containsValidations.length).toBe(2);
      expect(containsValidations.every((r) => r.passed)).toBe(true);
    });
  });

  // ========================================================================
  // Error Scenario Testing (Level 6 - Negative Cases)
  // ========================================================================

  describe('Error Scenario Testing', () => {
    it('should test invalid input scenario', async () => {
      const errorScenarioTester = new ErrorScenarioTester(
        mockLogger,
        httpClient,
        responseValidator
      );

      const baseRequest = {
        method: 'POST' as const,
        url: 'https://jsonplaceholder.typicode.com/posts',
        body: {
          title: 'Valid Title',
          body: 'Valid Body',
          userId: 1,
        },
      };

      const scenario: ErrorScenario = {
        type: 'invalid_input',
        description: 'Send invalid data type for userId',
        modification: {
          field: 'userId',
          action: 'set_to' as const,
          value: 'not-a-number',
        },
        expectedErrorStatus: 400,
      };

      const result = await errorScenarioTester.test(baseRequest, scenario);

      // Result should capture the modification
      expect(result.evidence.request.body.userId).toBe('not-a-number');
      expect(result.evidence.response).toBeDefined();
    });

    it('should generate common error scenarios', async () => {
      const errorScenarioTester = new ErrorScenarioTester(
        mockLogger,
        httpClient,
        responseValidator
      );

      const scenarios = errorScenarioTester.generateCommonScenarios();

      expect(scenarios.length).toBeGreaterThan(0);
      expect(scenarios.some((s) => s.type === 'invalid_input')).toBe(true);
      expect(scenarios.some((s) => s.type === 'missing_required_field')).toBe(
        true
      );
      expect(scenarios.some((s) => s.type === 'authentication_failure')).toBe(
        true
      );
      expect(scenarios.some((s) => s.type === 'resource_not_found')).toBe(true);
    });
  });

  // ========================================================================
  // Test Result Evidence (Level 6)
  // ========================================================================

  describe('Test Result Evidence', () => {
    it('should generate comprehensive evidence summary', async () => {
      const testDef: APITestDefinition = {
        id: 'test-005-evidence-summary',
        epicId: 'epic-006-d',
        name: 'Evidence Summary Test',
        type: 'http_api',
        httpRequest: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
        },
        expectedResponse: {
          status: 200,
          schema: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
            },
            required: ['id', 'title'],
          },
        },
      };

      const result = await executor.executeTest(testDef);

      expect(result.evidence).toBeDefined();
      expect(result.evidence.testId).toBe('test-005-evidence-summary');
      expect(result.evidence.type).toBe('api_test');
      expect(result.evidence.validationSummary).toBeDefined();
      expect(
        result.evidence.validationSummary.length > 0
      ).toBe(true);
      expect(result.evidence.passFail).toBe(result.passed ? 'pass' : 'fail');
    });

    it('should track test execution timing', async () => {
      const testDef: APITestDefinition = {
        id: 'test-006-timing',
        epicId: 'epic-006-d',
        name: 'Timing Test',
        type: 'http_api',
        httpRequest: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/posts/1',
        },
        expectedResponse: {
          status: 200,
        },
      };

      const result = await executor.executeTest(testDef);

      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(
        result.startedAt.getTime()
      );
    });
  });

  // ========================================================================
  // Integration: Multiple Tests
  // ========================================================================

  describe('Multiple Test Execution', () => {
    it('should track test execution across multiple tests', async () => {
      const tests: APITestDefinition[] = [
        {
          id: 'test-batch-1',
          epicId: 'epic-006-d',
          name: 'Batch Test 1',
          type: 'http_api',
          httpRequest: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
          },
          expectedResponse: { status: 200 },
        },
        {
          id: 'test-batch-2',
          epicId: 'epic-006-d',
          name: 'Batch Test 2',
          type: 'http_api',
          httpRequest: {
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts/2',
          },
          expectedResponse: { status: 200 },
        },
      ];

      const results: APITestResult[] = [];
      for (const test of tests) {
        const result = await executor.executeTest(test);
        results.push(result);
      }

      expect(results.length).toBe(2);
      expect(results[0].testId).toBe('test-batch-1');
      expect(results[1].testId).toBe('test-batch-2');
      expect(results.every((r) => r.durationMs > 0)).toBe(true);
    });
  });
});
