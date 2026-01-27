/**
 * Side Effect Verifier with Level 6 Verification
 * Verifies that API/tool calls actually modified state (database, files, external systems)
 *
 * Solves: "Agent doesn't verify if tool actually did what it claims"
 * Solution: Before/after state snapshots, confirm changes actually occurred
 */

import { Logger } from 'pino';
import { HTTPClient } from './HTTPClient.js';
import { MCPToolExecutor } from './MCPToolExecutor.js';
import {
  SideEffectVerification,
  SideEffectVerificationResult,
  SideEffectType,
} from '../../types/api-testing.js';

export class SideEffectVerifier {
  private logger: Logger;
  private httpClient: HTTPClient;
  private mcpExecutor: MCPToolExecutor;

  constructor(
    logger: Logger,
    httpClient: HTTPClient,
    mcpExecutor: MCPToolExecutor
  ) {
    this.logger = logger;
    this.httpClient = httpClient;
    this.mcpExecutor = mcpExecutor;

    this.logger.debug('SideEffectVerifier initialized');
  }

  /**
   * Verify all side effects for a test (Level 6 - behavioral verification)
   */
  async verifyAll(
    sideEffects: SideEffectVerification[]
  ): Promise<SideEffectVerificationResult[]> {
    const results: SideEffectVerificationResult[] = [];

    for (const sideEffect of sideEffects) {
      const result = await this.verify(sideEffect);
      results.push(result);
    }

    this.logger.info(
      {
        totalEffects: sideEffects.length,
        verifiedEffects: results.filter((r) => r.passed).length,
        failedEffects: results.filter((r) => !r.passed).length,
      },
      'Side effect verification completed'
    );

    return results;
  }

  /**
   * Verify a single side effect
   */
  async verify(
    sideEffect: SideEffectVerification
  ): Promise<SideEffectVerificationResult> {
    const result: SideEffectVerificationResult = {
      type: sideEffect.type,
      description: sideEffect.description,
      passed: false,
    };

    try {
      this.logger.debug(
        {
          type: sideEffect.type,
          method: sideEffect.verificationMethod,
        },
        'Verifying side effect'
      );

      switch (sideEffect.type) {
        case 'resource_created':
          result.passed = await this.verifyResourceCreated(
            sideEffect
          );
          result.evidence = 'Resource found';
          break;

        case 'resource_modified':
          result.passed = await this.verifyResourceModified(
            sideEffect
          );
          result.evidence = 'Resource modification verified';
          break;

        case 'resource_deleted':
          result.passed = await this.verifyResourceDeleted(
            sideEffect
          );
          result.evidence = 'Resource deletion verified';
          break;

        case 'database_change':
          result.passed = await this.verifyDatabaseChange(
            sideEffect
          );
          result.evidence = 'Database change verified';
          break;

        case 'external_call_made':
          result.passed = await this.verifyExternalCall(
            sideEffect
          );
          result.evidence = 'External call verified';
          break;

        case 'message_sent':
          result.passed = await this.verifyMessageSent(
            sideEffect
          );
          result.evidence = 'Message delivery verified';
          break;

        case 'cache_updated':
          result.passed = await this.verifyCacheUpdated(
            sideEffect
          );
          result.evidence = 'Cache update verified';
          break;

        default:
          result.passed = false;
          result.evidence = 'Unknown side effect type';
      }

      if (result.passed) {
        this.logger.info(
          { type: sideEffect.type },
          'Side effect verified successfully'
        );
      } else {
        this.logger.warn(
          { type: sideEffect.type, description: sideEffect.description },
          'Side effect verification failed'
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      result.passed = false;
      result.details = `Verification error: ${message}`;

      this.logger.error(
        {
          type: sideEffect.type,
          error: message,
        },
        'Side effect verification failed with exception'
      );

      return result;
    }
  }

  /**
   * Verify resource was created
   */
  private async verifyResourceCreated(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    if (sideEffect.verificationMethod === 'http_get') {
      // Try to GET the resource
      const params = sideEffect.verificationParams as any;
      const response = await this.httpClient.execute({
        method: 'GET',
        url: params.url,
        timeout: 5000,
      });

      // Resource exists if we get 2xx or 3xx status
      const exists = response.status >= 200 && response.status < 400;

      if (exists) {
        sideEffect.afterSnapshot = response.body;
      }

      return exists;
    }

    if (sideEffect.verificationMethod === 'mcp_tool_call') {
      // Use MCP tool to verify resource exists
      const params = sideEffect.verificationParams as any;
      const response = await this.mcpExecutor.execute({
        server: params.server,
        tool: params.tool,
        params: params.toolParams,
      });

      return !response.error && !!response.result;
    }

    // Database or file checks would need additional implementation
    return false;
  }

  /**
   * Verify resource was modified
   */
  private async verifyResourceModified(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    if (sideEffect.verificationMethod === 'http_get') {
      // Get current state
      const params = sideEffect.verificationParams as any;
      const response = await this.httpClient.execute({
        method: 'GET',
        url: params.url,
        timeout: 5000,
      });

      if (response.status < 200 || response.status >= 400) {
        return false;
      }

      sideEffect.afterSnapshot = response.body;

      // Compare with expected result
      if (sideEffect.expectedResult) {
        return this.deepEqual(response.body, sideEffect.expectedResult);
      }

      // If before snapshot exists, verify it changed
      if (sideEffect.beforeSnapshot) {
        return !this.deepEqual(
          sideEffect.beforeSnapshot,
          response.body
        );
      }

      return true;
    }

    return false;
  }

  /**
   * Verify resource was deleted
   */
  private async verifyResourceDeleted(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    if (sideEffect.verificationMethod === 'http_get') {
      // Try to GET the resource
      const params = sideEffect.verificationParams as any;
      const response = await this.httpClient.execute({
        method: 'GET',
        url: params.url,
        timeout: 5000,
      });

      // Resource is deleted if we get 404
      return response.status === 404;
    }

    return false;
  }

  /**
   * Verify database change occurred
   */
  private async verifyDatabaseChange(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    // This would require database connection and query execution
    // For now, return false to indicate not yet implemented
    this.logger.warn(
      'Database change verification requires database connection'
    );
    return false;
  }

  /**
   * Verify external call was made
   */
  private async verifyExternalCall(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    // This would check webhook logs, event queues, etc.
    // For now, return false to indicate not yet implemented
    this.logger.warn(
      'External call verification requires log/webhook access'
    );
    return false;
  }

  /**
   * Verify message was sent
   */
  private async verifyMessageSent(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    // This would check email, Slack, SMS, etc.
    // For now, return false to indicate not yet implemented
    this.logger.warn('Message verification requires message service access');
    return false;
  }

  /**
   * Verify cache was updated
   */
  private async verifyCacheUpdated(
    sideEffect: SideEffectVerification
  ): Promise<boolean> {
    // This would check Redis, Memcached, etc.
    // For now, return false to indicate not yet implemented
    this.logger.warn('Cache verification requires cache service access');
    return false;
  }

  /**
   * Take before snapshot for comparison
   */
  async takeBeforeSnapshot(
    sideEffect: SideEffectVerification
  ): Promise<void> {
    if (sideEffect.verificationMethod === 'http_get') {
      const params = sideEffect.verificationParams as any;
      const response = await this.httpClient.execute({
        method: 'GET',
        url: params.url,
        timeout: 5000,
      });

      if (response.status >= 200 && response.status < 400) {
        sideEffect.beforeSnapshot = response.body;
      }
    }
  }

  /**
   * Compare two objects for equality (deep)
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (
      typeof a !== 'object' ||
      typeof b !== 'object' ||
      a === null ||
      b === null
    ) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!keysB.includes(key)) {
        return false;
      }

      if (!this.deepEqual(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Generate side effect summary
   */
  generateSummary(results: SideEffectVerificationResult[]): string {
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;

    if (total === 0) {
      return 'No side effects to verify';
    }

    if (passed === total) {
      return `All ${total} side effects verified successfully`;
    }

    const failed = results.filter((r) => !r.passed);
    return `${passed}/${total} side effects verified. Failed: ${failed.map((f) => f.description).join(', ')}`;
  }
}
