/**
 * Console Monitor
 * Captures console logs, errors, warnings at runtime
 * Auto-fails tests on unexpected console errors (Level 5: what did the app actually say?)
 */

import { Logger } from 'pino';
import { Page } from 'playwright';
import { ConsoleLog } from '../../types/ui-testing.js';

export class ConsoleMonitor {
  private logger: Logger;
  private logs: ConsoleLog[] = [];
  private expectedErrors: Set<string> = new Set();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Start monitoring console
   */
  attachToPage(page: Page): void {
    try {
      // Listen to console messages
      page.on('console', (msg) => {
        const log: ConsoleLog = {
          level: msg.type() as any,
          message: msg.text(),
          timestamp: new Date(),
        };

        this.logs.push(log);

        this.logger.debug(
          { level: log.level, message: log.message.substring(0, 100) },
          'Console message captured'
        );
      });

      // Listen to page errors
      page.on('pageerror', (error) => {
        const log: ConsoleLog = {
          level: 'error',
          message: error.message,
          stackTrace: error.stack,
          timestamp: new Date(),
        };

        this.logs.push(log);

        this.logger.debug(
          { message: error.message.substring(0, 100) },
          'Page error captured'
        );
      });

      this.logger.debug('Console monitor attached to page');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to attach console monitor'
      );
    }
  }

  /**
   * Mark error as expected (won't fail test)
   */
  expectError(errorPattern: string): void {
    this.expectedErrors.add(errorPattern);
    this.logger.debug({ pattern: errorPattern }, 'Added expected error');
  }

  /**
   * Get all logs
   */
  getLogs(): ConsoleLog[] {
    return [...this.logs];
  }

  /**
   * Get errors
   */
  getErrors(): ConsoleLog[] {
    return this.logs.filter((log) => log.level === 'error');
  }

  /**
   * Get warnings
   */
  getWarnings(): ConsoleLog[] {
    return this.logs.filter((log) => log.level === 'warning');
  }

  /**
   * Get unexpected errors (not in expected list)
   */
  getUnexpectedErrors(): ConsoleLog[] {
    return this.getErrors().filter((error) => {
      return !Array.from(this.expectedErrors).some((pattern) =>
        error.message.includes(pattern)
      );
    });
  }

  /**
   * Check for critical errors that fail test
   */
  hasCriticalErrors(): boolean {
    const unexpected = this.getUnexpectedErrors();
    return unexpected.length > 0;
  }

  /**
   * Get summary
   */
  getSummary(): {
    totalLogs: number;
    errors: number;
    warnings: number;
    unexpectedErrors: number;
    critical: boolean;
  } {
    const errors = this.getErrors();
    const warnings = this.getWarnings();
    const unexpectedErrors = this.getUnexpectedErrors();

    return {
      totalLogs: this.logs.length,
      errors: errors.length,
      warnings: warnings.length,
      unexpectedErrors: unexpectedErrors.length,
      critical: unexpectedErrors.length > 0,
    };
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
    this.logger.debug('Console logs cleared');
  }

  /**
   * Get detailed report
   */
  getReport(): string {
    const summary = this.getSummary();

    let report = `\n=== CONSOLE MONITORING REPORT ===\n`;
    report += `Total Logs: ${summary.totalLogs}\n`;
    report += `Errors: ${summary.errors}\n`;
    report += `Warnings: ${summary.warnings}\n`;
    report += `Unexpected Errors: ${summary.unexpectedErrors}\n`;
    report += `Critical: ${summary.critical ? 'YES' : 'NO'}\n\n`;

    if (summary.errors > 0) {
      report += `--- ERRORS ---\n`;
      this.getErrors().forEach((error, idx) => {
        report += `${idx + 1}. ${error.message}\n`;
        if (error.stackTrace) {
          report += `   Stack: ${error.stackTrace.substring(0, 200)}...\n`;
        }
      });
      report += '\n';
    }

    if (summary.warnings > 0) {
      report += `--- WARNINGS ---\n`;
      this.getWarnings().forEach((warning, idx) => {
        report += `${idx + 1}. ${warning.message}\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * Find logs by pattern
   */
  findLogs(pattern: string | RegExp): ConsoleLog[] {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.logs.filter((log) => regex.test(log.message));
  }

  /**
   * Assert no errors (test assertion)
   */
  assertNoErrors(): { passed: boolean; message: string } {
    const unexpected = this.getUnexpectedErrors();

    if (unexpected.length === 0) {
      return {
        passed: true,
        message: 'No unexpected console errors',
      };
    }

    const errorMessages = unexpected.map((e) => e.message).join('; ');
    return {
      passed: false,
      message: `Found ${unexpected.length} unexpected console errors: ${errorMessages}`,
    };
  }

  /**
   * Assert specific log exists
   */
  assertLogExists(
    pattern: string | RegExp,
    level?: 'log' | 'error' | 'warning' | 'info' | 'debug'
  ): { passed: boolean; message: string } {
    let logs = this.findLogs(pattern);

    if (level) {
      logs = logs.filter((log) => log.level === level);
    }

    if (logs.length > 0) {
      return {
        passed: true,
        message: `Found ${logs.length} matching log(s)`,
      };
    }

    return {
      passed: false,
      message: `No logs found matching pattern: ${pattern}`,
    };
  }
}
