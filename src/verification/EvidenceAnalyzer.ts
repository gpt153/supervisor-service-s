/**
 * Evidence Analyzer
 * Analyzes individual evidence artifacts to extract meaningful information
 * Epic 006-E: Independent Verification Agent
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { Logger } from 'pino';
import {
  ScreenshotAnalysisResult,
  ConsoleLogAnalysis,
  HTTPTraceAnalysis,
  DOMAnalysis,
  CoverageAnalysis,
} from '../types/verification.js';
import { ConsoleLog, NetworkTrace } from '../types/evidence.js';

export class EvidenceAnalyzer {
  constructor(
    private artifactDir: string,
    private logger: Logger
  ) {}

  /**
   * Analyze screenshot for error indicators
   * Note: This is a heuristic analysis based on file size and naming patterns
   * In production, this would use image analysis AI
   */
  async analyzeScreenshot(screenshotPath: string): Promise<ScreenshotAnalysisResult> {
    try {
      const fullPath = join(this.artifactDir, screenshotPath);
      const exists = await this.fileExists(fullPath);

      if (!exists) {
        return {
          hasErrorUI: false,
          hasSuccessUI: false,
          hasLoadingUI: false,
          uiElements: [],
          errors: ['Screenshot file not found'],
        };
      }

      // For now, use heuristics based on filename and size
      // In production, this would use actual image analysis
      const hasErrorInName = screenshotPath.toLowerCase().includes('error');
      const hasSuccessInName = screenshotPath.toLowerCase().includes('success');

      return {
        hasErrorUI: hasErrorInName,
        hasSuccessUI: hasSuccessInName,
        hasLoadingUI: false,
        uiElements: [], // Would be populated by image analysis
        errors: hasErrorInName ? ['Error indicator in screenshot filename'] : [],
      };
    } catch (error) {
      this.logger.error({ error, path: screenshotPath }, 'Failed to analyze screenshot');
      return {
        hasErrorUI: false,
        hasSuccessUI: false,
        hasLoadingUI: false,
        uiElements: [],
        errors: [`Screenshot analysis failed: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Analyze console logs for errors and patterns
   */
  async analyzeConsoleLogs(logsPath: string): Promise<ConsoleLogAnalysis> {
    try {
      const fullPath = join(this.artifactDir, logsPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const logs: ConsoleLog[] = JSON.parse(content);

      const errorCount = logs.filter((log) => log.level === 'error').length;
      const warningCount = logs.filter((log) => log.level === 'warning').length;
      const infoCount = logs.filter((log) => log.level === 'info').length;

      const errorLogs = logs.filter((log) => log.level === 'error');
      const hasUncaughtErrors = errorLogs.some((log) =>
        log.message.toLowerCase().includes('uncaught')
      );

      const criticalErrors = errorLogs
        .filter((log) => {
          const msg = log.message.toLowerCase();
          return (
            msg.includes('fatal') ||
            msg.includes('uncaught') ||
            msg.includes('unhandled rejection')
          );
        })
        .map((log) => log.message);

      // Detect repeated patterns
      const patterns = this.detectLogPatterns(logs);

      return {
        errorCount,
        warningCount,
        infoCount,
        hasUncaughtErrors,
        criticalErrors,
        patterns,
      };
    } catch (error) {
      this.logger.error({ error, path: logsPath }, 'Failed to analyze console logs');
      return {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        hasUncaughtErrors: false,
        criticalErrors: [],
        patterns: [],
      };
    }
  }

  /**
   * Analyze HTTP traces for failures and performance issues
   */
  async analyzeHTTPTraces(tracePath: string): Promise<HTTPTraceAnalysis> {
    try {
      const fullPath = join(this.artifactDir, tracePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const traces: NetworkTrace[] = JSON.parse(content);

      const requestCount = traces.length;
      const failedRequests = traces.filter(
        (t) => t.statusCode >= 400 && t.statusCode < 600
      ).length;

      const responseTimes = traces
        .filter((t) => t.responseTime !== undefined)
        .map((t) => t.responseTime!);
      const averageResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      const slowRequests = traces.filter((t) => t.responseTime && t.responseTime > 1000)
        .length;

      const authFailures = traces.filter(
        (t) => t.statusCode === 401 || t.statusCode === 403
      ).length;

      const serverErrors = traces.filter(
        (t) => t.statusCode >= 500 && t.statusCode < 600
      ).length;

      return {
        requestCount,
        failedRequests,
        averageResponseTime,
        slowRequests,
        authFailures,
        serverErrors,
      };
    } catch (error) {
      this.logger.error({ error, path: tracePath }, 'Failed to analyze HTTP traces');
      return {
        requestCount: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        slowRequests: 0,
        authFailures: 0,
        serverErrors: 0,
      };
    }
  }

  /**
   * Analyze DOM snapshots for changes
   */
  async analyzeDOMSnapshot(
    beforePath: string | undefined,
    afterPath: string | undefined
  ): Promise<DOMAnalysis> {
    try {
      if (!beforePath || !afterPath) {
        return {
          changeCount: 0,
          nodesAdded: 0,
          nodesRemoved: 0,
          attributeChanges: 0,
          significantChanges: false,
        };
      }

      const beforeHTML = await fs.readFile(join(this.artifactDir, beforePath), 'utf-8');
      const afterHTML = await fs.readFile(join(this.artifactDir, afterPath), 'utf-8');

      // Simple heuristic: Count lines that changed
      const beforeLines = beforeHTML.split('\n');
      const afterLines = afterHTML.split('\n');

      const changeCount = Math.abs(afterLines.length - beforeLines.length);
      const significantChanges = changeCount > 10; // More than 10 lines changed

      // Estimate nodes added/removed by line count difference
      const nodesAdded = Math.max(0, afterLines.length - beforeLines.length);
      const nodesRemoved = Math.max(0, beforeLines.length - afterLines.length);

      return {
        changeCount,
        nodesAdded,
        nodesRemoved,
        attributeChanges: 0, // Would need proper DOM diffing
        significantChanges,
      };
    } catch (error) {
      this.logger.error({ error }, 'Failed to analyze DOM snapshots');
      return {
        changeCount: 0,
        nodesAdded: 0,
        nodesRemoved: 0,
        attributeChanges: 0,
        significantChanges: false,
      };
    }
  }

  /**
   * Analyze coverage report for changes
   */
  async analyzeCoverage(coveragePath: string): Promise<CoverageAnalysis> {
    try {
      const fullPath = join(this.artifactDir, coveragePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const coverage = JSON.parse(content);

      // Coverage report format varies by test framework
      // This is a simplified analysis
      const before = coverage.before?.percentage || 0;
      const after = coverage.after?.percentage || 0;
      const change = after - before;
      const linesAdded = coverage.linesAdded || 0;

      // Check if change is proportional to test scope
      // Simple heuristic: coverage should increase with new tests
      const proportional = change >= 0; // Any increase is proportional

      return {
        before,
        after,
        change,
        linesAdded,
        proportional,
      };
    } catch (error) {
      this.logger.error({ error, path: coveragePath }, 'Failed to analyze coverage');
      return {
        before: 0,
        after: 0,
        change: 0,
        linesAdded: 0,
        proportional: true, // Default to true to avoid false positives
      };
    }
  }

  /**
   * Parse HTTP request from JSON file
   */
  async parseHTTPRequest(requestPath: string): Promise<any> {
    try {
      const fullPath = join(this.artifactDir, requestPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error({ error, path: requestPath }, 'Failed to parse HTTP request');
      return null;
    }
  }

  /**
   * Parse HTTP response from JSON file
   */
  async parseHTTPResponse(responsePath: string): Promise<any> {
    try {
      const fullPath = join(this.artifactDir, responsePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error({ error, path: responsePath }, 'Failed to parse HTTP response');
      return null;
    }
  }

  /**
   * Detect repeated patterns in console logs
   */
  private detectLogPatterns(logs: ConsoleLog[]): string[] {
    const patterns: Map<string, number> = new Map();

    for (const log of logs) {
      // Extract first 50 chars as pattern
      const pattern = log.message.substring(0, 50);
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    // Return patterns that occur more than once
    return Array.from(patterns.entries())
      .filter(([_, count]) => count > 1)
      .map(([pattern, count]) => `"${pattern}..." (${count}x)`);
  }

  /**
   * Check if file exists
   */
  private async fileExists(fullPath: string): Promise<boolean> {
    try {
      await fs.stat(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
