/**
 * Claude API Key Manager
 *
 * Manages multiple Claude API keys with automatic rotation
 * when quota is exhausted (mirrors GeminiKeyManager structure).
 */

import { pool } from '../../db/client.js';
import { SecretsManager } from '../../secrets/SecretsManager.js';

export interface ClaudeKeyInfo {
  id: number;
  keyName: string;
  apiKey: string;
  accountEmail?: string;
  monthlyQuota: number;
  currentUsage: number;
  remaining: number;
  quotaResetsAt: Date;
  isActive: boolean;
  priority: number;
  lastUsedAt?: Date;
}

export interface AddClaudeKeyParams {
  keyName: string;
  apiKey: string;
  accountEmail?: string;
  monthlyQuota?: number; // Default: 50K for free tier
  priority?: number;
  notes?: string;
}

/**
 * Manages Claude API keys with automatic rotation
 */
export class ClaudeKeyManager {
  /**
   * Get next available API key for use
   * Returns key with highest priority and most remaining quota
   */
  async getNextAvailableKey(): Promise<ClaudeKeyInfo | null> {
    // Reset quotas if needed
    await this.resetQuotas();

    const result = await pool.query(`
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        monthly_quota as "monthlyQuota",
        current_usage as "currentUsage",
        (monthly_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM claude_api_keys
      WHERE
        is_active = true
        AND current_usage < monthly_quota
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
        UPDATE claude_api_keys
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
        INSERT INTO claude_key_usage_log (
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
  async addKey(params: AddClaudeKeyParams): Promise<number> {
    const result = await pool.query(
      `
      INSERT INTO claude_api_keys (
        key_name,
        api_key,
        account_email,
        monthly_quota,
        priority,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
      [
        params.keyName,
        params.apiKey,
        params.accountEmail || null,
        params.monthlyQuota || 50000, // Free tier default: 50K tokens/month
        params.priority || 0,
        params.notes || null,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Remove a key by ID
   */
  async removeKey(keyId: number): Promise<void> {
    await pool.query(
      `DELETE FROM claude_api_keys WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * Disable a key (soft delete)
   */
  async disableKey(keyId: number): Promise<void> {
    await pool.query(
      `UPDATE claude_api_keys SET is_active = false WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * Enable a key
   */
  async enableKey(keyId: number): Promise<void> {
    await pool.query(
      `UPDATE claude_api_keys SET is_active = true WHERE id = $1`,
      [keyId]
    );
  }

  /**
   * Get all keys (active and inactive)
   */
  async getAllKeys(): Promise<ClaudeKeyInfo[]> {
    const result = await pool.query(`
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        monthly_quota as "monthlyQuota",
        current_usage as "currentUsage",
        (monthly_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM claude_api_keys
      ORDER BY priority ASC, id ASC
    `);

    return result.rows.map(row => ({
      ...row,
      quotaResetsAt: new Date(row.quotaResetsAt),
      lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt) : undefined,
    }));
  }

  /**
   * Get only available keys (active with remaining quota)
   */
  async getAvailableKeys(): Promise<ClaudeKeyInfo[]> {
    const result = await pool.query(`
      SELECT * FROM claude_available_keys
    `);

    return result.rows.map(row => ({
      id: row.id,
      keyName: row.key_name,
      apiKey: row.api_key,
      accountEmail: row.account_email,
      monthlyQuota: row.monthly_quota,
      currentUsage: row.current_usage,
      remaining: row.remaining,
      quotaResetsAt: new Date(row.quota_resets_at),
      isActive: true, // View only returns active keys
      priority: row.priority,
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
    }));
  }

  /**
   * Reset quotas for keys that have passed their reset time
   */
  async resetQuotas(): Promise<number> {
    const result = await pool.query(`
      UPDATE claude_api_keys
      SET
        current_usage = 0,
        quota_resets_at = NOW() + INTERVAL '30 days'
      WHERE
        is_active = true
        AND quota_resets_at < NOW()
      RETURNING id
    `);

    return result.rowCount || 0;
  }

  /**
   * Get usage stats for a time period
   */
  async getUsageStats(since?: Date): Promise<{
    totalRequests: number;
    totalTokens: number;
    successRate: number;
  }> {
    const params: any[] = [];
    let query = `
      SELECT
        COUNT(*) as total_requests,
        COALESCE(SUM(tokens_used), 0) as total_tokens,
        ROUND(
          (COUNT(*) FILTER (WHERE request_success = true)::numeric /
           NULLIF(COUNT(*), 0)) * 100,
          2
        ) as success_rate
      FROM claude_key_usage_log
    `;

    if (since) {
      params.push(since);
      query += ` WHERE created_at >= $1`;
    }

    const result = await pool.query(query, params);
    const row = result.rows[0];

    return {
      totalRequests: parseInt(row.total_requests),
      totalTokens: parseInt(row.total_tokens),
      successRate: parseFloat(row.success_rate) || 0,
    };
  }

  /**
   * Load keys from environment variables
   * Looks for CLAUDE_KEY_1, CLAUDE_KEY_2, etc.
   */
  async loadKeysFromEnv(): Promise<number> {
    let count = 0;
    let index = 1;

    while (process.env[`CLAUDE_KEY_${index}`]) {
      const apiKey = process.env[`CLAUDE_KEY_${index}`];
      if (!apiKey) break;

      try {
        // Check if key already exists
        const existing = await pool.query(
          `SELECT id FROM claude_api_keys WHERE api_key = $1`,
          [apiKey]
        );

        if (existing.rows.length === 0) {
          await this.addKey({
            keyName: `env_key_${index}`,
            apiKey,
            priority: index - 1, // First key gets priority 0
          });
          count++;
        }
      } catch (error) {
        console.error(`Failed to load CLAUDE_KEY_${index}:`, error);
      }

      index++;
    }

    return count;
  }

  /**
   * Load keys from secrets manager
   * Looks for secrets in meta/claude/* path
   */
  async loadKeysFromSecrets(): Promise<number> {
    const secretsManager = new SecretsManager();
    let count = 0;

    try {
      // List all secrets in meta/claude path
      const secrets = await secretsManager.list({ scope: 'meta' });

      for (const secret of secrets) {
        try {
          // Only process claude secrets
          if (!secret.keyPath.startsWith('meta/claude/')) continue;

          const value = await secretsManager.get({ keyPath: secret.keyPath });
          if (!value) continue;

          // Check if key already exists
          const existing = await pool.query(
            `SELECT id FROM claude_api_keys WHERE api_key = $1`,
            [value]
          );

          if (existing.rows.length === 0) {
            const keyName = secret.keyPath.split('/').pop() || `secret_key_${count}`;
            await this.addKey({
              keyName,
              apiKey: value,
              priority: count,
            });
            count++;
          }
        } catch (error) {
          console.error(`Failed to load secret ${secret.keyPath}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to load keys from secrets:', error);
    }

    return count;
  }

  /**
   * Get key by ID
   */
  async getKeyById(id: number): Promise<ClaudeKeyInfo | null> {
    const result = await pool.query(
      `
      SELECT
        id,
        key_name as "keyName",
        api_key as "apiKey",
        account_email as "accountEmail",
        monthly_quota as "monthlyQuota",
        current_usage as "currentUsage",
        (monthly_quota - current_usage) as remaining,
        quota_resets_at as "quotaResetsAt",
        is_active as "isActive",
        priority,
        last_used_at as "lastUsedAt"
      FROM claude_api_keys
      WHERE id = $1
    `,
      [id]
    );

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
   * Update key priority
   */
  async updatePriority(keyId: number, priority: number): Promise<void> {
    await pool.query(
      `UPDATE claude_api_keys SET priority = $1 WHERE id = $2`,
      [priority, keyId]
    );
  }
}
