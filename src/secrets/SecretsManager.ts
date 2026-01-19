/**
 * Secrets Manager
 *
 * Handles encrypted storage and retrieval of secrets using AES-256-GCM.
 * Implements hierarchical key paths (meta/project/service).
 *
 * Based on: /home/samuel/sv/.bmad/infrastructure/secrets-management-system.md
 */

import * as crypto from 'crypto';
import { pool } from '../db/client.js';
import type {
  Secret,
  SecretScope,
  SetSecretParams,
  GetSecretParams,
  ListSecretsParams,
  DeleteSecretParams,
} from '../types/database.js';

/**
 * Parsed key path components
 */
interface KeyPathComponents {
  scope: SecretScope;
  projectName: string | null;
  serviceName: string | null;
}

/**
 * Secret list item (without decrypted value)
 */
export interface SecretListItem {
  keyPath: string;
  description: string | null;
  scope: SecretScope;
  lastAccessed: Date | null;
  accessCount: number;
  expiresAt: Date | null;
}

/**
 * SecretsManager class
 *
 * Provides encrypted storage and retrieval of secrets with:
 * - AES-256-GCM encryption
 * - Hierarchical key paths (meta/project/service)
 * - Access tracking and audit trail
 * - Secret expiration
 */
export class SecretsManager {
  private encryptionKey: Buffer;

  /**
   * Create a new SecretsManager instance
   *
   * @throws Error if SECRETS_ENCRYPTION_KEY is not set
   */
  constructor() {
    const key = process.env.SECRETS_ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        'SECRETS_ENCRYPTION_KEY environment variable not set. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Validate key is 64 hex characters (32 bytes)
    if (!/^[0-9a-f]{64}$/i.test(key)) {
      throw new Error(
        'SECRETS_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    this.encryptionKey = Buffer.from(key, 'hex');
  }

  /**
   * Store a secret (create or update)
   *
   * @param params - Secret parameters
   * @throws Error if key path is invalid or encryption fails
   */
  async set(params: SetSecretParams): Promise<void> {
    const { keyPath, value, description, expiresAt } = params;

    // Parse and validate key path
    const { scope, projectName, serviceName } = this.parseKeyPath(keyPath);

    // Encrypt value
    const encryptedValue = this.encrypt(value);

    // Log access (create operation)
    await this.logAccess(keyPath, 'create', true, null);

    // Insert or update secret
    const query = `
      INSERT INTO secrets (
        key_path, encrypted_value, description,
        scope, project_name, service_name, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (key_path)
      DO UPDATE SET
        encrypted_value = $2,
        description = $3,
        updated_at = NOW(),
        expires_at = $7
    `;

    await pool.query(query, [
      keyPath,
      encryptedValue,
      description || null,
      scope,
      projectName,
      serviceName,
      expiresAt || null,
    ]);
  }

  /**
   * Get a secret value
   *
   * @param params - Get secret parameters
   * @returns Decrypted secret value, or null if not found
   * @throws Error if secret has expired or decryption fails
   */
  async get(params: GetSecretParams): Promise<string | null> {
    const { keyPath } = params;

    // Update access tracking and retrieve secret
    const query = `
      UPDATE secrets
      SET
        last_accessed_at = NOW(),
        access_count = access_count + 1
      WHERE key_path = $1
      RETURNING encrypted_value, expires_at
    `;

    const result = await pool.query<Pick<Secret, 'encrypted_value' | 'expires_at'>>(
      query,
      [keyPath]
    );

    if (result.rows.length === 0) {
      // Log failed access
      await this.logAccess(keyPath, 'read', false, 'Secret not found');
      return null;
    }

    const { encrypted_value, expires_at } = result.rows[0];

    // Check expiration
    if (expires_at && new Date(expires_at) < new Date()) {
      await this.logAccess(keyPath, 'read', false, 'Secret expired');
      throw new Error(`Secret "${keyPath}" has expired`);
    }

    // Decrypt and return
    try {
      const decryptedValue = this.decrypt(encrypted_value);
      await this.logAccess(keyPath, 'read', true, null);
      return decryptedValue;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Decryption failed';
      await this.logAccess(keyPath, 'read', false, errorMsg);
      throw error;
    }
  }

  /**
   * List secrets (without values, for discovery)
   *
   * @param params - Filter parameters
   * @returns Array of secret metadata
   */
  async list(params?: ListSecretsParams): Promise<SecretListItem[]> {
    let query = `
      SELECT
        key_path,
        description,
        scope,
        last_accessed_at,
        access_count,
        expires_at
      FROM secrets
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (params?.scope) {
      query += ` AND scope = $${paramIndex++}`;
      queryParams.push(params.scope);
    }

    if (params?.project) {
      query += ` AND project_name = $${paramIndex++}`;
      queryParams.push(params.project);
    }

    if (params?.service) {
      query += ` AND service_name = $${paramIndex++}`;
      queryParams.push(params.service);
    }

    query += ' ORDER BY key_path';

    const result = await pool.query(query, queryParams);

    return result.rows.map(row => ({
      keyPath: row.key_path,
      description: row.description,
      scope: row.scope,
      lastAccessed: row.last_accessed_at,
      accessCount: row.access_count,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Delete a secret
   *
   * @param params - Delete parameters
   * @returns True if deleted, false if not found
   */
  async delete(params: DeleteSecretParams): Promise<boolean> {
    const { keyPath } = params;

    const query = 'DELETE FROM secrets WHERE key_path = $1';
    const result = await pool.query(query, [keyPath]);

    const deleted = (result.rowCount || 0) > 0;
    await this.logAccess(keyPath, 'delete', deleted, deleted ? null : 'Secret not found');

    return deleted;
  }

  /**
   * Get secrets near expiration
   *
   * @param daysAhead - Number of days to look ahead (default: 30)
   * @returns Array of expiring secrets
   */
  async getExpiringSoon(daysAhead: number = 30): Promise<SecretListItem[]> {
    const query = `
      SELECT
        key_path,
        description,
        scope,
        last_accessed_at,
        access_count,
        expires_at
      FROM secrets
      WHERE expires_at IS NOT NULL
        AND expires_at > NOW()
        AND expires_at < NOW() + INTERVAL '${daysAhead} days'
      ORDER BY expires_at
    `;

    const result = await pool.query(query);

    return result.rows.map(row => ({
      keyPath: row.key_path,
      description: row.description,
      scope: row.scope,
      lastAccessed: row.last_accessed_at,
      accessCount: row.access_count,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Get secrets that need rotation
   *
   * @returns Array of secrets marked for rotation
   */
  async getNeedingRotation(): Promise<SecretListItem[]> {
    const query = `
      SELECT
        key_path,
        description,
        scope,
        last_accessed_at,
        access_count,
        expires_at
      FROM secrets
      WHERE rotation_required = TRUE
      ORDER BY last_accessed_at ASC NULLS FIRST
    `;

    const result = await pool.query(query);

    return result.rows.map(row => ({
      keyPath: row.key_path,
      description: row.description,
      scope: row.scope,
      lastAccessed: row.last_accessed_at,
      accessCount: row.access_count,
      expiresAt: row.expires_at,
    }));
  }

  /**
   * Mark a secret as needing rotation
   *
   * @param keyPath - Secret key path
   */
  async markForRotation(keyPath: string): Promise<void> {
    const query = 'UPDATE secrets SET rotation_required = TRUE WHERE key_path = $1';
    await pool.query(query, [keyPath]);
  }

  /**
   * Parse key path into components
   *
   * Format: {scope}/{context}/{name}
   * Examples:
   *   - meta/cloudflare/api_token
   *   - project/consilio/database_url
   *   - service/storybook/auth_token
   *
   * @param keyPath - Hierarchical key path
   * @returns Parsed components
   * @throws Error if key path is invalid
   */
  private parseKeyPath(keyPath: string): KeyPathComponents {
    const parts = keyPath.split('/');

    if (parts.length < 2) {
      throw new Error(
        `Invalid key path: "${keyPath}". Format must be: scope/context/name ` +
        '(e.g., meta/cloudflare/api_token, project/consilio/database_url)'
      );
    }

    const scope = parts[0] as SecretScope;

    if (scope === 'meta') {
      return { scope: 'meta', projectName: null, serviceName: null };
    } else if (scope === 'project') {
      if (parts.length < 3) {
        throw new Error(
          `Invalid project key path: "${keyPath}". Format must be: project/{project_name}/{key_name}`
        );
      }
      return { scope: 'project', projectName: parts[1], serviceName: null };
    } else if (scope === 'service') {
      if (parts.length < 3) {
        throw new Error(
          `Invalid service key path: "${keyPath}". Format must be: service/{service_name}/{key_name}`
        );
      }
      return { scope: 'service', projectName: null, serviceName: parts[1] };
    } else {
      throw new Error(
        `Invalid scope: "${scope}". Must be one of: meta, project, service`
      );
    }
  }

  /**
   * Encrypt value using AES-256-GCM
   *
   * Encrypted format: IV (16 bytes) + Auth Tag (16 bytes) + Encrypted Data
   *
   * @param value - Plaintext value to encrypt
   * @returns Encrypted buffer
   */
  private encrypt(value: string): Buffer {
    // Generate random IV (initialization vector)
    const iv = crypto.randomBytes(16);

    // Create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    // Encrypt data
    let encrypted = cipher.update(value, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine: IV (16) + Auth Tag (16) + Encrypted Data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt value using AES-256-GCM
   *
   * @param encryptedBuffer - Encrypted buffer (IV + Auth Tag + Data)
   * @returns Decrypted plaintext
   * @throws Error if authentication fails or decryption fails
   */
  private decrypt(encryptedBuffer: Buffer): string {
    // Extract components
    const iv = encryptedBuffer.subarray(0, 16);
    const authTag = encryptedBuffer.subarray(16, 32);
    const data = encryptedBuffer.subarray(32);

    // Create decipher
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Log secret access for audit trail
   *
   * IMPORTANT: Never log the actual secret value
   *
   * @param keyPath - Secret key path
   * @param accessType - Type of access
   * @param success - Whether access was successful
   * @param errorMessage - Error message if access failed
   */
  private async logAccess(
    keyPath: string,
    accessType: 'read' | 'create' | 'update' | 'delete',
    success: boolean,
    errorMessage: string | null
  ): Promise<void> {
    const query = `
      INSERT INTO secret_access_log (
        key_path, accessed_by, access_type, success, error_message
      ) VALUES ($1, $2, $3, $4, $5)
    `;

    try {
      await pool.query(query, [
        keyPath,
        'supervisor', // In the future, could track specific supervisor/user
        accessType,
        success,
        errorMessage,
      ]);
    } catch (error) {
      // Don't fail the main operation if logging fails
      console.error('Failed to log secret access:', error);
    }
  }
}
