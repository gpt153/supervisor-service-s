/**
 * Auto Secret Detector Tests
 *
 * Tests pattern matching and context-based secret detection.
 */

import { AutoSecretDetector } from '../secrets/AutoSecretDetector.js';

describe('AutoSecretDetector', () => {
  let detector: AutoSecretDetector;

  beforeEach(() => {
    detector = new AutoSecretDetector();
  });

  describe('Pattern Matching', () => {
    describe('Anthropic API Keys', () => {
      it('should detect Anthropic API keys', () => {
        const key = 'sk-ant-api03-' + 'a'.repeat(95);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('anthropic');
        expect(result!.keyPath).toBe('meta/anthropic/api_key');
        expect(result!.confidence).toBe(1.0);
      });
    });

    describe('OpenAI API Keys', () => {
      it('should detect OpenAI API keys', () => {
        const key = 'sk-' + 'a'.repeat(48);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('openai');
        expect(result!.keyPath).toBe('meta/openai/api_key');
        expect(result!.confidence).toBe(1.0);
      });

      it('should detect OpenAI org IDs', () => {
        const key = 'org-' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('openai_org');
        expect(result!.keyPath).toBe('meta/openai/org_id');
      });

      it('should detect OpenAI project IDs', () => {
        const key = 'proj_' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('openai_project');
        expect(result!.keyPath).toBe('meta/openai/project_id');
      });
    });

    describe('Google/Gemini API Keys', () => {
      it('should detect Google API keys', () => {
        const key = 'AIza' + 'a'.repeat(35);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('google_api');
        expect(result!.keyPath).toBe('meta/google/api_key');
      });
    });

    describe('Stripe API Keys', () => {
      it('should detect Stripe live secret keys', () => {
        const key = 'sk_live_' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('stripe_live_secret');
        expect(result!.confidence).toBe(1.0);
      });

      it('should detect Stripe test secret keys', () => {
        const key = 'sk_test_' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('stripe_test_secret');
      });

      it('should detect Stripe live publishable keys', () => {
        const key = 'pk_live_' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('stripe_live_publishable');
      });

      it('should detect Stripe restricted keys', () => {
        const key = 'rk_live_' + 'a'.repeat(24);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('stripe_restricted');
      });
    });

    describe('GitHub Tokens', () => {
      it('should detect GitHub PATs', () => {
        const key = 'ghp_' + 'a'.repeat(36);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('github_pat');
        expect(result!.keyPath).toBe('meta/github/pat');
      });

      it('should detect GitHub OAuth tokens', () => {
        const key = 'gho_' + 'a'.repeat(36);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('github_oauth');
      });

      it('should detect GitHub App tokens', () => {
        const key = 'ghu_' + 'a'.repeat(36);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('github_app');
      });
    });

    describe('AWS Keys', () => {
      it('should detect AWS access keys', () => {
        const key = 'AKIA' + 'A'.repeat(16);
        const result = detector.detectSecret(key);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('aws_access_key');
        expect(result!.keyPath).toBe('meta/aws/access_key');
      });
    });

    describe('Database URLs', () => {
      it('should detect PostgreSQL URLs', () => {
        const url = 'postgresql://user:pass@localhost:5432/db';
        const result = detector.detectSecret(url);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('postgres');
      });

      it('should detect MongoDB URLs', () => {
        const url = 'mongodb://user:pass@localhost:27017/db';
        const result = detector.detectSecret(url);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('mongodb');
      });

      it('should detect MongoDB SRV URLs', () => {
        const url = 'mongodb+srv://user:pass@cluster.mongodb.net/db';
        const result = detector.detectSecret(url);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('mongodb');
      });

      it('should detect MySQL URLs', () => {
        const url = 'mysql://user:pass@localhost:3306/db';
        const result = detector.detectSecret(url);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('mysql');
      });

      it('should detect Redis URLs', () => {
        const url = 'redis://user:pass@localhost:6379/0';
        const result = detector.detectSecret(url);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('redis');
      });
    });

    describe('JWT Tokens', () => {
      it('should detect JWT tokens', () => {
        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const result = detector.detectSecret(token);

        expect(result).not.toBeNull();
        expect(result!.type).toBe('jwt_token');
      });
    });
  });

  describe('Context-Based Detection', () => {
    it('should detect Anthropic key from context', () => {
      const value = 'abc123xyz456def789';
      const result = detector.detectSecret(value, {
        question: 'What is your Anthropic API key?',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('anthropic');
      expect(result!.confidence).toBe(0.7);
    });

    it('should detect OpenAI key from context', () => {
      const value = 'abc123xyz456def789ghijkl';
      const result = detector.detectSecret(value, {
        question: 'Provide your OpenAI token',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('openai');
    });

    it('should detect Stripe key from context', () => {
      const value = 'abc123xyz456def789';
      const result = detector.detectSecret(value, {
        question: 'Enter your Stripe API key',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('stripe_api');
    });

    it('should detect password from context', () => {
      const value = 'MySecurePassword123';
      const result = detector.detectSecret(value, {
        question: 'Enter your database password',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('password');
    });

    it('should detect database URL from context', () => {
      const value = 'some-connection-string-here';
      const result = detector.detectSecret(value, {
        question: 'What is your database connection string?',
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('database_url');
    });
  });

  describe('Key Path Generation', () => {
    it('should generate meta-level paths for shared secrets', () => {
      const key = 'sk-ant-api03-' + 'a'.repeat(95);
      const result = detector.detectSecret(key);

      expect(result!.keyPath).toBe('meta/anthropic/api_key');
    });

    it('should generate project-level paths for Stripe', () => {
      const key = 'sk_live_' + 'a'.repeat(24);
      const result = detector.detectSecret(key, {
        projectName: 'consilio',
      });

      expect(result!.keyPath).toBe('project/consilio/stripe_secret_key');
    });

    it('should generate project-level paths for databases', () => {
      const url = 'postgresql://user:pass@localhost/db';
      const result = detector.detectSecret(url, {
        projectName: 'openhorizon',
      });

      expect(result!.keyPath).toBe('project/openhorizon/database_url');
    });

    it('should include service name in path when provided', () => {
      const value = 'some-api-key';
      const result = detector.detectSecret(value, {
        question: 'Enter API key',
        projectName: 'consilio',
        serviceName: 'backend',
      });

      expect(result!.keyPath).toContain('consilio');
    });
  });

  describe('Description Generation', () => {
    it('should generate appropriate descriptions', () => {
      const key = 'sk-ant-api03-' + 'a'.repeat(95);
      const result = detector.detectSecret(key);

      expect(result!.description).toBe('Anthropic API key for Claude');
    });

    it('should include project name in description', () => {
      const key = 'sk_live_' + 'a'.repeat(24);
      const result = detector.detectSecret(key, {
        projectName: 'consilio',
      });

      expect(result!.description).toContain('consilio');
    });
  });

  describe('Secret Redaction', () => {
    it('should redact Anthropic keys', () => {
      const text = 'My key is sk-ant-api03-' + 'a'.repeat(95) + ' for testing';
      const redacted = detector.redactSecrets(text);

      expect(redacted).not.toContain('sk-ant-api03');
      expect(redacted).toContain('sk-a...aaa');
    });

    it('should redact OpenAI keys', () => {
      const key = 'sk-' + 'a'.repeat(48);
      const text = `My OpenAI key is ${key}`;
      const redacted = detector.redactSecrets(text);

      expect(redacted).not.toContain(key);
      expect(redacted).toContain('sk-a...aaa');
    });

    it('should redact Stripe keys', () => {
      const key = 'sk_live_' + 'a'.repeat(24);
      const text = `Stripe key: ${key}`;
      const redacted = detector.redactSecrets(text);

      expect(redacted).not.toContain(key);
      expect(redacted).toContain('sk_l...aaa');
    });

    it('should redact database URLs', () => {
      const url = 'postgresql://user:password@localhost:5432/db';
      const text = `Database: ${url}`;
      const redacted = detector.redactSecrets(text);

      expect(redacted).not.toContain('password');
    });

    it('should redact multiple secrets in same text', () => {
      const key1 = 'sk-ant-api03-' + 'a'.repeat(95);
      const key2 = 'sk-' + 'b'.repeat(48);
      const text = `Keys: ${key1} and ${key2}`;
      const redacted = detector.redactSecrets(text);

      expect(redacted).not.toContain(key1);
      expect(redacted).not.toContain(key2);
    });
  });

  describe('Contains Secrets Check', () => {
    it('should return true for text with secrets', () => {
      const text = 'My key is sk-ant-api03-' + 'a'.repeat(95);
      const result = detector.containsSecrets(text);

      expect(result).toBe(true);
    });

    it('should return false for text without secrets', () => {
      const text = 'This is just regular text without any secrets';
      const result = detector.containsSecrets(text);

      expect(result).toBe(false);
    });

    it('should detect secrets in mixed content', () => {
      const text = 'Here is my Stripe key: sk_live_' + 'a'.repeat(24) + ' for payments';
      const result = detector.containsSecrets(text);

      expect(result).toBe(true);
    });
  });

  describe('Extract All Secrets', () => {
    it('should extract multiple secrets from text', () => {
      const key1 = 'sk-ant-api03-' + 'a'.repeat(95);
      const key2 = 'sk_live_' + 'b'.repeat(24);
      const text = `I have two keys: ${key1} and ${key2}`;

      const secrets = detector.extractAllSecrets(text);

      expect(secrets).toHaveLength(2);
      expect(secrets[0].type).toBe('anthropic');
      expect(secrets[1].type).toBe('stripe_live_secret');
    });

    it('should not return duplicate secrets', () => {
      const key = 'sk-ant-api03-' + 'a'.repeat(95);
      const text = `Key: ${key} and again: ${key}`;

      const secrets = detector.extractAllSecrets(text);

      expect(secrets).toHaveLength(1);
    });

    it('should return empty array for no secrets', () => {
      const text = 'No secrets here';
      const secrets = detector.extractAllSecrets(text);

      expect(secrets).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const result = detector.detectSecret('');

      expect(result).toBeNull();
    });

    it('should handle whitespace-only strings', () => {
      const result = detector.detectSecret('   ');

      expect(result).toBeNull();
    });

    it('should handle very short strings', () => {
      const result = detector.detectSecret('abc');

      expect(result).toBeNull();
    });

    it('should trim input', () => {
      const key = '  sk-ant-api03-' + 'a'.repeat(95) + '  ';
      const result = detector.detectSecret(key);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('anthropic');
    });
  });
});
