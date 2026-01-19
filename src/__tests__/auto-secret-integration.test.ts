/**
 * Auto Secret Detection Integration Tests
 *
 * Tests the full workflow of detecting and storing secrets automatically.
 */

import { AutoSecretDetector } from '../secrets/AutoSecretDetector.js';
import { SecretsManager } from '../secrets/SecretsManager.js';
import { pool } from '../db/client.js';

describe('Auto Secret Detection Integration', () => {
  let detector: AutoSecretDetector;
  let secretsManager: SecretsManager;

  beforeAll(async () => {
    // Ensure database is set up
    detector = new AutoSecretDetector();
    secretsManager = new SecretsManager();
  });

  afterAll(async () => {
    // Clean up test secrets
    try {
      await pool.query("DELETE FROM secrets WHERE key_path LIKE 'test/%'");
      await pool.query("DELETE FROM secret_access_log WHERE key_path LIKE 'test/%'");
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
    await pool.end();
  });

  describe('Detect and Store Workflow', () => {
    it('should detect and store Anthropic key automatically', async () => {
      const key = 'sk-ant-api03-' + 'a'.repeat(95);
      const detection = detector.detectSecret(key);

      expect(detection).not.toBeNull();

      // Store the detected secret
      await secretsManager.set({
        keyPath: 'test/anthropic/api_key',
        value: detection!.value,
        description: detection!.description,
        createdBy: 'integration_test',
      });

      // Verify stored
      const retrieved = await secretsManager.get({
        keyPath: 'test/anthropic/api_key',
        accessedBy: 'integration_test',
      });

      expect(retrieved).toBe(key);
    });

    it('should detect and store Stripe key with project context', async () => {
      const key = 'sk_live_' + 'b'.repeat(24);
      const detection = detector.detectSecret(key, {
        projectName: 'consilio',
      });

      expect(detection).not.toBeNull();
      expect(detection!.keyPath).toContain('consilio');

      // Store using detected path
      await secretsManager.set({
        keyPath: 'test/consilio/stripe_key',
        value: detection!.value,
        description: detection!.description,
        createdBy: 'integration_test',
      });

      // Verify
      const retrieved = await secretsManager.get({
        keyPath: 'test/consilio/stripe_key',
        accessedBy: 'integration_test',
      });

      expect(retrieved).toBe(key);
    });

    it('should detect database URL and store securely', async () => {
      const url = 'postgresql://user:SecurePass123@localhost:5432/testdb';
      const detection = detector.detectSecret(url, {
        projectName: 'openhorizon',
      });

      expect(detection).not.toBeNull();
      expect(detection!.type).toBe('postgres');

      await secretsManager.set({
        keyPath: 'test/openhorizon/database_url',
        value: detection!.value,
        description: detection!.description,
        createdBy: 'integration_test',
      });

      // Verify password is encrypted
      const raw = await pool.query(
        'SELECT encrypted_value FROM secrets WHERE key_path = $1',
        ['test/openhorizon/database_url']
      );

      expect(raw.rows[0].encrypted_value).toBeDefined();
      // Should NOT contain the password in plain text
      const bufferString = raw.rows[0].encrypted_value.toString();
      expect(bufferString).not.toContain('SecurePass123');
    });
  });

  describe('User Message Simulation', () => {
    it('should handle user providing key in response to question', async () => {
      // Simulate supervisor asking for key
      const question = 'What is your Stripe API key for consilio?';

      // User provides key
      const userInput = 'sk_live_' + 'c'.repeat(24);

      // Detect with context
      const detection = detector.detectSecret(userInput, {
        question,
        projectName: 'consilio',
      });

      expect(detection).not.toBeNull();
      expect(detection!.type).toBe('stripe_live_secret');

      // Store automatically
      await secretsManager.set({
        keyPath: detection!.keyPath,
        value: detection!.value,
        description: detection!.description,
        createdBy: 'user_input',
      });

      // Verify retrieval
      const retrieved = await secretsManager.get({
        keyPath: detection!.keyPath,
        accessedBy: 'integration_test',
      });

      expect(retrieved).toBe(userInput);
    });

    it('should handle multiple secrets in user message', async () => {
      const message = `
        Here are my keys:
        Anthropic: sk-ant-api03-${'d'.repeat(95)}
        OpenAI: sk-${'e'.repeat(48)}
      `;

      const secrets = detector.extractAllSecrets(message);

      expect(secrets.length).toBeGreaterThanOrEqual(2);

      // Store all detected secrets
      for (const secret of secrets) {
        const keyPath = `test/multi/${secret.type}`;
        await secretsManager.set({
          keyPath,
          value: secret.value,
          description: secret.description,
          createdBy: 'integration_test',
        });
      }

      // Verify all stored
      const list = await secretsManager.list({
        scope: 'test',
      });

      expect(list.length).toBeGreaterThan(0);
    });
  });

  describe('Redaction for Logging', () => {
    it('should redact secrets before logging', () => {
      const sensitiveMessage = `
        User provided key: sk-ant-api03-${'f'.repeat(95)}
        And Stripe key: sk_live_${'g'.repeat(24)}
      `;

      const redacted = detector.redactSecrets(sensitiveMessage);

      // Should not contain full keys
      expect(redacted).not.toContain('f'.repeat(95));
      expect(redacted).not.toContain('g'.repeat(24));

      // Should contain redacted versions
      expect(redacted).toContain('sk-a...');
      expect(redacted).toContain('sk_l...');
    });

    it('should allow safe logging of redacted content', () => {
      const key = 'sk-ant-api03-' + 'h'.repeat(95);
      const message = `Processing key: ${key}`;

      const redacted = detector.redactSecrets(message);

      // This should be safe to log
      console.log('Safe log:', redacted);

      expect(redacted).toContain('sk-a...');
      expect(redacted).not.toContain(key);
    });
  });

  describe('Access Tracking', () => {
    it('should track access when auto-detected secret is used', async () => {
      const key = 'sk_live_' + 'i'.repeat(24);
      const keyPath = 'test/tracking/stripe_key';

      // Detect and store
      const detection = detector.detectSecret(key);
      await secretsManager.set({
        keyPath,
        value: detection!.value,
        description: 'Test tracking',
        createdBy: 'integration_test',
      });

      // Access it
      await secretsManager.get({
        keyPath,
        accessedBy: 'integration_test',
      });

      // Check access log
      const logs = await pool.query(
        'SELECT * FROM secret_access_log WHERE key_path = $1',
        [keyPath]
      );

      expect(logs.rows.length).toBeGreaterThan(0);
      expect(logs.rows[0].access_type).toBe('read');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', () => {
      const result = detector.detectSecret('not a secret');
      expect(result).toBeNull();
    });

    it('should handle detection with missing context', () => {
      const key = 'sk-ant-api03-' + 'j'.repeat(95);
      const result = detector.detectSecret(key); // No context

      expect(result).not.toBeNull();
      expect(result!.type).toBe('anthropic');
    });

    it('should handle empty extraction', () => {
      const secrets = detector.extractAllSecrets('Regular text');
      expect(secrets).toHaveLength(0);
    });
  });

  describe('Pattern Coverage', () => {
    const testCases = [
      { type: 'Anthropic', value: 'sk-ant-api03-' + 'a'.repeat(95), expectedType: 'anthropic' },
      { type: 'OpenAI', value: 'sk-' + 'b'.repeat(48), expectedType: 'openai' },
      { type: 'Google', value: 'AIza' + 'c'.repeat(35), expectedType: 'google_api' },
      { type: 'Stripe Live', value: 'sk_live_' + 'd'.repeat(24), expectedType: 'stripe_live_secret' },
      { type: 'Stripe Test', value: 'sk_test_' + 'e'.repeat(24), expectedType: 'stripe_test_secret' },
      { type: 'GitHub PAT', value: 'ghp_' + 'f'.repeat(36), expectedType: 'github_pat' },
      { type: 'AWS Access', value: 'AKIA' + 'G'.repeat(16), expectedType: 'aws_access_key' },
      { type: 'PostgreSQL', value: 'postgresql://user:pass@localhost/db', expectedType: 'postgres' },
      { type: 'MongoDB', value: 'mongodb://user:pass@localhost/db', expectedType: 'mongodb' },
    ];

    testCases.forEach(({ type, value, expectedType }) => {
      it(`should detect ${type} keys`, () => {
        const result = detector.detectSecret(value);
        expect(result).not.toBeNull();
        expect(result!.type).toBe(expectedType);
      });
    });
  });
});
