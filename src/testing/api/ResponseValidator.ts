/**
 * Response Validator with Level 6 Verification
 * Validates HTTP responses against schemas, status codes, headers, and value ranges
 *
 * Solves: "Agent accepts any response without schema validation"
 * Solution: Comprehensive validation with JSON Schema + detailed error messages
 */

import Ajv, { ValidateFunction } from 'ajv';
import { Logger } from 'pino';
import {
  HTTPResponse,
  MCPToolResponse,
  JSONSchema,
  ValidationRule,
  SchemaValidationResult,
  ExpectedResponse,
  SchemaValidationError,
} from '../../types/api-testing.js';

export class ResponseValidator {
  private ajv: Ajv;
  private logger: Logger;
  private schemaCache: Map<string, ValidateFunction> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors, not just first
      coerceTypes: false, // Don't coerce types
      useDefaults: false, // Don't apply defaults
      strict: true, // Enforce strict mode
    });

    this.logger.debug('ResponseValidator initialized');
  }

  /**
   * Validate HTTP response against expected response spec (Level 6)
   */
  async validateHTTPResponse(
    response: HTTPResponse,
    expected: ExpectedResponse
  ): Promise<ValidationRule[]> {
    const results: ValidationRule[] = [];

    // 1. Validate status code
    if (expected.status !== undefined) {
      const statusValid = this.validateStatusCode(response.status, expected.status);
      results.push({
        type: 'status_code',
        passed: statusValid,
        expected: expected.status,
        actual: response.status,
        message: statusValid
          ? 'Status code matches expected'
          : `Expected ${expected.status}, got ${response.status}`,
      });
    }

    // 2. Validate schema
    if (expected.schema) {
      const schemaResult = await this.validateSchema(
        response.body,
        expected.schema
      );
      results.push({
        type: 'schema',
        passed: schemaResult.valid,
        expected: 'Valid JSON Schema',
        actual: schemaResult.valid ? 'Valid' : 'Invalid',
        message: schemaResult.valid
          ? 'Response matches schema'
          : `Schema validation failed: ${schemaResult.errors?.map((e) => e.message).join(', ')}`,
        details: schemaResult.errors,
      });
    }

    // 3. Validate headers
    if (expected.headers) {
      for (const [key, expectedValue] of Object.entries(expected.headers)) {
        const headerResult = this.validateHeader(
          response.headers,
          key,
          expectedValue
        );
        results.push({
          type: 'header',
          passed: headerResult.passed,
          expected: expectedValue.toString(),
          actual: headerResult.actual,
          message: headerResult.passed
            ? `Header ${key} matches expected`
            : `Header ${key} validation failed`,
        });
      }
    }

    // 4. Validate body contains
    if (expected.bodyContains) {
      const contains = Array.isArray(expected.bodyContains)
        ? expected.bodyContains
        : [expected.bodyContains];

      for (const text of contains) {
        const bodyString = JSON.stringify(response.body);
        const found = bodyString.includes(text);
        results.push({
          type: 'body_contains',
          passed: found,
          expected: `Contains "${text}"`,
          actual: found ? 'Found' : 'Not found',
          message: found
            ? `Body contains "${text}"`
            : `Body does not contain "${text}"`,
        });
      }
    }

    // 5. Validate response time
    if (expected.responseTimeMs) {
      const timingValid = this.validateTiming(
        response.timing.total,
        expected.responseTimeMs
      );
      results.push({
        type: 'response_time',
        passed: timingValid.passed,
        expected: `${expected.responseTimeMs.min || 0}-${expected.responseTimeMs.max || 'unlimited'}ms`,
        actual: `${response.timing.total}ms`,
        message: timingValid.passed
          ? 'Response time within expected range'
          : `Response time ${response.timing.total}ms outside expected range`,
      });
    }

    this.logger.info(
      {
        totalRules: results.length,
        passedRules: results.filter((r) => r.passed).length,
        failedRules: results.filter((r) => !r.passed).length,
      },
      'Response validation completed'
    );

    return results;
  }

  /**
   * Validate MCP tool response against expected schema
   */
  async validateMCPResponse(
    response: MCPToolResponse,
    expectedSchema?: JSONSchema
  ): Promise<ValidationRule[]> {
    const results: ValidationRule[] = [];

    // 1. Check for errors
    if (response.error) {
      results.push({
        type: 'schema',
        passed: false,
        expected: 'No error',
        actual: `Error: ${response.error.message}`,
        message: `Tool returned error: ${response.error.message}`,
      });

      return results;
    }

    // 2. Validate result exists
    if (!response.result) {
      results.push({
        type: 'schema',
        passed: false,
        expected: 'Result object',
        actual: 'undefined',
        message: 'Tool response missing result',
      });

      return results;
    }

    // 3. Validate against schema if provided
    if (expectedSchema) {
      const schemaResult = await this.validateSchema(
        response.result,
        expectedSchema
      );
      results.push({
        type: 'schema',
        passed: schemaResult.valid,
        expected: 'Valid JSON Schema',
        actual: schemaResult.valid ? 'Valid' : 'Invalid',
        message: schemaResult.valid
          ? 'MCP response matches schema'
          : `Schema validation failed: ${schemaResult.errors?.map((e) => e.message).join(', ')}`,
        details: schemaResult.errors,
      });
    }

    return results;
  }

  /**
   * Validate JSON Schema (Level 6 - structure verification)
   */
  private async validateSchema(
    data: any,
    schema: JSONSchema
  ): Promise<SchemaValidationResult> {
    try {
      // Use cached validator if available
      let validate = this.schemaCache.get(JSON.stringify(schema));

      if (!validate) {
        validate = this.ajv.compile(schema);
        this.schemaCache.set(JSON.stringify(schema), validate);
      }

      const valid = validate(data) as boolean;

      const errors = !valid
        ? (validate.errors || []).map((err) => ({
            path: err.instancePath || '$',
            message: err.message || 'Unknown error',
            expected: err.keyword,
            actual: data[err.instancePath?.split('/').pop() || ''],
          }))
        : [];

      this.logger.debug(
        {
          valid,
          errorCount: errors.length,
          paths: errors.map((e) => e.path),
        },
        'Schema validation result'
      );

      return { valid, errors };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        { error: message },
        'Schema compilation failed'
      );

      throw new SchemaValidationError(
        `Failed to validate schema: ${message}`,
        schema,
        data
      );
    }
  }

  /**
   * Validate HTTP status code against expected value
   */
  private validateStatusCode(actual: number, expected: string | number): boolean {
    if (typeof expected === 'number') {
      return actual === expected;
    }

    // Handle status code ranges like '2xx', '4xx'
    const rangeMatch = expected.match(/^(\d)xx$/);
    if (rangeMatch) {
      const digit = parseInt(rangeMatch[1]);
      return Math.floor(actual / 100) === digit;
    }

    return false;
  }

  /**
   * Validate header value against expected value
   */
  private validateHeader(
    headers: any,
    name: string,
    expected: string | RegExp
  ): { passed: boolean; actual?: string } {
    const actual = String(headers[name] || headers[name.toLowerCase()] || '');

    if (!actual) {
      return { passed: false, actual: 'Header not found' };
    }

    if (typeof expected === 'string') {
      return {
        passed: actual === expected,
        actual,
      };
    }

    // RegExp match
    if (actual) {
      return {
        passed: expected.test(actual),
        actual,
      };
    }

    return {
      passed: false,
      actual: 'Header not found',
    };
  }

  /**
   * Validate response timing
   */
  private validateTiming(
    actual: number,
    expected: { min?: number; max?: number }
  ): { passed: boolean } {
    if (expected.min && actual < expected.min) {
      return { passed: false };
    }

    if (expected.max && actual > expected.max) {
      return { passed: false };
    }

    return { passed: true };
  }

  /**
   * Generate validation summary
   */
  generateSummary(results: ValidationRule[]): string {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    const failedRules = results
      .filter((r) => !r.passed)
      .map((r) => `${r.type}: ${r.message}`)
      .join('; ');

    if (passed === total) {
      return `All ${total} validation rules passed`;
    }

    return `${passed}/${total} validation rules passed. Failed: ${failedRules}`;
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.logger.debug('Schema cache cleared');
  }
}
