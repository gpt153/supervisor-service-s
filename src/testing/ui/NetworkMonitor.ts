/**
 * Network Monitor
 * Captures network requests/responses, detects failures
 * Proves data was loaded/sent correctly (Level 5: what did the app actually do?)
 */

import { Logger } from 'pino';
import { Page } from 'playwright';
import { NetworkActivity } from '../../types/ui-testing.js';

export class NetworkMonitor {
  private logger: Logger;
  private requests: NetworkActivity[] = [];
  private failedRequests: NetworkActivity[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Start monitoring network
   */
  attachToPage(page: Page): void {
    try {
      page.on('requestfinished', async (request: any) => {
        try {
          const response = request.response();

          if (response) {
            const resourceType = request.resourceType();
            const statusCode = (response as any).status?.();
            const statusText = (response as any).statusText?.();

            const activity: NetworkActivity = {
              method: request.method(),
              url: request.url(),
              statusCode: statusCode || 200,
              statusText: statusText || 'OK',
              resourceType,
              timestamp: new Date(),
              failed: (statusCode || 200) >= 400,
            };

            // Try to capture timing
            const timing = (response as any).timing?.();
            if (timing) {
              activity.responseTime =
                timing.responseEnd - timing.responseStart;
            }

            this.requests.push(activity);

            // Track failed requests
            if (activity.failed) {
              this.failedRequests.push(activity);
            }

            this.logger.debug(
              {
                method: activity.method,
                url: activity.url.substring(0, 100),
                status: statusCode,
              },
              'Network request captured'
            );
          }
        } catch (err) {
          this.logger.warn(
            { error: String(err) },
            'Failed to capture request details'
          );
        }
      });

      page.on('requestfailed', (request) => {
        const activity: NetworkActivity = {
          method: request.method(),
          url: request.url(),
          statusCode: 0,
          statusText: 'Failed',
          resourceType: request.resourceType(),
          timestamp: new Date(),
          failed: true,
        };

        this.requests.push(activity);
        this.failedRequests.push(activity);

        this.logger.debug(
          {
            method: activity.method,
            url: activity.url.substring(0, 100),
          },
          'Network request failed'
        );
      });

      this.logger.debug('Network monitor attached to page');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Failed to attach network monitor'
      );
    }
  }

  /**
   * Get all requests
   */
  getRequests(): NetworkActivity[] {
    return [...this.requests];
  }

  /**
   * Get failed requests
   */
  getFailedRequests(): NetworkActivity[] {
    return [...this.failedRequests];
  }

  /**
   * Get requests by method
   */
  getRequestsByMethod(method: string): NetworkActivity[] {
    return this.requests.filter((req) => req.method === method);
  }

  /**
   * Get requests by URL pattern
   */
  getRequestsByUrl(pattern: string | RegExp): NetworkActivity[] {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.requests.filter((req) => regex.test(req.url));
  }

  /**
   * Get requests by resource type
   */
  getRequestsByResourceType(
    type: 'xhr' | 'fetch' | 'document' | 'image' | 'stylesheet'
  ): NetworkActivity[] {
    return this.requests.filter((req) => req.resourceType === type);
  }

  /**
   * Get requests with specific status code
   */
  getRequestsByStatus(statusCode: number): NetworkActivity[] {
    return this.requests.filter((req) => req.statusCode === statusCode);
  }

  /**
   * Check if specific endpoint was called
   */
  hasRequestToEndpoint(pattern: string | RegExp): boolean {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.requests.some((req) => regex.test(req.url));
  }

  /**
   * Get request count
   */
  getRequestCount(): number {
    return this.requests.length;
  }

  /**
   * Get failed request count
   */
  getFailedRequestCount(): number {
    return this.failedRequests.length;
  }

  /**
   * Get summary
   */
  getSummary(): {
    totalRequests: number;
    successful: number;
    failed: number;
    byResourceType: Record<string, number>;
    byMethod: Record<string, number>;
  } {
    const successful = this.requests.length - this.failedRequests.length;

    const byResourceType: Record<string, number> = {};
    const byMethod: Record<string, number> = {};

    this.requests.forEach((req) => {
      if (req.resourceType) {
        byResourceType[req.resourceType] =
          (byResourceType[req.resourceType] || 0) + 1;
      }
      byMethod[req.method] = (byMethod[req.method] || 0) + 1;
    });

    return {
      totalRequests: this.requests.length,
      successful,
      failed: this.failedRequests.length,
      byResourceType,
      byMethod,
    };
  }

  /**
   * Clear requests
   */
  clear(): void {
    this.requests = [];
    this.failedRequests = [];
    this.logger.debug('Network requests cleared');
  }

  /**
   * Get detailed report
   */
  getReport(): string {
    const summary = this.getSummary();

    let report = `\n=== NETWORK MONITORING REPORT ===\n`;
    report += `Total Requests: ${summary.totalRequests}\n`;
    report += `Successful: ${summary.successful}\n`;
    report += `Failed: ${summary.failed}\n\n`;

    if (Object.keys(summary.byMethod).length > 0) {
      report += `--- BY METHOD ---\n`;
      Object.entries(summary.byMethod).forEach(([method, count]) => {
        report += `${method}: ${count}\n`;
      });
      report += '\n';
    }

    if (Object.keys(summary.byResourceType).length > 0) {
      report += `--- BY RESOURCE TYPE ---\n`;
      Object.entries(summary.byResourceType).forEach(([type, count]) => {
        report += `${type}: ${count}\n`;
      });
      report += '\n';
    }

    if (this.failedRequests.length > 0) {
      report += `--- FAILED REQUESTS ---\n`;
      this.failedRequests.forEach((req, idx) => {
        report += `${idx + 1}. ${req.method} ${req.url.substring(0, 80)}\n`;
        report += `   Status: ${req.statusCode} ${req.statusText}\n`;
      });
      report += '\n';
    }

    return report;
  }

  /**
   * Find requests by pattern
   */
  findRequests(pattern: string | RegExp): NetworkActivity[] {
    const regex =
      typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    return this.requests.filter((req) => regex.test(req.url));
  }

  /**
   * Assert no failed requests
   */
  assertNoFailedRequests(): { passed: boolean; message: string } {
    if (this.failedRequests.length === 0) {
      return {
        passed: true,
        message: 'No failed network requests',
      };
    }

    const failedUrls = this.failedRequests
      .map((req) => `${req.method} ${req.url} (${req.statusCode})`)
      .join('; ');

    return {
      passed: false,
      message: `Found ${this.failedRequests.length} failed requests: ${failedUrls}`,
    };
  }

  /**
   * Assert request to endpoint exists
   */
  assertRequestExists(
    pattern: string | RegExp,
    method?: string
  ): { passed: boolean; message: string } {
    let requests = this.findRequests(pattern);

    if (method) {
      requests = requests.filter((req) => req.method === method);
    }

    if (requests.length > 0) {
      return {
        passed: true,
        message: `Found ${requests.length} request(s) matching pattern`,
      };
    }

    return {
      passed: false,
      message: `No requests found matching pattern: ${pattern}`,
    };
  }

  /**
   * Get slowest requests (for performance analysis)
   */
  getSlowestRequests(count: number = 5): NetworkActivity[] {
    return [...this.requests]
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
      .slice(0, count);
  }

  /**
   * Get average response time
   */
  getAverageResponseTime(): number {
    if (this.requests.length === 0) return 0;

    const total = this.requests.reduce((sum, req) => sum + (req.responseTime || 0), 0);
    return Math.round(total / this.requests.length);
  }
}
