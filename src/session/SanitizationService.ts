/**
 * Secret Sanitization Service (Epic 007-B)
 * Redacts sensitive data before logging to prevent secret exposure
 *
 * Handles:
 * - API keys, passwords, tokens
 * - JWT tokens (eyJ...)
 * - AWS credentials (AKIA...)
 * - Database connection strings with passwords
 * - Bearer tokens
 * - OAuth tokens
 */

import { query as dbQuery } from '../db/index.js';
import { SecretPattern } from '../types/command-log.js';

/**
 * Sanitization service for redacting secrets in logged data
 */
export class SanitizationService {
  private patterns: Map<string, RegExp> = new Map();
  private initialized = false;

  /**
   * Initialize the service by loading patterns from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await dbQuery(
        `SELECT pattern_name, regex_pattern FROM secret_patterns WHERE enabled = true`
      );

      for (const row of result.rows as any[]) {
        try {
          // Add 'gi' flags: global + case insensitive
          this.patterns.set(row.pattern_name, new RegExp(row.regex_pattern, 'gi'));
        } catch (e) {
          console.warn(
            `Failed to compile regex for pattern ${row.pattern_name}:`,
            (e as Error).message
          );
        }
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize sanitization patterns:', error);
      // Initialize with default patterns if DB fails
      this.initializeDefaults();
      this.initialized = true;
    }
  }

  /**
   * Initialize default patterns if database unavailable
   */
  private initializeDefaults(): void {
    this.patterns.set('api_key', /(API_KEY|api_key)\s*=\s*["']?[a-zA-Z0-9_-]+["']?/gi);
    this.patterns.set('password', /(PASSWORD|password)\s*=\s*["']?[^"\s'']+["']?/gi);
    this.patterns.set('token', /(TOKEN|token)\s*=\s*["']?[a-zA-Z0-9._-]+["']?/gi);
    this.patterns.set(
      'jwt_token',
      /(eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+/gi
    );
    this.patterns.set(
      'aws_credentials',
      /(AKIA[0-9A-Z]{16}|aws_access_key_id|aws_secret_access_key)/gi
    );
    this.patterns.set('connection_string', /postgresql:\/\/[^:]+:[^@]+@/gi);
    this.patterns.set('bearer_token', /Bearer\s+[a-zA-Z0-9._-]+/gi);
    this.patterns.set(
      'oauth_token',
      /(access_token|refresh_token)\s*=\s*["']?[^"\s'']+["']?/gi
    );
  }

  /**
   * Sanitize any data structure recursively
   * Handles strings, objects, arrays, and primitives
   */
  async sanitize(data: any): Promise<any> {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data);
    }

    if (Array.isArray(data)) {
      return Promise.all(data.map((item) => this.sanitize(item)));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        // Check if key name suggests sensitivity
        if (this.isSensitiveKey(key)) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = await this.sanitize(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize a string by applying all regex patterns
   */
  private sanitizeString(str: string): string {
    if (!str || typeof str !== 'string') {
      return str;
    }

    let result = str;

    // Apply all regex patterns
    for (const [name, pattern] of this.patterns) {
      result = result.replace(pattern, '[REDACTED]');
    }

    return result;
  }

  /**
   * Check if a key name indicates sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    const sensitiveKeywords = [
      'password',
      'token',
      'secret',
      'key',
      'api_key',
      'apikey',
      'authorization',
      'bearer',
      'credential',
      'oauth',
      'jwt',
      'private_key',
      'access_token',
      'refresh_token',
      'api_secret',
      'aws_key',
      'aws_secret',
      'encryption_key',
    ];

    return sensitiveKeywords.some((keyword) => lowerKey.includes(keyword));
  }

  /**
   * Sanitize for database storage (JSONB)
   * Converts after sanitization
   */
  async sanitizeForStorage(data: any): Promise<any> {
    const sanitized = await this.sanitize(data);
    return JSON.parse(JSON.stringify(sanitized)); // Ensure JSON serializable
  }
}

/**
 * Global instance (singleton)
 */
let globalInstance: SanitizationService | null = null;

/**
 * Get or create the global sanitization service
 */
export async function getSanitizationService(): Promise<SanitizationService> {
  if (!globalInstance) {
    globalInstance = new SanitizationService();
    await globalInstance.initialize();
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetSanitizationService(): void {
  globalInstance = null;
}
