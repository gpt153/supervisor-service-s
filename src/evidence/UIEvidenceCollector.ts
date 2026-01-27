/**
 * UI Test Evidence Collector (Level 5 Verification)
 * Collects evidence for UI test execution:
 * - Screenshots (before/after)
 * - DOM snapshots
 * - Console logs
 * - Network activity traces
 */

import { Logger } from 'pino';
import {
  EvidenceCollectorConfig,
  UITestEvidence,
  ConsoleLog,
  NetworkTrace,
  TestType,
  PassFailStatus,
  EvidenceCollectionError,
} from '../types/evidence.js';
import { EvidenceCollector } from './EvidenceCollector.js';

export class UIEvidenceCollector extends EvidenceCollector {
  constructor(config: EvidenceCollectorConfig, logger: Logger) {
    super(config, logger);
  }

  /**
   * Collect UI test evidence
   * @param evidence UITestEvidence containing all collected data
   * @returns Object containing paths to all saved artifacts
   */
  async collectUITestEvidence(evidence: UITestEvidence): Promise<{
    screenshotBefore?: string;
    screenshotAfter?: string;
    domBefore?: string;
    domAfter?: string;
    consoleLogs?: string;
    networkTraces?: string;
  }> {
    const startTime = Date.now();
    const testType: TestType = 'ui';
    const timestamp = new Date();

    try {
      this.logger.info(
        { testId: evidence.testId, testName: evidence.testName },
        'Starting UI test evidence collection'
      );

      // Create evidence directory
      const evidenceDir = await this.createEvidenceDirectory(testType, timestamp);

      // Save artifacts
      const screenshotBeforePath = evidence.screenshotBefore
        ? await this.saveArtifact(
            evidenceDir,
            'screenshot-before.png',
            evidence.screenshotBefore,
            testType,
            timestamp,
            false // Don't compress images
          )
        : undefined;

      const screenshotAfterPath = evidence.screenshotAfter
        ? await this.saveArtifact(
            evidenceDir,
            'screenshot-after.png',
            evidence.screenshotAfter,
            testType,
            timestamp,
            false // Don't compress images
          )
        : undefined;

      const domBeforePath = evidence.domBefore
        ? await this.saveArtifact(
            evidenceDir,
            'dom-before.html',
            evidence.domBefore,
            testType,
            timestamp,
            true // Compress HTML
          )
        : undefined;

      const domAfterPath = evidence.domAfter
        ? await this.saveArtifact(
            evidenceDir,
            'dom-after.html',
            evidence.domAfter,
            testType,
            timestamp,
            true // Compress HTML
          )
        : undefined;

      const consolePath = evidence.consoleLogs.length > 0
        ? await this.saveJsonArtifact(
            evidenceDir,
            'console-logs.json',
            {
              count: evidence.consoleLogs.length,
              logs: evidence.consoleLogs,
              url: evidence.url,
              action: evidence.action,
            },
            testType,
            timestamp
          )
        : undefined;

      const networkPath = evidence.networkActivity.length > 0
        ? await this.saveJsonArtifact(
            evidenceDir,
            'network-traces.json',
            {
              count: evidence.networkActivity.length,
              traces: evidence.networkActivity,
              url: evidence.url,
              action: evidence.action,
            },
            testType,
            timestamp
          )
        : undefined;

      // Verify all critical artifacts were saved
      const criticalArtifacts = [screenshotBeforePath, screenshotAfterPath];
      for (const artifact of criticalArtifacts) {
        if (!artifact) {
          throw new EvidenceCollectionError(
            'Missing required artifact (screenshot)',
            evidence.testId,
            testType
          );
        }

        const exists = await this.verifyArtifact(artifact);
        if (!exists) {
          throw new EvidenceCollectionError(
            `Failed to verify artifact: ${artifact}`,
            evidence.testId,
            testType
          );
        }
      }

      // Store metadata for later retrieval
      const metadata = {
        url: evidence.url,
        action: evidence.action,
        consoleLogs: evidence.consoleLogs.length,
        networkRequests: evidence.networkActivity.length,
        timestamp: new Date().toISOString(),
      };

      this.logger.info(
        {
          testId: evidence.testId,
          duration: Date.now() - startTime,
          artifacts: {
            screenshotBefore: screenshotBeforePath ? 'saved' : 'missing',
            screenshotAfter: screenshotAfterPath ? 'saved' : 'missing',
            domBefore: domBeforePath ? 'saved' : 'none',
            domAfter: domAfterPath ? 'saved' : 'none',
            consoleLogs: consolePath ? 'saved' : 'none',
            networkTraces: networkPath ? 'saved' : 'none',
          },
          metadata,
        },
        'UI test evidence collection completed'
      );

      // Return paths for storage in database
      return {
        screenshotBefore: screenshotBeforePath,
        screenshotAfter: screenshotAfterPath,
        domBefore: domBeforePath,
        domAfter: domAfterPath,
        consoleLogs: consolePath,
        networkTraces: networkPath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        { testId: evidence.testId, error: errorMsg },
        'UI test evidence collection failed'
      );

      throw new EvidenceCollectionError(
        `Failed to collect UI test evidence: ${errorMsg}`,
        evidence.testId,
        testType
      );
    }
  }

  /**
   * Collect console logs
   * In real usage, this would be connected to Playwright's console listener
   */
  async captureConsoleLogs(): Promise<ConsoleLog[]> {
    return [];
  }

  /**
   * Collect network traces
   * In real usage, this would be connected to Playwright's network listener
   */
  async captureNetworkActivity(): Promise<NetworkTrace[]> {
    return [];
  }

  /**
   * Capture screenshot using Playwright
   * In real usage, this would be connected to Playwright's screenshot API
   */
  async captureScreenshot(filename: string): Promise<string> {
    // This is overridden in mock/test implementations
    return '';
  }

  /**
   * Capture DOM snapshot as HTML
   */
  async captureDOMSnapshot(filename: string): Promise<string> {
    // This is overridden in mock/test implementations
    return '';
  }

  /**
   * Implementation of abstract collect() method
   * Not used directly - use collectUITestEvidence() instead
   */
  async collect(): Promise<void> {
    // UI tests use collectUITestEvidence() explicitly
  }
}
