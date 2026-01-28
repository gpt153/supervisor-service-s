/**
 * Unit Tests for SanitizationService (Epic 007-B)
 * Tests all 8 secret patterns and data structure handling
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SanitizationService,
  resetSanitizationService,
} from '../../../src/session/SanitizationService.js';

describe('SanitizationService', () => {
  let service: SanitizationService;

  beforeEach(() => {
    resetSanitizationService();
    service = new SanitizationService();
    service.initializeDefaults();
  });

  afterEach(() => {
    resetSanitizationService();
  });

  describe('API Key Sanitization', () => {
    it('should redact API_KEY=value', async () => {
      const data = 'My API_KEY=secret123abc is here';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('secret123abc');
    });

    it('should redact api_key=value', async () => {
      const data = { api_key: 'super_secret_key', name: 'test' };
      const result = await service.sanitize(data);
      expect(result.api_key).toBe('[REDACTED]');
      expect(result.name).toBe('test');
    });

    it('should redact API_KEY with quotes', async () => {
      const data = 'API_KEY="abc123xyz"';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('Password Sanitization', () => {
    it('should redact PASSWORD=value', async () => {
      const data = 'PASSWORD=myPassword123 in string';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('myPassword123');
    });

    it('should redact password key', async () => {
      const data = { password: 'secret_pass_123', user: 'admin' };
      const result = await service.sanitize(data);
      expect(result.password).toBe('[REDACTED]');
      expect(result.user).toBe('admin');
    });

    it('should redact password with quotes', async () => {
      const data = "password='complex@Pass#123'";
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('Token Sanitization', () => {
    it('should redact TOKEN=value', async () => {
      const data = 'TOKEN=abc_token_xyz123';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });

    it('should redact token key', async () => {
      const data = { token: 'my-secret-token', action: 'login' };
      const result = await service.sanitize(data);
      expect(result.token).toBe('[REDACTED]');
      expect(result.action).toBe('login');
    });
  });

  describe('JWT Token Sanitization', () => {
    it('should redact JWT tokens', async () => {
      const data =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });

    it('should not redact normal base64', async () => {
      const data = 'normal/base64/data=';
      const result = await service.sanitize(data);
      expect(result).not.toContain('[REDACTED]');
    });
  });

  describe('AWS Credentials Sanitization', () => {
    it('should redact AWS access key', async () => {
      const data = 'AKIAIOSFODNN7EXAMPLE';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });

    it('should redact aws_access_key_id', async () => {
      const data = { aws_access_key_id: 'AKIAIOSFODNN7EXAMPLE', region: 'us-east-1' };
      const result = await service.sanitize(data);
      expect(result.aws_access_key_id).toBe('[REDACTED]');
      expect(result.region).toBe('us-east-1');
    });

    it('should redact aws_secret_access_key', async () => {
      const data = 'aws_secret_access_key=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('Connection String Sanitization', () => {
    it('should redact PostgreSQL connection with password', async () => {
      const data = 'postgresql://user:password123@localhost:5432/mydb';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('password123');
    });

    it('should redact connection string in object', async () => {
      const data = {
        db_url: 'postgresql://admin:securepass@db.example.com:5432/production',
        port: 5432,
      };
      const result = await service.sanitize(data);
      expect(result.db_url).toContain('[REDACTED]');
      expect(result.port).toBe(5432);
    });
  });

  describe('Bearer Token Sanitization', () => {
    it('should redact Bearer tokens', async () => {
      const data = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc123.xyz789';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('OAuth Token Sanitization', () => {
    it('should redact access_token', async () => {
      const data = 'access_token=oauth_token_abc123xyz789';
      const result = await service.sanitize(data);
      expect(result).toContain('[REDACTED]');
    });

    it('should redact refresh_token', async () => {
      const data = { refresh_token: 'refresh_xyz123abc789', expires_in: 3600 };
      const result = await service.sanitize(data);
      expect(result.refresh_token).toBe('[REDACTED]');
      expect(result.expires_in).toBe(3600);
    });
  });

  describe('Nested Data Structure Sanitization', () => {
    it('should sanitize nested objects', async () => {
      const data = {
        user: {
          username: 'john',
          credentials: {
            password: 'secret123',
            api_key: 'key_abc_xyz',
          },
        },
        metadata: 'public',
      };

      const result = await service.sanitize(data);
      expect(result.user.username).toBe('john');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.api_key).toBe('[REDACTED]');
      expect(result.metadata).toBe('public');
    });

    it('should sanitize arrays of objects', async () => {
      const data = {
        items: [
          { name: 'item1', token: 'token_123' },
          { name: 'item2', token: 'token_456' },
        ],
      };

      const result = await service.sanitize(data);
      expect(result.items[0].name).toBe('item1');
      expect(result.items[0].token).toBe('[REDACTED]');
      expect(result.items[1].name).toBe('item2');
      expect(result.items[1].token).toBe('[REDACTED]');
    });

    it('should handle deeply nested structures', async () => {
      const data = {
        level1: {
          level2: {
            level3: {
              secret_key: 'super_secret',
              public_data: 'visible',
            },
          },
        },
      };

      const result = await service.sanitize(data);
      expect(result.level1.level2.level3.secret_key).toBe('[REDACTED]');
      expect(result.level1.level2.level3.public_data).toBe('visible');
    });
  });

  describe('Data Type Handling', () => {
    it('should handle null and undefined', async () => {
      expect(await service.sanitize(null)).toBeNull();
      expect(await service.sanitize(undefined)).toBeUndefined();
    });

    it('should handle numbers and booleans', async () => {
      const data = {
        count: 42,
        enabled: true,
        disabled: false,
        percentage: 99.9,
      };

      const result = await service.sanitize(data);
      expect(result.count).toBe(42);
      expect(result.enabled).toBe(true);
      expect(result.disabled).toBe(false);
      expect(result.percentage).toBe(99.9);
    });

    it('should handle empty structures', async () => {
      expect(await service.sanitize({})).toEqual({});
      expect(await service.sanitize([])).toEqual([]);
      expect(await service.sanitize('')).toBe('');
    });

    it('should preserve non-sensitive strings', async () => {
      const data = 'This is a normal string with no secrets';
      const result = await service.sanitize(data);
      expect(result).toBe(data);
    });
  });

  describe('Sensitive Key Detection', () => {
    it('should detect sensitive keys by name', async () => {
      const data = {
        api_secret: 'value1',
        refresh_token: 'value2',
        private_key: 'value3',
        oauth_token: 'value4',
        encryption_key: 'value5',
        public_data: 'value6',
      };

      const result = await service.sanitize(data);
      expect(result.api_secret).toBe('[REDACTED]');
      expect(result.refresh_token).toBe('[REDACTED]');
      expect(result.private_key).toBe('[REDACTED]');
      expect(result.oauth_token).toBe('[REDACTED]');
      expect(result.encryption_key).toBe('[REDACTED]');
      expect(result.public_data).toBe('value6');
    });

    it('should be case-insensitive for sensitive keys', async () => {
      const data = {
        PASSWORD: 'secret1',
        Token: 'secret2',
        ApiKey: 'secret3',
      };

      const result = await service.sanitize(data);
      expect(result.PASSWORD).toBe('[REDACTED]');
      expect(result.Token).toBe('[REDACTED]');
      expect(result.ApiKey).toBe('[REDACTED]');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should sanitize AWS Lambda environment variables', async () => {
      const data = {
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        DB_URL: 'postgresql://user:pass@db.example.com/prod',
        API_TOKEN: 'token_abc_123_xyz',
        LAMBDA_FUNCTION: 'my_function',
      };

      const result = await service.sanitize(data);
      expect(result.AWS_ACCESS_KEY_ID).toBe('[REDACTED]');
      expect(result.AWS_SECRET_ACCESS_KEY).toBe('[REDACTED]');
      expect(result.DB_URL).toContain('[REDACTED]');
      expect(result.API_TOKEN).toBe('[REDACTED]');
      expect(result.LAMBDA_FUNCTION).toBe('my_function');
    });

    it('should sanitize GitHub Actions secrets', async () => {
      const data = {
        GITHUB_TOKEN: 'ghp_abcdefghijklmnopqrstuvwxyz123456',
        NPM_AUTH_TOKEN: 'npm_token_secret_xyz',
        SLACK_WEBHOOK: 'https://hooks.slack.com/services/TOKEN/SECRET',
      };

      const result = await service.sanitize(data);
      expect(result.GITHUB_TOKEN).toBe('[REDACTED]');
      expect(result.NPM_AUTH_TOKEN).toBe('[REDACTED]');
      expect(result.SLACK_WEBHOOK).toContain('[REDACTED]');
    });

    it('should sanitize API responses with mixed data', async () => {
      const data = {
        success: true,
        user: {
          id: 12345,
          email: 'user@example.com',
          auth_token: 'auth_secret_token',
          settings: {
            api_key: 'sk_live_abc123',
            notification_token: 'notification_secret',
            public_setting: 'visible_value',
          },
        },
        request_id: 'req_12345',
      };

      const result = await service.sanitize(data);
      expect(result.success).toBe(true);
      expect(result.user.email).toBe('user@example.com');
      expect(result.user.auth_token).toBe('[REDACTED]');
      expect(result.user.settings.api_key).toBe('[REDACTED]');
      expect(result.user.settings.notification_token).toBe('[REDACTED]');
      expect(result.user.settings.public_setting).toBe('visible_value');
      expect(result.request_id).toBe('req_12345');
    });
  });

  describe('Performance', () => {
    it('should sanitize large objects efficiently', async () => {
      const data: any = {};
      for (let i = 0; i < 100; i++) {
        data[`field_${i}`] = {
          value: `value_${i}`,
          password: `pass_${i}`,
          api_key: `key_${i}`,
        };
      }

      const start = Date.now();
      await service.sanitize(data);
      const duration = Date.now() - start;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
