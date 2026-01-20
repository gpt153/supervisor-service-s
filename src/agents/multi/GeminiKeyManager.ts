/**
 * Gemini API Key Manager
 *
 * Manages multiple Gemini API keys with automatic rotation
 * when quota is exhausted.
 */

import { pool } from '../../db/client.js';
import { SecretsManager } from '../../secrets/SecretsManager.js';

export interface GeminiKeyInfo {
  id: number;
  keyName: string;
  apiKey: string;
  accountEmail?: string;
  dailyQuota: number;
  currentUsage: number;
  remaining: number;
  quotaResetsAt: Date;
  isActive: boolean;
  priority: number;
  lastUsedAt?: Date;
}

export interface AddKeyParams {
  keyName: string;
  apiKey: string;
  accountEmail?: string;
  dailyQuota?: number;
  priority?: number;
  notes?: string;
}

/**
 * Manages Gemini API keys with automatic rotation
 */
export class GeminiKeyManager {
  /**
   * Get next available API key for use
   * Returns key with highest priority and most remaining quota
   */
  async getNextAvailableKey(): Promise<GeminiKeyInfo | null> {
    // Reset quotas if needed
    await this.resetQuotas();

    const result = await pool.query(`
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        daily_quota as "dailyQuota",
        current_usage as "currentUsage",
        (daily_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM gemini_api_keys
      WHERE
        is_active = true
        AND current_usage < daily_quota
      ORDER BY
        priority ASC,
        current_usage ASC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const key = result.rows[0];
    return {
      ...key,
      quotaResetsAt: new Date(key.quotaResetsAt),
      lastUsedAt: key.lastUsedAt ? new Date(key.lastUsedAt) : undefined,
    };
  }

  /**
   * Record usage for a key
   */
  async recordUsage(
    keyId: number,
    tokensUsed: number,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await pool.query('BEGIN');

    try {
      // Update key usage
      await pool.query(
        `
        UPDATE gemini_api_keys
        SET
          current_usage = current_usage + $1,
          last_used_at = NOW()
        WHERE id = $2
      `,
        [tokensUsed, keyId]
      );

      // Log usage
      await pool.query(
        `
        INSERT INTO gemini_key_usage_log (
          key_id,
          tokens_used,
          request_success,
          error_message
        ) VALUES ($1, $2, $3, $4)
      `,
        [keyId, tokensUsed, success, errorMessage || null]
      );

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Add a new API key
   */
  async addKey(params: AddKeyParams): Promise<number> {
    const result = await pool.query(
      `
      INSERT INTO gemini_api_keys (
        key_name,
        api_key,
        account_email,
        daily_quota,
        priority,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [
        params.keyName,
        params.apiKey,
        params.accountEmail || null,
        params.dailyQuota || 1000000,
        params.priority || 0,
        params.notes || null,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Remove an API key
   */
  async removeKey(keyId: number): Promise<void> {
    await pool.query(
      `
      DELETE FROM gemini_api_keys
      WHERE id = $1
    `,
      [keyId]
    );
  }

  /**
   * Disable a key (soft delete)
   */
  async disableKey(keyId: number): Promise<void> {
    await pool.query(
      `
      UPDATE gemini_api_keys
      SET is_active = false
      WHERE id = $1
    `,
      [keyId]
    );
  }

  /**
   * Enable a key
   */
  async enableKey(keyId: number): Promise<void> {
    await pool.query(
      `
      UPDATE gemini_api_keys
      SET is_active = true
      WHERE id = $1
    `,
      [keyId]
    );
  }

  /**
   * Get all keys
   */
  async getAllKeys(): Promise<GeminiKeyInfo[]> {
    const result = await pool.query(`
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        daily_quota as "dailyQuota",
        current_usage as "currentUsage",
        (daily_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM gemini_api_keys
      ORDER BY priority ASC, key_name ASC
    `);

    return result.rows.map((row) => ({
      ...row,
      quotaResetsAt: new Date(row.quotaResetsAt),
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined,
    }));
  }

  /**
   * Get available keys (with remaining quota)
   */
  async getAvailableKeys(): Promise<GeminiKeyInfo[]> {
    await this.resetQuotas();

    const result = await pool.query(`
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        daily_quota as "dailyQuota",
        current_usage as "currentUsage",
        (daily_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM gemini_api_keys
      WHERE
        is_active = true
        AND current_usage < daily_quota
      ORDER BY priority ASC, current_usage ASC
    `);

    return result.rows.map((row) => ({
      ...row,
      quotaResetsAt: new Date(row.quotaResetsAt),
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined,
    }));
  }

  /**
   * Reset quotas for keys that have passed reset time
   */
  async resetQuotas(): Promise<number> {
    const result = await pool.query(`
      UPDATE gemini_api_keys
      SET
        current_usage = 0,
        quota_resets_at = NOW() + INTERVAL '24 hours'
      WHERE
        is_active = true
        AND quota_resets_at < NOW()
      RETURNING id
    `);

    return result.rows.length;
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(since?: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    successRate: number;
    keyStats: Record<string, { requests: number; tokens: number; successRate: number }>;
  }> {
    const sinceClause = since ? 'WHERE created_at >= $1' : '';
    const params = since ? [since] : [];

    const result = await pool.query(
      `
      SELECT
        k.key_name,
        COUNT(*) as requests,
        SUM(l.tokens_used) as tokens,
        SUM(CASE WHEN l.request_success THEN 1 ELSE 0 END) as successes
      FROM gemini_key_usage_log l
      JOIN gemini_api_keys k ON l.key_id = k.id
      ${sinceClause}
      GROUP BY k.key_name
    `,
      params
    );

    const keyStats: Record<string, { requests: number; tokens: number; successRate: number }> = {};
    let totalRequests = 0;
    let totalTokens = 0;
    let totalSuccesses = 0;

    for (const row of result.rows) {
      const requests = parseInt(row.requests);
      const tokens = parseInt(row.tokens) || 0;
      const successes = parseInt(row.successes);

      keyStats[row.key_name] = {
        requests,
        tokens,
        successRate: requests > 0 ? (successes / requests) * 100 : 0,
      };

      totalRequests += requests;
      totalTokens += tokens;
      totalSuccesses += successes;
    }

    return {
      totalRequests,
      totalTokens,
      successRate: totalRequests > 0 ? (totalSuccesses / totalRequests) * 100 : 0,
      keyStats,
    };
  }

  /**
   * Load keys from environment variables
   * Looks for GEMINI_KEY_1, GEMINI_KEY_2, etc.
   */
  async loadKeysFromEnv(): Promise<number> {
    let loadedCount = 0;

    // Check for numbered keys
    for (let i = 1; i <= 10; i++) {
      const key = process.env[`GEMINI_KEY_${i}`];
      if (key) {
        try {
          // Check if key already exists
          const existing = await pool.query(
            'SELECT id FROM gemini_api_keys WHERE api_key = $1',
            [key]
          );

          if (existing.rows.length === 0) {
            await this.addKey({
              keyName: `env_key_${i}`,
              apiKey: key,
              priority: i - 1, // Lower number = higher priority
            });
            loadedCount++;
          }
        } catch (error) {
          console.error(`Failed to load GEMINI_KEY_${i}:`, error);
        }
      }
    }

    // Also check for GOOGLE_API_KEY and GEMINI_API_KEY
    const fallbackKeys = [
      { env: 'GOOGLE_API_KEY', name: 'google_api_key' },
      { env: 'GEMINI_API_KEY', name: 'gemini_api_key' },
    ];

    for (const { env, name } of fallbackKeys) {
      const key = process.env[env];
      if (key) {
        try {
          const existing = await pool.query(
            'SELECT id FROM gemini_api_keys WHERE api_key = $1',
            [key]
          );

          if (existing.rows.length === 0) {
            await this.addKey({
              keyName: name,
              apiKey: key,
              priority: 100, // Lower priority than numbered keys
            });
            loadedCount++;
          }
        } catch (error) {
          console.error(`Failed to load ${env}:`, error);
        }
      }
    }

    return loadedCount;
  }

  /**
   * Load keys from secrets manager
   * Looks for keys stored under meta/gemini/*
   */
  async loadKeysFromSecrets(): Promise<number> {
    const secretsManager = new SecretsManager();
    let loadedCount = 0;

    try {
      // List all gemini secrets
      const secrets = await secretsManager.list({ scope: 'meta' });
      const geminiSecrets = secrets.filter(s => s.keyPath.startsWith('meta/gemini/'));

      for (const secret of geminiSecrets) {
        const keyName = secret.keyPath.split('/').pop()!;

        try {
          // Get the actual API key from secrets
          const apiKey = await secretsManager.get({ keyPath: secret.keyPath });
          if (!apiKey) continue;

          // Check if key already exists in database
          const existing = await pool.query(
            'SELECT id FROM gemini_api_keys WHERE api_key = $1',
            [apiKey]
          );

          if (existing.rows.length === 0) {
            await this.addKey({
              keyName,
              apiKey,
              priority: 0, // Default priority
              notes: secret.description || undefined,
            });
            loadedCount++;
          }
        } catch (error) {
          console.error(`Failed to load key ${keyName} from secrets:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to list secrets:', error);
    }

    return loadedCount;
  }
}
