/**
 * API Test Executor with Level 6 Verification (Main Orchestrator)
 * Coordinates HTTP API testing, MCP tool execution, response validation, and side effect verification
 *
 * Solves: "Agents claim tools work without evidence"
 * Solution: Execute actual API/tool calls + validate responses + verify side effects + test errors
 */

import { Logger } from 'pino';
import * as path from 'path';
import * as fs from 'fs/promises';
import { HTTPClient } from './HTTPClient.js';
import { MCPToolExecutor } from './MCPToolExecutor.js';
import { ResponseValidator } from './ResponseValidator.js';
import { SideEffectVerifier } from './SideEffectVerifier.js';
import { ErrorScenarioTester } from './ErrorScenarioTester.js';
import {
  APITestDefinition,
  APITestResult,
  APITestExecutorConfig,
  APITestArtifact,
  APITestError,
} from '../../types/api-testing.js';

export class APITestExecutor {
  private logger: Logger;
  private httpClient: HTTPClient;
  private mcpExecutor: MCPToolExecutor;
  private responseValidator: ResponseValidator;
  private sideEffectVerifier: SideEffectVerifier;
  private errorScenarioTester: ErrorScenarioTester;
  private config: APITestExecutorConfig;
  private evidenceDir: string;

  constructor(logger: Logger, config?: APITestExecutorConfig) {
    this.logger = logger;
    this.config = {
      baseUrl: config?.baseUrl || '',
      timeout: config?.timeout || 30000,
      retries: config?.retries || 1,
      evidenceDir: config?.evidenceDir || './test-evidence',
      verbose: config?.verbose || false,
      logRequests: config?.logRequests !== false,
      logResponses: config?.logResponses !== false,
      followRedirects: config?.followRedirects !== false,
      validateSSL: config?.validateSSL !== false,
    };

    this.evidenceDir = this.config.evidenceDir!;

    // Initialize all components
    this.httpClient = new HTTPClient(this.logger, {
      timeout: this.config.timeout,
      followRedirects: this.config.followRedirects,
      validateSSL: this.config.validateSSL,
      baseURL: this.config.baseUrl,
    });

    this.mcpExecutor = new MCPToolExecutor(this.logger, {
      connectionTimeout: this.config.timeout,
      reconnectAttempts: this.config.retries,
    });

    this.responseValidator = new ResponseValidator(this.logger);

    this.sideEffectVerifier = new SideEffectVerifier(
      this.logger,
      this.httpClient,
      this.mcpExecutor
    );

    this.errorScenarioTester = new ErrorScenarioTester(
      this.logger,
      this.httpClient,
      this.responseValidator
    );

    this.logger.info(
      {
        baseUrl: this.config.baseUrl,
        timeout: this.config.timeout,
        retries: this.config.retries,
        evidenceDir: this.evidenceDir,
      },
      'APITestExecutor initialized'
    );
  }

  /**
   * Execute a single API test with Level 6 verification
   */
  async executeTest(testDef: APITestDefinition): Promise<APITestResult> {
    const startTime = Date.now();
    const startDate = new Date();

    this.logger.info(
      { testId: testDef.id, testName: testDef.name, type: testDef.type },
      'Starting API test execution'
    );

    const result: APITestResult = {
      testId: testDef.id,
      testName: testDef.name,
      passed: false,
      durationMs: 0,
      startedAt: startDate,
      completedAt: new Date(),
      validationResults: [],
      evidence: {
        testId: testDef.id,
        testName: testDef.name,
        type: 'api_test',
        validationSummary: '',
        passFail: 'fail',
      },
    };

    try {
      // 1. Take before snapshots for side effect verification
      if (testDef.sideEffects) {
        for (const sideEffect of testDef.sideEffects) {
          await this.sideEffectVerifier.takeBeforeSnapshot(sideEffect);
        }
      }

      // 2. Execute test based on type
      if (testDef.type === 'http_api') {
        await this.executeHTTPAPITest(testDef, result);
      } else if (testDef.type === 'mcp_tool') {
        await this.executeMCPToolTest(testDef, result);
      }

      // 3. Verify side effects if present
      if (testDef.sideEffects && testDef.sideEffects.length > 0) {
        result.sideEffectResults = await this.sideEffectVerifier.verifyAll(
          testDef.sideEffects
        );

        const sideEffectsFailed = result.sideEffectResults.some(
          (r) => !r.passed
        );
        if (sideEffectsFailed) {
          result.failures = result.failures || [];
          result.failures.push({
            type: 'side_effect_failed',
            description: 'One or more side effects failed verification',
          });
        }
      }

      // 4. Test error scenarios if present
      if (testDef.errorScenarios && testDef.errorScenarios.length > 0) {
        if (testDef.httpRequest) {
          result.errorScenarioResults = await this.errorScenarioTester.testAll(
            testDef.httpRequest,
            testDef.errorScenarios
          );

          const errorScenariosFailed = result.errorScenarioResults.some(
            (r) => !r.passed
          );
          if (errorScenariosFailed) {
            result.failures = result.failures || [];
            result.failures.push({
              type: 'error_scenario_failed',
              description: 'One or more error scenarios failed',
            });
          }
        }
      }

      // 5. Determine overall pass/fail
      const validationFailed = result.validationResults.some(
        (r) => !r.passed
      );
      const sideEffectsFailed =
        result.sideEffectResults?.some((r) => !r.passed) || false;
      const errorScenariosFailed =
        result.errorScenarioResults?.some((r) => !r.passed) || false;

      result.passed =
        !validationFailed && !sideEffectsFailed && !errorScenariosFailed;

      // 6. Build evidence summary
      this.buildEvidenceSummary(result);

      // 7. Store evidence artifacts
      await this.storeEvidenceArtifacts(testDef, result);

      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger.info(
        {
          testId: testDef.id,
          passed: result.passed,
          durationMs: result.durationMs,
          validationRules: result.validationResults.length,
          sideEffects: result.sideEffectResults?.length || 0,
          errorScenarios: result.errorScenarioResults?.length || 0,
        },
        'API test execution completed'
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errorMessage = errorMsg;
      result.stackTrace = error instanceof Error ? error.stack : undefined;
      result.passed = false;
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger.error(
        { testId: testDef.id, error: errorMsg },
        'Test execution failed with exception'
      );

      return result;
    }
  }

  /**
   * Execute HTTP API test
   */
  private async executeHTTPAPITest(
    testDef: APITestDefinition,
    result: APITestResult
  ): Promise<void> {
    if (!testDef.httpRequest) {
      throw new APITestError(
        'HTTP request not defined',
        testDef.id,
        'api_test'
      );
    }

    // 1. Prepare request with base URL
    const request = { ...testDef.httpRequest };
    if (this.config.baseUrl && !request.url.startsWith('http')) {
      request.url = this.config.baseUrl + request.url;
    }

    // 2. Execute request with retry logic
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < (this.config.retries || 1); attempt++) {
      try {
        response = await this.httpClient.execute(request);
        if (response) break;
      } catch (error) {
        lastError = error;
        if (attempt < (this.config.retries || 1) - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
        }
      }
    }

    if (!response) {
      throw lastError || new APITestError(
        'HTTP request failed',
        testDef.id,
        'api_test'
      );
    }

    // 3. Store request/response logs
    result.requestLog = {
      timestamp: new Date(),
      method: request.method,
      url: request.url,
      headers: request.headers || {},
      body: request.body,
      auth: request.auth
        ? { type: request.auth.type, hasValue: true }
        : undefined,
    };
    result.responseLog = response;

    // 4. Validate response
    result.validationResults = await this.responseValidator.validateHTTPResponse(
      response,
      testDef.expectedResponse
    );

    // 5. Build evidence summary
    result.evidence.requestSummary = {
      method: request.method,
      url: request.url,
    };
    result.evidence.responseSummary = {
      status: response.status,
      contentType: String(response.headers['content-type'] || 'application/json'),
    };
  }

  /**
   * Execute MCP tool test
   */
  private async executeMCPToolTest(
    testDef: APITestDefinition,
    result: APITestResult
  ): Promise<void> {
    if (!testDef.mcpTool) {
      throw new APITestError(
        'MCP tool not defined',
        testDef.id,
        'api_test'
      );
    }

    // 1. Execute tool call
    const toolResponse = await this.mcpExecutor.execute(testDef.mcpTool);

    // 2. Store tool log
    result.mcpToolLog = {
      timestamp: new Date(),
      server: testDef.mcpTool.server,
      tool: testDef.mcpTool.tool,
      params: testDef.mcpTool.params,
      result: toolResponse.result,
      error: toolResponse.error,
      executionTime: toolResponse.timing,
    };

    // 3. Validate response
    result.validationResults = await this.responseValidator.validateMCPResponse(
      toolResponse,
      testDef.expectedResponse.schema
    );

    // 4. Build evidence summary
    result.evidence.requestSummary = {
      tool: testDef.mcpTool.tool,
    };
  }

  /**
   * Build evidence summary for result
   */
  private buildEvidenceSummary(result: APITestResult): void {
    // Validation summary
    result.evidence.validationSummary =
      this.responseValidator['generateSummary'](result.validationResults) ||
      'No validation rules applied';

    // Side effect summary
    if (result.sideEffectResults && result.sideEffectResults.length > 0) {
      result.evidence.sideEffectSummary =
        this.sideEffectVerifier['generateSummary'](
          result.sideEffectResults
        );
    }

    // Error scenario summary
    if (
      result.errorScenarioResults &&
      result.errorScenarioResults.length > 0
    ) {
      result.evidence.errorScenarioSummary =
        this.errorScenarioTester['generateSummary'](
          result.errorScenarioResults
        );
    }

    // Overall pass/fail
    result.evidence.passFail = result.passed ? 'pass' : 'fail';
  }

  /**
   * Store evidence artifacts to filesystem
   */
  private async storeEvidenceArtifacts(
    testDef: APITestDefinition,
    result: APITestResult
  ): Promise<void> {
    try {
      // Create evidence directory structure
      await fs.mkdir(
        path.join(this.evidenceDir, testDef.epicId),
        { recursive: true }
      );

      // Store request log
      if (result.requestLog) {
        await fs.writeFile(
          path.join(
            this.evidenceDir,
            testDef.epicId,
            `${testDef.id}-request.json`
          ),
          JSON.stringify(result.requestLog, null, 2)
        );
      }

      // Store response log
      if (result.responseLog) {
        await fs.writeFile(
          path.join(
            this.evidenceDir,
            testDef.epicId,
            `${testDef.id}-response.json`
          ),
          JSON.stringify(result.responseLog, null, 2)
        );
      }

      // Store validation results
      await fs.writeFile(
        path.join(
          this.evidenceDir,
          testDef.epicId,
          `${testDef.id}-validation.json`
        ),
        JSON.stringify(result.validationResults, null, 2)
      );

      this.logger.debug(
        { testId: testDef.id, epicId: testDef.epicId },
        'Evidence artifacts stored'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        { testId: testDef.id, error: message },
        'Failed to store evidence artifacts'
      );
    }
  }

  /**
   * Get executor status
   */
  getStatus(): {
    httpClient: any;
    mcpExecutor: any;
    config: APITestExecutorConfig;
  } {
    return {
      httpClient: this.httpClient.getStatus(),
      mcpExecutor: this.mcpExecutor.getStatus(),
      config: this.config,
    };
  }

  /**
   * Close all connections
   */
  async cleanup(): Promise<void> {
    await this.httpClient.close();
    await this.mcpExecutor.closeAllConnections();
    this.responseValidator.clearCache();

    this.logger.debug('APITestExecutor cleaned up');
  }
}
