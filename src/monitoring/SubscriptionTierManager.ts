/**
 * SubscriptionTierManager - Manages subscription tier tracking and changes
 */

import { pool } from '../db/client.js';
import { SubscriptionTier, TierDefinition } from '../types/monitoring.js';

export class SubscriptionTierManager {
  /**
   * Get current active tier for a service
   */
  async getCurrentTier(service: string): Promise<SubscriptionTier | null> {
    const result = await pool.query(
      `SELECT * FROM subscription_tiers
       WHERE service = $1 AND is_active = true
       ORDER BY started_at DESC
       LIMIT 1`,
      [service]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTier(result.rows[0]);
  }

  /**
   * Get all available tiers for a service
   */
  async getAvailableTiers(service: string): Promise<SubscriptionTier[]> {
    const result = await pool.query(
      `SELECT DISTINCT ON (tier)
        id, service, tier, monthly_cost, quota_limit, quota_period, features,
        false as is_active, NOW() as started_at, null as ended_at, NOW() as created_at
       FROM subscription_tiers
       WHERE service = $1
       ORDER BY tier, started_at DESC`,
      [service]
    );

    return result.rows.map(row => this.mapRowToTier(row));
  }

  /**
   * Update tier for a service (mark old as inactive, create new)
   */
  async updateTier(service: string, newTier: string): Promise<void> {
    await pool.query('BEGIN');

    try {
      // Mark current tier as inactive
      await pool.query(
        `UPDATE subscription_tiers
         SET is_active = false, ended_at = NOW(), updated_at = NOW()
         WHERE service = $1 AND is_active = true`,
        [service]
      );

      // Get tier definition
      const tierDef = await pool.query(
        `SELECT tier, monthly_cost, quota_limit, quota_period, features
         FROM subscription_tiers
         WHERE service = $1 AND tier = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [service, newTier]
      );

      if (tierDef.rows.length === 0) {
        throw new Error(`Tier ${newTier} not found for service ${service}`);
      }

      const { monthly_cost, quota_limit, quota_period, features } = tierDef.rows[0];

      // Create new active tier record
      await pool.query(
        `INSERT INTO subscription_tiers (
          service, tier, monthly_cost, quota_limit, quota_period, features, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [service, newTier, monthly_cost, quota_limit, quota_period, features]
      );

      await pool.query('COMMIT');

      console.log(`✅ Updated ${service} tier: ${newTier}`);
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error(`Failed to update tier for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Get tier change history for a service
   */
  async getTierHistory(service: string, limit: number = 10): Promise<SubscriptionTier[]> {
    const result = await pool.query(
      `SELECT * FROM subscription_tiers
       WHERE service = $1
       ORDER BY started_at DESC
       LIMIT $2`,
      [service, limit]
    );

    return result.rows.map(row => this.mapRowToTier(row));
  }

  /**
   * Add a new tier definition
   */
  async addTierDefinition(def: TierDefinition): Promise<number> {
    const result = await pool.query(
      `INSERT INTO subscription_tiers (
        service, tier, monthly_cost, quota_limit, quota_period, features, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id`,
      [
        def.service,
        def.tier,
        def.monthly_cost,
        def.quota_limit,
        def.quota_period,
        JSON.stringify(def.features),
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get tier by ID
   */
  async getTierById(id: number): Promise<SubscriptionTier | null> {
    const result = await pool.query(
      `SELECT * FROM subscription_tiers WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTier(result.rows[0]);
  }

  /**
   * Check if a tier exists for a service
   */
  async tierExists(service: string, tier: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1 FROM subscription_tiers
       WHERE service = $1 AND tier = $2
       LIMIT 1`,
      [service, tier]
    );

    return result.rows.length > 0;
  }

  /**
   * Get current subscription costs across all services
   */
  async getCurrentMonthlyCost(): Promise<number> {
    const result = await pool.query(
      `SELECT SUM(monthly_cost) as total_cost
       FROM subscription_tiers
       WHERE is_active = true`
    );

    return parseFloat(result.rows[0]?.total_cost || '0');
  }

  /**
   * Get all active subscriptions
   */
  async getActiveSubscriptions(): Promise<SubscriptionTier[]> {
    const result = await pool.query(
      `SELECT * FROM subscription_tiers
       WHERE is_active = true
       ORDER BY service`
    );

    return result.rows.map(row => this.mapRowToTier(row));
  }

  /**
   * Map database row to SubscriptionTier object
   */
  private mapRowToTier(row: any): SubscriptionTier {
    return {
      id: row.id,
      service: row.service,
      tier: row.tier,
      monthly_cost: parseFloat(row.monthly_cost),
      quota_limit: row.quota_limit ? parseInt(row.quota_limit) : null,
      quota_period: row.quota_period,
      features: row.features || {},
      is_active: row.is_active,
      started_at: new Date(row.started_at),
      ended_at: row.ended_at ? new Date(row.ended_at) : null,
      created_at: new Date(row.created_at),
    };
  }

  /**
   * Calculate potential savings if switching tiers
   */
  async calculateSavings(
    service: string,
    targetTier: string
  ): Promise<{ current_cost: number; target_cost: number; savings: number }> {
    const currentTier = await this.getCurrentTier(service);
    if (!currentTier) {
      throw new Error(`No active tier found for ${service}`);
    }

    const targetTierData = await pool.query(
      `SELECT monthly_cost FROM subscription_tiers
       WHERE service = $1 AND tier = $2
       ORDER BY created_at DESC LIMIT 1`,
      [service, targetTier]
    );

    if (targetTierData.rows.length === 0) {
      throw new Error(`Tier ${targetTier} not found for ${service}`);
    }

    const target_cost = parseFloat(targetTierData.rows[0].monthly_cost);
    const savings = currentTier.monthly_cost - target_cost;

    return {
      current_cost: currentTier.monthly_cost,
      target_cost,
      savings,
    };
  }
}
