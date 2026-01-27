/**
 * Unit Tests for Evidence Collection Framework
 * Tests evidence collectors, storage, and retrieval functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import pino from 'pino';
import {
  EvidenceCollectorConfig,
  UITestEvidence,
  APITestEvidence,
  UnitTestEvidence,
  TestFrameworkOutput,
  ConsoleLog,
  NetworkTrace,
  HttpRequest,
  HttpResponse,
  MCPToolCall,
} from '../../src/types/evidence.js';
import { EvidenceCollector } from '../../src/evidence/EvidenceCollector.js';
import { UIEvidenceCollector } from '../../src/evidence/UIEvidenceCollector.js';
import { APIEvidenceCollector } from '../../src/evidence/APIEvidenceCollector.js';
import { UnitTestEvidenceCollector } from '../../src/evidence/UnitTestEvidenceCollector.js';

// ============================================================================
// Test Setup
// ============================================================================

const logger = pino({ level: 'silent' });
let testDir: string;

beforeEach(async () => {
  // Create temp directory for tests
  testDir = join(tmpdir(), `evidence-test-${randomBytes(4).toString('hex')}`);
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  // Cleanup temp directory
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// ============================================================================
// Base EvidenceCollector Tests
// ============================================================================

describe('EvidenceCollector Base Class', () => {
  class TestEvidenceCollector extends EvidenceCollector {
    async collect(): Promise<void> {
      // Implement for testing
    }
  }

  it('should create evidence directory structure', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-001',
      artifactDir: testDir,
    };

    const collector = new TestEvidenceCollector(config, logger);
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);

    expect(dir).toBeDefined();
    const stat = await fs.stat(dir);
    expect(stat.isDirectory()).toBe(true);
  });

  it('should save artifact to file system', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-002',
      artifactDir: testDir,
    };

    const collector = new TestEvidenceCollector(config, logger);
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);

    const content = 'test artifact content';
    const relativePath = await collector.saveArtifact(
      dir,
      'test.txt',
      content,
      'ui',
      timestamp,
      false
    );

    expect(relativePath).toBeDefined();
    expect(relativePath).toContain('epic-002');
    expect(relativePath).toContain('test.txt');

    const fullPath = join(testDir, relativePath);
    const saved = await fs.readFile(fullPath, 'utf-8');
    expect(saved).toBe(content);
  });

  it('should save and compress JSON artifact', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-003',
      artifactDir: testDir,
    };

    const collector = new TestEvidenceCollector(config, logger);
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('api', timestamp);

    const data = {
      test: 'data',
      nested: { value: 123 },
    };

    const relativePath = await collector.saveJsonArtifact(
      dir,
      'test-data',
      data,
      'api',
      timestamp,
      true // compress
    );

    expect(relativePath).toContain('test-data.json.gz');

    // Verify file exists
    const exists = await collector.verifyArtifact(relativePath);
    expect(exists).toBe(true);
  });

  it('should cleanup old evidence', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-004',
      artifactDir: testDir,
      retentionDays: 1,
    };

    const collector = new TestEvidenceCollector(config, logger);

    // Create directory with old date
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dir = await collector.createEvidenceDirectory('ui', oldDate);

    // Create a file
    await fs.writeFile(join(dir, 'test.txt'), 'old content');

    // Run cleanup
    const deletedCount = await collector.cleanupOldEvidence();
    expect(deletedCount).toBeGreaterThanOrEqual(1);
  });

  it('should calculate total evidence size', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-005',
      artifactDir: testDir,
    };

    const collector = new TestEvidenceCollector(config, logger);
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);

    // Create some artifacts
    await collector.saveArtifact(dir, 'test1.txt', 'content 1', 'ui', timestamp, false);
    await collector.saveArtifact(dir, 'test2.txt', 'content 2 with more data', 'ui', timestamp, false);

    const totalSize = await collector.getTotalEvidenceSize();
    expect(totalSize).toBeGreaterThan(0);
  });
});

// ============================================================================
// UI Evidence Collector Tests
// ============================================================================

describe('UIEvidenceCollector', () => {
  it('should collect UI test evidence with screenshots', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-ui-001',
      artifactDir: testDir,
    };

    const collector = new UIEvidenceCollector(config, logger);

    const evidence: UITestEvidence = {
      testId: 'test-ui-001',
      testName: 'Login Form Test',
      url: 'http://localhost:5000/login',
      action: 'Click login button',
      screenshotBefore: 'screenshot-before-content',
      screenshotAfter: 'screenshot-after-content',
      domBefore: '<html><body>Before</body></html>',
      domAfter: '<html><body>After login</body></html>',
      consoleLogs: [
        {
          level: 'info',
          message: 'Login started',
        } as ConsoleLog,
      ],
      networkActivity: [
        {
          method: 'POST',
          url: 'http://localhost:5000/api/login',
          statusCode: 200,
          responseTime: 150,
        } as NetworkTrace,
      ],
      expectedOutcome: 'User logged in successfully',
      actualOutcome: 'User logged in successfully',
      passFail: 'pass',
    };

    // This will test directory creation and artifact saving
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);
    expect(dir).toBeDefined();

    // Verify we can save artifacts
    const screenshotPath = await collector.saveArtifact(
      dir,
      'screenshot-before.png',
      evidence.screenshotBefore,
      'ui',
      timestamp,
      false
    );

    expect(screenshotPath).toContain('screenshot-before.png');

    const exists = await collector.verifyArtifact(screenshotPath);
    expect(exists).toBe(true);
  });

  it('should handle console logs in UI tests', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-ui-002',
      artifactDir: testDir,
    };

    const collector = new UIEvidenceCollector(config, logger);

    const logs: ConsoleLog[] = [
      { level: 'info', message: 'Test started' },
      { level: 'warning', message: 'Deprecation warning' },
      { level: 'error', message: 'Test error' },
    ];

    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);

    const logsPath = await collector.saveJsonArtifact(
      dir,
      'console-logs',
      { logs },
      'ui',
      timestamp
    );

    expect(logsPath).toContain('console-logs.json');

    const exists = await collector.verifyArtifact(logsPath);
    expect(exists).toBe(true);
  });
});

// ============================================================================
// API Evidence Collector Tests
// ============================================================================

describe('APIEvidenceCollector', () => {
  it('should collect API test evidence with HTTP pairs', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-api-001',
      artifactDir: testDir,
    };

    const collector = new APIEvidenceCollector(config, logger);

    const evidence: APITestEvidence = {
      testId: 'test-api-001',
      testName: 'Get User API Test',
      toolName: 'GetUserTool',
      operation: 'getUser',
      httpRequest: {
        method: 'GET',
        url: 'http://api.example.com/users/123',
        headers: { 'Authorization': 'Bearer token' },
        body: null,
      } as HttpRequest,
      httpResponse: {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { id: '123', name: 'John Doe' },
        timing: 150,
      } as HttpResponse,
      mcpToolCall: {
        tool: 'GetUserTool',
        params: { userId: '123' },
        response: { id: '123', name: 'John Doe' },
        executionTime: 160,
      } as MCPToolCall,
      expectedOutcome: 'User data retrieved successfully',
      actualOutcome: 'User data retrieved successfully',
      passFail: 'pass',
    };

    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('api', timestamp);

    // Save request
    const requestPath = await collector.saveJsonArtifact(
      dir,
      'http-request',
      evidence.httpRequest,
      'api',
      timestamp
    );

    expect(requestPath).toContain('http-request.json');

    // Verify it exists
    const exists = await collector.verifyArtifact(requestPath);
    expect(exists).toBe(true);
  });

  it('should validate tool response', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-api-002',
      artifactDir: testDir,
    };

    const collector = new APIEvidenceCollector(config, logger);

    const response = {
      id: '123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    const schema = {
      id: 'string',
      name: 'string',
      email: 'string',
    };

    const result = await collector.validateToolResponse(response, schema);
    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should detect invalid tool response', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-api-003',
      artifactDir: testDir,
    };

    const collector = new APIEvidenceCollector(config, logger);

    const response = {
      id: '123',
      // Missing required 'name' field
    };

    const schema = {
      id: 'string',
      name: 'string',
    };

    const result = await collector.validateToolResponse(response, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Unit Test Evidence Collector Tests
// ============================================================================

describe('UnitTestEvidenceCollector', () => {
  it('should collect unit test evidence with framework output', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-unit-001',
      artifactDir: testDir,
    };

    const collector = new UnitTestEvidenceCollector(config, logger);

    const frameworkOutput: TestFrameworkOutput = {
      framework: 'jest',
      totalTests: 10,
      passedTests: 9,
      failedTests: 1,
      skippedTests: 0,
      duration: 2500,
      reportPath: '/path/to/report.json',
    };

    const evidence: UnitTestEvidence = {
      testId: 'test-unit-001',
      testName: 'User Service Tests',
      testSuite: 'services/user.test.ts',
      frameworkOutput,
      coverage: {
        linePercentage: 85.5,
        branchPercentage: 80.0,
        functionPercentage: 90.0,
        statementPercentage: 85.5,
        reportPath: '/path/to/coverage.json',
      },
      assertions: [
        {
          assertion: 'user.name should be John',
          expected: 'John',
          actual: 'John',
          passed: true,
        },
      ],
      passFail: 'pass',
      durationMs: 2500,
    };

    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('unit', timestamp);

    // Save framework output
    const frameworkPath = await collector.saveJsonArtifact(
      dir,
      'test-framework-output',
      frameworkOutput,
      'unit',
      timestamp
    );

    expect(frameworkPath).toContain('test-framework-output.json');

    const exists = await collector.verifyArtifact(frameworkPath);
    expect(exists).toBe(true);
  });
});

// ============================================================================
// Compression Tests
// ============================================================================

describe('Evidence Compression', () => {
  it('should compress large text files', async () => {
    const config: EvidenceCollectorConfig = {
      epicId: 'epic-compress-001',
      artifactDir: testDir,
      compressionEnabled: true,
    };

    const collector = new UIEvidenceCollector(config, logger);
    const timestamp = new Date();
    const dir = await collector.createEvidenceDirectory('ui', timestamp);

    // Create large JSON artifact
    const largeData = {
      logs: Array(1000).fill(null).map((_, i) => ({
        timestamp: new Date(),
        message: `Log message ${i}`,
        level: 'info',
      })),
    };

    const compressedPath = await collector.saveJsonArtifact(
      dir,
      'large-logs',
      largeData,
      'ui',
      timestamp,
      true
    );

    expect(compressedPath).toContain('.gz');

    // Verify compressed file exists
    const exists = await collector.verifyArtifact(compressedPath);
    expect(exists).toBe(true);

    // Verify file is smaller than uncompressed would be
    const size = await collector.getArtifactSize(compressedPath);
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(JSON.stringify(largeData).length); // Should be smaller when compressed
  });
});
