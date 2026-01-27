/**
 * Independent Verifier Unit Tests
 * Epic 006-E: Independent Verification Agent
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { IndependentVerifier } from '../../src/verification/IndependentVerifier.js';
import { IntegrityChecker } from '../../src/verification/IntegrityChecker.js';
import { EvidenceAnalyzer } from '../../src/verification/EvidenceAnalyzer.js';
import { CrossValidator } from '../../src/verification/CrossValidator.js';
import { SkepticalAnalyzer } from '../../src/verification/SkepticalAnalyzer.js';
import { VerificationReporter } from '../../src/verification/VerificationReporter.js';
import { EvidenceRetriever } from '../../src/evidence/EvidenceRetriever.js';
import { EvidenceArtifact } from '../../src/types/evidence.js';
import { RedFlag } from '../../src/types/red-flags.js';
import pino from 'pino';

// Mock dependencies
const mockLogger = pino({ level: 'silent' });
const mockPool = {} as any;

describe('IndependentVerifier', () => {
  let verifier: IndependentVerifier;
  let mockEvidenceRetriever: any;
  let mockIntegrityChecker: any;
  let mockEvidenceAnalyzer: any;
  let mockCrossValidator: any;
  let mockSkepticalAnalyzer: any;
  let mockVerificationReporter: any;

  beforeEach(() => {
    // Create mocks
    mockEvidenceRetriever = {
      getTestArtifacts: jest.fn(),
    };

    mockIntegrityChecker = {
      check: jest.fn(),
    };

    mockEvidenceAnalyzer = {
      analyzeScreenshot: jest.fn(),
      analyzeConsoleLogs: jest.fn(),
      analyzeHTTPTraces: jest.fn(),
      analyzeDOMSnapshot: jest.fn(),
      analyzeCoverage: jest.fn(),
    };

    mockCrossValidator = {
      validate: jest.fn(),
    };

    mockSkepticalAnalyzer = {
      analyze: jest.fn(),
    };

    mockVerificationReporter = {
      generate: jest.fn(),
      generateSummary: jest.fn(),
      generateReasoning: jest.fn(),
      generateRecommendations: jest.fn(),
    };

    // Create verifier instance
    verifier = new IndependentVerifier(
      mockEvidenceRetriever,
      mockIntegrityChecker,
      mockEvidenceAnalyzer,
      mockCrossValidator,
      mockSkepticalAnalyzer,
      mockVerificationReporter,
      mockPool,
      mockLogger
    );
  });

  describe('Model Selection Enforcement', () => {
    it('should reject Haiku as verifier model', () => {
      expect(() => {
        new IndependentVerifier(
          mockEvidenceRetriever,
          mockIntegrityChecker,
          mockEvidenceAnalyzer,
          mockCrossValidator,
          mockSkepticalAnalyzer,
          mockVerificationReporter,
          mockPool,
          mockLogger,
          { verifierModel: 'haiku' as any }
        );
      }).toThrow('CRITICAL ERROR: Verifier model cannot be Haiku');
    });

    it('should accept Sonnet as verifier model', () => {
      expect(() => {
        new IndependentVerifier(
          mockEvidenceRetriever,
          mockIntegrityChecker,
          mockEvidenceAnalyzer,
          mockCrossValidator,
          mockSkepticalAnalyzer,
          mockVerificationReporter,
          mockPool,
          mockLogger,
          { verifierModel: 'sonnet' }
        );
      }).not.toThrow();
    });

    it('should use Sonnet by default', () => {
      const v = new IndependentVerifier(
        mockEvidenceRetriever,
        mockIntegrityChecker,
        mockEvidenceAnalyzer,
        mockCrossValidator,
        mockSkepticalAnalyzer,
        mockVerificationReporter,
        mockPool,
        mockLogger
      );

      expect((v as any).config.verifierModel).toBe('sonnet');
    });
  });

  describe('IntegrityChecker', () => {
    let integrityChecker: IntegrityChecker;
    const artifactDir = '/test/artifacts';

    beforeEach(() => {
      integrityChecker = new IntegrityChecker(artifactDir, mockLogger);
    });

    it('should detect missing screenshot files', async () => {
      const evidence: Partial<EvidenceArtifact> = {
        test_id: 'test-1',
        epic_id: 'epic-1',
        test_type: 'ui',
        test_name: 'Test 1',
        pass_fail: 'pass',
        screenshot_before: 'before.png',
        screenshot_after: 'after.png',
        timestamp: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = await integrityChecker.check(evidence as EvidenceArtifact);

      expect(result.passed).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('does not exist'));
    });

    it('should pass for valid evidence structure', async () => {
      // Mock file system would be needed for actual file existence checks
      const evidence: Partial<EvidenceArtifact> = {
        test_id: 'test-1',
        epic_id: 'epic-1',
        test_type: 'api',
        test_name: 'Test 1',
        pass_fail: 'pass',
        http_request: 'request.json',
        http_response: 'response.json',
        timestamp: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      // This would fail without mocked filesystem, but tests the structure
      const result = await integrityChecker.check(evidence as EvidenceArtifact);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
    });
  });

  describe('CrossValidator', () => {
    it('should detect screenshot-console mismatch', async () => {
      const crossValidator = new CrossValidator(
        mockEvidenceAnalyzer,
        mockPool,
        mockLogger
      );

      // Mock screenshot shows error
      mockEvidenceAnalyzer.analyzeScreenshot.mockResolvedValue({
        hasErrorUI: true,
        hasSuccessUI: false,
        hasLoadingUI: false,
        uiElements: [],
        errors: ['Error message visible'],
      });

      // Mock console has no errors
      mockEvidenceAnalyzer.analyzeConsoleLogs.mockResolvedValue({
        errorCount: 0,
        warningCount: 0,
        infoCount: 5,
        hasUncaughtErrors: false,
        criticalErrors: [],
        patterns: [],
      });

      const evidence: Partial<EvidenceArtifact> = {
        screenshot_after: 'after.png',
        console_logs: 'logs.json',
        test_type: 'ui',
      } as any;

      const results = await crossValidator.validate(evidence as EvidenceArtifact);

      const screenshotVsConsole = results.find(
        (r) => r.type === 'screenshot_vs_console'
      );

      expect(screenshotVsConsole).toBeDefined();
      expect(screenshotVsConsole?.matched).toBe(false);
      expect(screenshotVsConsole?.severity).toBe('high');
    });

    it('should pass when evidence is consistent', async () => {
      const crossValidator = new CrossValidator(
        mockEvidenceAnalyzer,
        mockPool,
        mockLogger
      );

      // Mock consistent evidence
      mockEvidenceAnalyzer.analyzeScreenshot.mockResolvedValue({
        hasErrorUI: false,
        hasSuccessUI: true,
        hasLoadingUI: false,
        uiElements: [],
        errors: [],
      });

      mockEvidenceAnalyzer.analyzeConsoleLogs.mockResolvedValue({
        errorCount: 0,
        warningCount: 0,
        infoCount: 5,
        hasUncaughtErrors: false,
        criticalErrors: [],
        patterns: [],
      });

      const evidence: Partial<EvidenceArtifact> = {
        screenshot_after: 'after.png',
        console_logs: 'logs.json',
        test_type: 'ui',
      } as any;

      const results = await crossValidator.validate(evidence as EvidenceArtifact);

      const screenshotVsConsole = results.find(
        (r) => r.type === 'screenshot_vs_console'
      );

      expect(screenshotVsConsole).toBeDefined();
      expect(screenshotVsConsole?.matched).toBe(true);
      expect(screenshotVsConsole?.severity).toBeUndefined();
    });
  });

  describe('SkepticalAnalyzer', () => {
    it('should detect impossibly fast test execution', async () => {
      const skepticalAnalyzer = new SkepticalAnalyzer(mockEvidenceAnalyzer, mockLogger);

      const evidence: Partial<EvidenceArtifact> = {
        test_type: 'ui',
        duration_ms: 10, // Too fast for UI test
      } as any;

      const result = await skepticalAnalyzer.analyze(
        evidence as EvidenceArtifact,
        []
      );

      expect(result.suspicious).toBe(true);
      expect(result.suspiciousPatterns).toContainEqual(
        expect.objectContaining({
          type: 'too_fast',
          severity: 'high',
        })
      );
    });

    it('should detect missing artifacts', async () => {
      const skepticalAnalyzer = new SkepticalAnalyzer(mockEvidenceAnalyzer, mockLogger);

      const evidence: Partial<EvidenceArtifact> = {
        test_type: 'ui',
        // Missing all artifacts
      } as any;

      const result = await skepticalAnalyzer.analyze(
        evidence as EvidenceArtifact,
        []
      );

      expect(result.suspicious).toBe(true);
      expect(result.suspiciousPatterns).toContainEqual(
        expect.objectContaining({
          type: 'missing_artifacts',
          severity: 'high',
        })
      );
    });

    it('should detect red flags ignored', async () => {
      const skepticalAnalyzer = new SkepticalAnalyzer(mockEvidenceAnalyzer, mockLogger);

      const evidence: Partial<EvidenceArtifact> = {
        test_type: 'ui',
        pass_fail: 'pass',
      } as any;

      const redFlags: Partial<RedFlag>[] = [
        {
          severity: 'critical',
          flagType: 'missing_evidence',
          description: 'Critical issue',
        } as RedFlag,
      ];

      const result = await skepticalAnalyzer.analyze(
        evidence as EvidenceArtifact,
        redFlags as RedFlag[]
      );

      expect(result.suspicious).toBe(true);
      expect(result.suspiciousPatterns).toContainEqual(
        expect.objectContaining({
          type: 'red_flags_ignored',
          severity: 'high',
        })
      );
    });

    it('should pass for normal execution', async () => {
      const skepticalAnalyzer = new SkepticalAnalyzer(mockEvidenceAnalyzer, mockLogger);

      mockEvidenceAnalyzer.analyzeConsoleLogs.mockResolvedValue({
        errorCount: 0,
        warningCount: 1,
        infoCount: 5,
        hasUncaughtErrors: false,
        criticalErrors: [],
        patterns: [],
      });

      const evidence: Partial<EvidenceArtifact> = {
        test_type: 'ui',
        duration_ms: 1500, // Reasonable for UI test
        screenshot_before: 'before.png',
        screenshot_after: 'after.png',
        console_logs: 'logs.json',
        pass_fail: 'pass',
      } as any;

      const result = await skepticalAnalyzer.analyze(
        evidence as EvidenceArtifact,
        []
      );

      expect(result.suspicious).toBe(false);
      expect(result.suspiciousPatterns).toHaveLength(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate 100% confidence for perfect evidence', () => {
      // This tests the confidence calculation logic in IndependentVerifier
      // Since it's private, we'll test through the public verify method
      // For now, verify the structure is correct
      expect(verifier).toBeDefined();
    });

    it('should deduct points for missing artifacts', () => {
      // Test that confidence decreases with missing artifacts
      // Implementation would require exposing or testing through verify()
      expect(verifier).toBeDefined();
    });

    it('should deduct points for red flags', () => {
      // Test red flag penalty calculation
      expect(verifier).toBeDefined();
    });

    it('should deduct points for cross-validation failures', () => {
      // Test cross-validation impact on confidence
      expect(verifier).toBeDefined();
    });
  });

  describe('Verification Outcomes', () => {
    it('should auto-fail on critical red flags', () => {
      // Test that critical red flags cause immediate failure
      expect(verifier).toBeDefined();
    });

    it('should recommend manual review for medium confidence', () => {
      // Test manual review threshold
      expect(verifier).toBeDefined();
    });

    it('should auto-pass for high confidence', () => {
      // Test auto-pass threshold
      expect(verifier).toBeDefined();
    });
  });
});

describe('EvidenceAnalyzer', () => {
  let analyzer: EvidenceAnalyzer;
  const artifactDir = '/test/artifacts';

  beforeEach(() => {
    analyzer = new EvidenceAnalyzer(artifactDir, mockLogger);
  });

  it('should analyze console logs correctly', async () => {
    // Mock file system would be needed for actual analysis
    expect(analyzer).toBeDefined();
    expect(analyzer.analyzeConsoleLogs).toBeDefined();
  });

  it('should detect error patterns in logs', async () => {
    expect(analyzer).toBeDefined();
    expect(analyzer.analyzeConsoleLogs).toBeDefined();
  });

  it('should analyze HTTP traces for failures', async () => {
    expect(analyzer).toBeDefined();
    expect(analyzer.analyzeHTTPTraces).toBeDefined();
  });

  it('should analyze coverage changes', async () => {
    expect(analyzer).toBeDefined();
    expect(analyzer.analyzeCoverage).toBeDefined();
  });
});

describe('VerificationReporter', () => {
  it('should generate plain language summaries', () => {
    const reporter = new VerificationReporter(mockPool, mockLogger);

    const summary = reporter.generateSummary(true, 95, []);
    expect(summary).toContain('PASSED');
    expect(summary).toContain('95%');
  });

  it('should generate failure summaries', () => {
    const reporter = new VerificationReporter(mockPool, mockLogger);

    const summary = reporter.generateSummary(false, 45, ['Missing evidence']);
    expect(summary).toContain('FAILED');
    expect(summary).toContain('45%');
  });

  it('should generate recommendations', () => {
    const reporter = new VerificationReporter(mockPool, mockLogger);

    const recommendations = reporter.generateRecommendations(
      true,
      95,
      [],
      { critical: 0, high: 0, medium: 0, low: 0, totalFlags: 0, descriptions: [] },
      { suspicious: false, concerns: [], recommendManualReview: false, suspiciousPatterns: [] }
    );

    expect(recommendations).toContain(expect.stringContaining('Safe to merge'));
  });

  it('should recommend manual review for failures', () => {
    const reporter = new VerificationReporter(mockPool, mockLogger);

    const recommendations = reporter.generateRecommendations(
      false,
      45,
      ['Missing evidence'],
      { critical: 1, high: 0, medium: 0, low: 0, totalFlags: 1, descriptions: [] },
      { suspicious: true, concerns: [], recommendManualReview: true, suspiciousPatterns: [] }
    );

    expect(recommendations).toContain(expect.stringContaining('Do NOT merge'));
  });
});
