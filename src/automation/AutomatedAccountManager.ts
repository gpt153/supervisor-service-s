/**
 * Automated Account Manager
 *
 * Self-healing quota management system.
 * Monitors API key quotas and automatically creates new keys when needed.
 */

import { pool } from '../db/client.js';
import { GeminiKeyManager } from '../agents/multi/GeminiKeyManager.js';
import { ClaudeKeyManager } from '../agents/multi/ClaudeKeyManager.js';
import { SubscriptionOptimizer } from '../monitoring/SubscriptionOptimizer.js';
import { SecretsManager } from '../secrets/SecretsManager.js';

export interface QuotaCheckResult {
  service: string;
  totalQuota: number;
  usedQuota: number;
  remainingQuota: number;
  usagePercentage: number;
  needsExpansion: boolean;
  activeKeys: number;
}

export interface AutomationEvent {
  id?: number;
  eventType: 'quota_check' | 'key_creation_triggered' | 'optimization_run' | 'notification_sent';
  service?: string;
  details: Record<string, any>;
  createdAt?: Date;
}

/**
 * Automated account manager
 */
export class AutomatedAccountManager {
  private geminiKeyManager: GeminiKeyManager;
  private claudeKeyManager: ClaudeKeyManager;
  private optimizer: SubscriptionOptimizer;
  private secretsManager: SecretsManager;

  // Thresholds
  private readonly QUOTA_WARNING_THRESHOLD = 0.8; // 80%
  private readonly QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%

  constructor() {
    this.geminiKeyManager = new GeminiKeyManager();
    this.claudeKeyManager = new ClaudeKeyManager();
    this.optimizer = new SubscriptionOptimizer();
    this.secretsManager = new SecretsManager();
  }

  /**
   * Check quota usage for a service
   */
  async checkQuotaUsage(service: 'gemini' | 'claude'): Promise<QuotaCheckResult> {
    const keyManager = service === 'gemini' ? this.geminiKeyManager : this.claudeKeyManager;
    const keys = await keyManager.getAvailableKeys();

    // Handle different quota types - Gemini has dailyQuota, Claude has monthlyQuota
    const totalQuota = keys.reduce((sum, k) => {
      const quota = 'monthlyQuota' in k ? k.monthlyQuota : 'dailyQuota' in k ? k.dailyQuota : 0;
      return sum + quota;
    }, 0);
    const usedQuota = keys.reduce((sum, k) => sum + k.currentUsage, 0);
    const remainingQuota = totalQuota - usedQuota;
    const usagePercentage = totalQuota > 0 ? (usedQuota / totalQuota) * 100 : 0;

    const needsExpansion = usagePercentage >= this.QUOTA_WARNING_THRESHOLD * 100;

    return {
      service,
      totalQuota,
      usedQuota,
      remainingQuota,
      usagePercentage,
      needsExpansion,
      activeKeys: keys.length,
    };
  }

  /**
   * Check all services for quota issues
   */
  async checkAllQuotas(): Promise<QuotaCheckResult[]> {
    const services: ('gemini' | 'claude')[] = ['gemini', 'claude'];
    const results: QuotaCheckResult[] = [];

    for (const service of services) {
      try {
        const result = await this.checkQuotaUsage(service);
        results.push(result);

        // Log quota check
        await this.logEvent({
          eventType: 'quota_check',
          service,
          details: result,
        });

        // If quota is critical, trigger notification
        if (result.usagePercentage >= this.QUOTA_CRITICAL_THRESHOLD * 100) {
          await this.sendNotification({
            level: 'critical',
            service,
            message: `${service} quota at ${result.usagePercentage.toFixed(1)}% - immediate action needed`,
            details: result,
          });
        } else if (result.needsExpansion) {
          await this.sendNotification({
            level: 'warning',
            service,
            message: `${service} quota at ${result.usagePercentage.toFixed(1)}% - consider adding keys`,
            details: result,
          });
        }
      } catch (error) {
        console.error(`Failed to check ${service} quota:`, error);
      }
    }

    return results;
  }

  /**
   * Run daily optimization check
   */
  async runDailyOptimization(): Promise<void> {
    try {
      const recommendations = await this.optimizer.analyzeAllServices(30);

      // Log optimization run
      await this.logEvent({
        eventType: 'optimization_run',
        details: {
          recommendations: recommendations.map(r => ({
            service: r.service,
            currentTier: r.current_tier,
            recommendedTier: r.recommended_tier,
            savings: r.potential_savings,
            confidence: r.confidence,
          })),
        },
      });

      // Send notification for significant savings
      const significantSavings = recommendations.filter(r => r.potential_savings > 50);
      if (significantSavings.length > 0) {
        const totalSavings = significantSavings.reduce((sum, r) => sum + r.potential_savings, 0);
        await this.sendNotification({
          level: 'info',
          service: 'optimization',
          message: `Found $${totalSavings.toFixed(2)}/month potential savings across ${significantSavings.length} services`,
          details: { recommendations: significantSavings },
        });
      }
    } catch (error) {
      console.error('Failed to run daily optimization:', error);
    }
  }

  /**
   * Get available credentials for automated key creation
   */
  async getAvailableCredentials(service: 'gemini' | 'claude'): Promise<Array<{
    accountName: string;
    email: string;
    password: string;
  }>> {
    const secrets = await this.secretsManager.list({ scope: 'meta' });
    const credentials: Array<{ accountName: string; email: string; password: string }> = [];

    for (const secret of secrets) {
      try {
        // Filter for credentials of the specified service
        if (!secret.keyPath.startsWith(`meta/${service}/credentials/`)) continue;

        const value = await this.secretsManager.get({ keyPath: secret.keyPath });
        if (!value) continue;

        const parsed = JSON.parse(value);
        const accountName = secret.keyPath.split('/').pop() || 'unknown';

        credentials.push({
          accountName,
          email: parsed.email,
          password: parsed.password,
        });
      } catch (error) {
        console.error(`Failed to load credentials from ${secret.keyPath}:`, error);
      }
    }

    return credentials;
  }

  /**
   * Trigger automated key creation
   *
   * NOTE: This returns a workflow that must be executed by the user/MCP client.
   * Actual browser automation cannot be triggered from backend code.
   */
  async triggerKeyCreation(service: 'gemini' | 'claude'): Promise<{
    success: boolean;
    message: string;
    workflow?: {
      service: string;
      accountsAvailable: number;
      nextSteps: string[];
    };
  }> {
    const credentials = await this.getAvailableCredentials(service);

    if (credentials.length === 0) {
      return {
        success: false,
        message: `No stored credentials found for ${service}. Cannot create keys automatically.`,
      };
    }

    // Log key creation trigger
    await this.logEvent({
      eventType: 'key_creation_triggered',
      service,
      details: {
        credentialsAvailable: credentials.length,
        triggerReason: 'quota_threshold_exceeded',
      },
    });

    return {
      success: true,
      message: `${credentials.length} ${service} accounts available for key creation`,
      workflow: {
        service,
        accountsAvailable: credentials.length,
        nextSteps: [
          `1. Call get-${service}-key-creation-flow with account credentials`,
          `2. Execute browser automation steps via Playwright MCP`,
          `3. Extract API key from final snapshot`,
          `4. Call add-${service}-key to store in rotation pool`,
        ],
      },
    };
  }

  /**
   * Log automation event
   */
  private async logEvent(event: AutomationEvent): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO automation_events (event_type, service, details, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [event.eventType, event.service || null, JSON.stringify(event.details)]
      );
    } catch (error) {
      console.error('Failed to log automation event:', error);
    }
  }

  /**
   * Send notification
   *
   * For now, just logs to database.
   * Future: Email, Slack, etc.
   */
  private async sendNotification(notification: {
    level: 'info' | 'warning' | 'critical';
    service: string;
    message: string;
    details: any;
  }): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO automation_notifications (level, service, message, details, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [notification.level, notification.service, notification.message, JSON.stringify(notification.details)]
      );

      // Log notification event
      await this.logEvent({
        eventType: 'notification_sent',
        service: notification.service,
        details: notification,
      });

      console.log(`[NOTIFICATION:${notification.level.toUpperCase()}] ${notification.message}`);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Get recent automation events
   */
  async getRecentEvents(limit: number = 20): Promise<AutomationEvent[]> {
    const result = await pool.query(
      `SELECT
        id,
        event_type as "eventType",
        service,
        details,
        created_at as "createdAt"
       FROM automation_events
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      createdAt: new Date(row.createdAt),
    }));
  }

  /**
   * Get recent notifications
   */
  async getRecentNotifications(limit: number = 20): Promise<any[]> {
    const result = await pool.query(
      `SELECT
        id,
        level,
        service,
        message,
        details,
        created_at as "createdAt"
       FROM automation_notifications
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      createdAt: new Date(row.createdAt),
    }));
  }
}
