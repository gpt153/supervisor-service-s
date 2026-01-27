/**
 * Error Scenario Tester with Level 6 Negative Case Verification
 * Tests error handling by deliberately triggering error conditions
 *
 * Solves: "Agent doesn't test error cases"
 * Solution: Test invalid inputs, auth failures, timeouts, rate limits, etc.
 */

import { Logger } from 'pino';
import { HTTPClient } from './HTTPClient.js';
import { ResponseValidator } from './ResponseValidator.js';
import {
  ErrorScenario,
  ErrorScenarioResult,
  HTTPRequest,
  HTTPResponse,
  HTTPRequestLog,
} from '../../types/api-testing.js';

export class ErrorScenarioTester {
  private logger: Logger;
  private httpClient: HTTPClient;
  private responseValidator: ResponseValidator;

  constructor(
    logger: Logger,
    httpClient: HTTPClient,
    responseValidator: ResponseValidator
  ) {
    this.logger = logger;
    this.httpClient = httpClient;
    this.responseValidator = responseValidator;

    this.logger.debug('ErrorScenarioTester initialized');
  }

  /**
   * Test all error scenarios (Level 6 - negative case verification)
   */
  async testAll(
    baseRequest: HTTPRequest,
    scenarios: ErrorScenario[]
  ): Promise<ErrorScenarioResult[]> {
    const results: ErrorScenarioResult[] = [];

    this.logger.info(
      { scenarioCount: scenarios.length },
      'Starting error scenario testing'
    );

    for (const scenario of scenarios) {
      const result = await this.test(baseRequest, scenario);
      results.push(result);
    }

    this.logger.info(
      {
        totalScenarios: scenarios.length,
        passedScenarios: results.filter((r) => r.passed).length,
        failedScenarios: results.filter((r) => !r.passed).length,
      },
      'Error scenario testing completed'
    );

    return results;
  }

  /**
   * Test a single error scenario
   */
  async test(
    baseRequest: HTTPRequest,
    scenario: ErrorScenario
  ): Promise<ErrorScenarioResult> {
    const result: ErrorScenarioResult = {
      scenario,
      passed: false,
      evidence: {
        request: {} as HTTPRequestLog,
        response: {} as HTTPResponse,
      },
    };

    try {
      this.logger.debug(
        {
          type: scenario.type,
          description: scenario.description,
        },
        'Testing error scenario'
      );

      // 1. Create modified request based on scenario
      const modifiedRequest = this.applyModification(
        baseRequest,
        scenario.modification
      );

      // 2. Execute request
      const response = await this.httpClient.execute(modifiedRequest);

      // 3. Capture evidence
      result.evidence.request = this.captureRequestLog(modifiedRequest);
      result.evidence.response = response;

      // 4. Verify error occurred as expected
      result.passed = this.verifyErrorScenario(scenario, response);

      if (result.passed) {
        this.logger.info(
          {
            type: scenario.type,
            status: response.status,
            errorCode: response.error?.code,
          },
          'Error scenario verified'
        );
      } else {
        this.logger.warn(
          {
            type: scenario.type,
            expectedStatus: scenario.expectedErrorStatus,
            actualStatus: response.status,
            expectedError: scenario.expectedErrorMessage,
            actualError: response.error?.message,
          },
          'Error scenario verification failed'
        );

        result.actualStatus = response.status;
        result.actualError = response.error;
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      result.passed = false;
      result.actualError = {
        message,
        code: 'TEST_ERROR',
      };

      this.logger.error(
        {
          type: scenario.type,
          error: message,
        },
        'Error scenario testing failed with exception'
      );

      return result;
    }
  }

  /**
   * Apply modification to request based on error scenario
   */
  private applyModification(
    baseRequest: HTTPRequest,
    modification: { field?: string; action: string; value?: any }
  ): HTTPRequest {
    const request = JSON.parse(JSON.stringify(baseRequest));

    switch (modification.action) {
      case 'remove':
        if (modification.field) {
          // Remove field from request body or params
          if (request.body && typeof request.body === 'object') {
            delete request.body[modification.field];
          }
        }
        break;

      case 'invalidate':
        if (modification.field) {
          // Set to invalid value
          if (request.body && typeof request.body === 'object') {
            request.body[modification.field] = 'INVALID_VALUE_FOR_TESTING';
          }
        } else {
          // Invalidate auth token
          if (request.auth) {
            request.auth.value = 'invalid_token_12345';
          }
        }
        break;

      case 'set_to':
        if (modification.field) {
          // Set to specific value
          if (!request.body || typeof request.body !== 'object') {
            request.body = {};
          }
          request.body[modification.field] = modification.value;
        }
        break;

      case 'corrupt_json':
        // Corrupt JSON body
        if (request.body && typeof request.body === 'object') {
          request.body = 'CORRUPTED{json}}}';
        }
        break;

      case 'timeout':
        // Set very short timeout
        request.timeout = 1;
        break;

      case 'remove_auth':
        // Remove authentication
        request.auth = undefined;
        break;

      case 'invalid_content_type':
        // Set invalid content type
        if (!request.headers) {
          request.headers = {};
        }
        request.headers['Content-Type'] = 'application/invalid';
        break;

      case 'large_payload':
        // Create large request body
        if (!request.body) {
          request.body = {};
        }
        request.body = {
          ...request.body,
          largeField: 'x'.repeat(10 * 1024 * 1024), // 10MB
        };
        break;

      case 'invalid_url_param':
        // Append invalid URL parameter
        request.url += (request.url.includes('?') ? '&' : '?') + 'invalid=test';
        break;
    }

    return request;
  }

  /**
   * Verify error scenario matched expectations
   */
  private verifyErrorScenario(
    scenario: ErrorScenario,
    response: HTTPResponse
  ): boolean {
    // 1. Check status code
    if (scenario.expectedErrorStatus) {
      const statuses = Array.isArray(scenario.expectedErrorStatus)
        ? scenario.expectedErrorStatus
        : [scenario.expectedErrorStatus];

      if (!statuses.includes(response.status)) {
        return false;
      }
    }

    // 2. Check error message if expecting one
    if (scenario.expectedErrorMessage && response.error) {
      if (typeof scenario.expectedErrorMessage === 'string') {
        if (
          !response.error.message.includes(
            scenario.expectedErrorMessage
          )
        ) {
          return false;
        }
      } else {
        // RegExp match
        if (!scenario.expectedErrorMessage.test(response.error.message)) {
          return false;
        }
      }
    }

    // 3. Check error code if specified
    if (scenario.expectedErrorCode && response.error) {
      if (response.error.code !== scenario.expectedErrorCode) {
        return false;
      }
    }

    return true;
  }

  /**
   * Capture request log from request
   */
  private captureRequestLog(request: HTTPRequest): HTTPRequestLog {
    return {
      timestamp: new Date(),
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      body: request.body,
      auth: request.auth
        ? { type: request.auth.type, hasValue: true }
        : undefined,
    };
  }

  /**
   * Generate common error scenarios for HTTP API
   */
  generateCommonScenarios(): ErrorScenario[] {
    return [
      {
        type: 'invalid_input',
        description: 'Send request with invalid input data',
        modification: {
          field: 'input',
          action: 'invalidate',
        },
        expectedErrorStatus: 400,
      },
      {
        type: 'missing_required_field',
        description: 'Send request missing required field',
        modification: {
          field: 'id',
          action: 'remove',
        },
        expectedErrorStatus: 400,
      },
      {
        type: 'wrong_data_type',
        description: 'Send field with wrong data type',
        modification: {
          field: 'count',
          action: 'set_to',
          value: 'not_a_number',
        },
        expectedErrorStatus: 400,
      },
      {
        type: 'authentication_failure',
        description: 'Send request with invalid auth token',
        modification: {
          action: 'remove_auth',
        },
        expectedErrorStatus: [401, 403],
      },
      {
        type: 'resource_not_found',
        description: 'Request non-existent resource',
        modification: {
          field: 'id',
          action: 'set_to',
          value: 'nonexistent_id_xyz',
        },
        expectedErrorStatus: 404,
      },
      {
        type: 'invalid_json',
        description: 'Send corrupted JSON body',
        modification: {
          action: 'corrupt_json',
        },
        expectedErrorStatus: 400,
      },
      {
        type: 'invalid_content_type',
        description: 'Send with invalid content-type header',
        modification: {
          action: 'invalid_content_type',
        },
        expectedErrorStatus: [400, 415],
      },
    ];
  }

  /**
   * Generate error scenario summary
   */
  generateSummary(results: ErrorScenarioResult[]): string {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    if (total === 0) {
      return 'No error scenarios tested';
    }

    if (passed === total) {
      return `All ${total} error scenarios passed`;
    }

    const failed = results.filter((r) => !r.passed);
    return `${passed}/${total} error scenarios passed. Failed: ${failed.map((f) => f.scenario.type).join(', ')}`;
  }
}
