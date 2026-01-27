/**
 * API Test Evidence Collector (Level 6 Verification)
 * Collects evidence for API test execution:
 * - HTTP request/response pairs
 * - MCP tool call logs
 * - Tool response validation
 * - Execution timing
 */

import { Logger } from 'pino';
import {
  EvidenceCollectorConfig,
  APITestEvidence,
  HttpRequest,
  HttpResponse,
  MCPToolCall,
  TestType,
  PassFailStatus,
  EvidenceCollectionError,
} from '../types/evidence.js';
import { EvidenceCollector } from './EvidenceCollector.js';

export class APIEvidenceCollector extends EvidenceCollector {
  constructor(config: EvidenceCollectorConfig, logger: Logger) {
    super(config, logger);
  }

  /**
   * Collect API test evidence
   * @param evidence APITestEvidence containing all collected data
   * @returns Object containing paths to all saved artifacts
   */
  async collectAPITestEvidence(evidence: APITestEvidence): Promise<{
    httpRequest: string;
    httpResponse: string;
    toolCall: string;
    evidence: string;
  }> {
    const startTime = Date.now();
    const testType: TestType = 'api';
    const timestamp = new Date();

    try {
      this.logger.info(
        {
          testId: evidence.testId,
          testName: evidence.testName,
          tool: evidence.toolName,
        },
        'Starting API test evidence collection'
      );

      // Create evidence directory
      const evidenceDir = await this.createEvidenceDirectory(testType, timestamp);

      // Save HTTP request
      const requestPath = await this.saveJsonArtifact(
        evidenceDir,
        'http-request.json',
        {
          method: evidence.httpRequest.method,
          url: evidence.httpRequest.url,
          headers: evidence.httpRequest.headers,
          body: evidence.httpRequest.body,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Save HTTP response
      const responsePath = await this.saveJsonArtifact(
        evidenceDir,
        'http-response.json',
        {
          status: evidence.httpResponse.status,
          headers: evidence.httpResponse.headers,
          body: evidence.httpResponse.body,
          timing: evidence.httpResponse.timing,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Save MCP tool call
      const toolCallPath = await this.saveJsonArtifact(
        evidenceDir,
        'mcp-tool-call.json',
        {
          tool: evidence.mcpToolCall.tool,
          params: evidence.mcpToolCall.params,
          response: evidence.mcpToolCall.response,
          executionTime: evidence.mcpToolCall.executionTime,
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Save comprehensive test evidence
      const evidencePath = await this.saveJsonArtifact(
        evidenceDir,
        'api-test-evidence.json',
        {
          testId: evidence.testId,
          testName: evidence.testName,
          toolName: evidence.toolName,
          operation: evidence.operation,
          expectedOutcome: evidence.expectedOutcome,
          actualOutcome: evidence.actualOutcome,
          passFail: evidence.passFail,
          durationMs: evidence.durationMs || Date.now() - startTime,
          httpRequest: {
            method: evidence.httpRequest.method,
            url: evidence.httpRequest.url,
            headersCount: Object.keys(evidence.httpRequest.headers).length,
            bodySize: JSON.stringify(evidence.httpRequest.body).length,
          },
          httpResponse: {
            status: evidence.httpResponse.status,
            headersCount: Object.keys(evidence.httpResponse.headers).length,
            bodySize: JSON.stringify(evidence.httpResponse.body).length,
            timing: evidence.httpResponse.timing,
          },
          mcpToolCall: {
            tool: evidence.mcpToolCall.tool,
            paramsSize: JSON.stringify(evidence.mcpToolCall.params).length,
            responseSize: JSON.stringify(evidence.mcpToolCall.response).length,
            executionTime: evidence.mcpToolCall.executionTime,
          },
          timestamp: new Date().toISOString(),
        },
        testType,
        timestamp
      );

      // Verify critical artifacts
      const criticalArtifacts = [requestPath, responsePath, toolCallPath];
      for (const artifact of criticalArtifacts) {
        const exists = await this.verifyArtifact(artifact);
        if (!exists) {
          throw new EvidenceCollectionError(
            `Failed to verify artifact: ${artifact}`,
            evidence.testId,
            testType
          );
        }
      }

      this.logger.info(
        {
          testId: evidence.testId,
          duration: Date.now() - startTime,
          artifacts: {
            httpRequest: 'saved',
            httpResponse: 'saved',
            mcpToolCall: 'saved',
            evidence: 'saved',
          },
        },
        'API test evidence collection completed'
      );

      // Return paths for storage in database
      return {
        httpRequest: requestPath,
        httpResponse: responsePath,
        toolCall: toolCallPath,
        evidence: evidencePath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { testId: evidence.testId, error: errorMsg },
        'API test evidence collection failed'
      );

      throw new EvidenceCollectionError(
        `Failed to collect API test evidence: ${errorMsg}`,
        evidence.testId,
        testType
      );
    }
  }

  /**
   * Capture HTTP request with full details
   */
  async captureHttpRequest(request: HttpRequest): Promise<string> {
    return JSON.stringify(request, null, 2);
  }

  /**
   * Capture HTTP response with full details
   */
  async captureHttpResponse(response: HttpResponse): Promise<string> {
    return JSON.stringify(response, null, 2);
  }

  /**
   * Log MCP tool execution
   */
  async captureToolExecution(toolCall: MCPToolCall): Promise<string> {
    return JSON.stringify(toolCall, null, 2);
  }

  /**
   * Validate tool response matches expected schema
   */
  async validateToolResponse(
    response: any,
    expectedSchema?: Record<string, any>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    if (!expectedSchema) {
      return { valid: true };
    }

    const errors: string[] = [];

    // Basic schema validation
    for (const [key, type] of Object.entries(expectedSchema)) {
      if (!(key in response)) {
        errors.push(`Missing required field: ${key}`);
      } else if (typeof response[key] !== type) {
        errors.push(`Field ${key} has wrong type: expected ${type}, got ${typeof response[key]}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Implementation of abstract collect() method
   * Not used directly - use collectAPITestEvidence() instead
   */
  async collect(): Promise<void> {
    // API tests use collectAPITestEvidence() explicitly
  }
}
