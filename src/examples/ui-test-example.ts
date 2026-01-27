/**
 * UI Test Executor Example
 * Demonstrates Level 5 Verification: Complete UI testing with visual evidence
 *
 * This example shows how to test a login flow with comprehensive verification:
 * 1. Navigate to login page
 * 2. Fill username and password
 * 3. Submit form
 * 4. Verify success (visual + console + network)
 *
 * CRITICAL: Every action is verified with screenshots BEFORE and AFTER
 * This proves agents didn't just claim to press a button - they actually did
 */

import { pino } from 'pino';
import { UITestExecutor } from '../testing/ui/index.js';
import type { UITestDefinition, BrowserConfig } from '../types/ui-testing.js';
import { DEFAULT_VIEWPORT } from '../types/ui-testing.js';
import * as path from 'path';

const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
  },
});

/**
 * Example 1: Simple Button Click Test (Level 5 Verification)
 *
 * This solves the user's core problem:
 * "Agents claim UI tests pass but don't verify button presses actually work"
 *
 * Level 5 means: Screenshot BEFORE click, EXECUTE click, Screenshot AFTER click
 * Can detect: Blank page (button didn't work), element covered, button disabled, etc.
 */
async function testButtonClick() {
  logger.info('=== Example 1: Button Click with Level 5 Verification ===');

  const executor = new UITestExecutor(
    path.join('/tmp', 'ui-test-evidence'),
    {
      headless: true,
      browserType: 'chromium',
      viewport: DEFAULT_VIEWPORT,
    },
    logger
  );

  try {
    const testDef: UITestDefinition = {
      id: 'button-click-test',
      name: 'Button Click Verification',
      description: 'Test that button click works and produces visual result',
      url: 'https://example.com/login',
      viewport: DEFAULT_VIEWPORT,

      // Actions to execute
      actions: [
        {
          id: 'click-submit',
          type: 'click',
          selector: 'button[type="submit"]',
          description: 'Click submit button',
          screenshotBefore: true, // CRITICAL: Prove button existed
          screenshotAfter: true, // CRITICAL: Prove something changed
          waitAfter: {
            type: 'url', // Wait for navigation after click
            urlPattern: '.*/dashboard.*',
            timeout: 5000,
          },
        },
      ],

      // Expectations (Level 5 verification)
      expectations: [
        {
          id: 'page-navigated',
          type: 'url_contains',
          expectedValue: '/dashboard',
          description: 'Page navigated to dashboard',
          critical: true, // Test fails if this fails
        },
        {
          id: 'no-console-errors',
          type: 'console_no_errors',
          description: 'No JavaScript errors on page',
          critical: true,
        },
        {
          id: 'network-success',
          type: 'network_success',
          description: 'All network requests successful',
          critical: true,
        },
      ],
    };

    const result = await executor.executeTest(testDef);

    logger.info({
      passed: result.passed,
      durationMs: result.durationMs,
      actionsExecuted: result.actionsExecuted,
      expectationsPassed: result.expectationResults.filter((e) => e.passed).length,
      evidenceScreenshots: result.evidence.screenshotBaseline,
    });

    // Evidence locations
    logger.info('Evidence saved to:', (result.evidence.domSnapshots as any)?.baseline);

    return result;
  } finally {
    await executor.cleanup();
  }
}

/**
 * Example 2: Form Fill and Submit (Multiple Actions with Evidence)
 *
 * Demonstrates:
 * - Multiple sequential actions
 * - Screenshot before/after each action
 * - Comprehensive state verification
 * - Network request validation
 */
async function testFormSubmission() {
  logger.info('=== Example 2: Form Submission with Complete Evidence ===');

  const executor = new UITestExecutor(
    path.join('/tmp', 'ui-test-evidence'),
    {
      headless: true,
      browserType: 'chromium',
      viewport: DEFAULT_VIEWPORT,
    },
    logger
  );

  try {
    const testDef: UITestDefinition = {
      id: 'form-submission-test',
      name: 'Form Submission',
      description: 'Complete form fill and submission with Level 5 verification',
      url: 'https://example.com/signup',
      viewport: DEFAULT_VIEWPORT,

      actions: [
        {
          id: 'fill-email',
          type: 'fill',
          selector: 'input[name="email"]',
          value: 'test@example.com',
          screenshotBefore: true,
          screenshotAfter: true,
          description: 'Fill email field',
        },
        {
          id: 'fill-password',
          type: 'fill',
          selector: 'input[name="password"]',
          value: 'SecurePassword123!',
          screenshotBefore: true,
          screenshotAfter: true,
          description: 'Fill password field',
        },
        {
          id: 'submit-form',
          type: 'click',
          selector: 'button[type="submit"]',
          screenshotBefore: true,
          screenshotAfter: true,
          waitAfter: {
            type: 'url',
            urlPattern: '.*/success.*',
          },
          description: 'Submit form',
        },
      ],

      expectations: [
        {
          id: 'success-page',
          type: 'url_contains',
          expectedValue: '/success',
          description: 'Redirected to success page',
          critical: true,
        },
        {
          id: 'success-message',
          type: 'text_present',
          selector: '.success-message',
          expectedValue: 'Account created',
          description: 'Success message visible',
          critical: true,
        },
        {
          id: 'no-errors',
          type: 'console_no_errors',
          critical: true,
        },
        {
          id: 'post-request',
          type: 'network_success',
          description: 'Signup API request successful',
          critical: true,
        },
      ],
    };

    const result = await executor.executeTest(testDef);

    logger.info({
      testId: result.testId,
      passed: result.passed,
      partialPass: result.partialPass,
      actionsExecuted: result.actionsExecuted,
      durationMs: result.durationMs,
    });

    // Evidence summary
    logger.info('Evidence collected:');
    logger.info(`  - Initial screenshot: ${result.evidence.screenshotBaseline}`);
    logger.info(`  - Final screenshot: ${result.evidence.screenshotsFinal}`);
    logger.info(`  - Console logs captured: ${result.evidence.consoleLogs.length}`);
    logger.info(`  - Network requests captured: ${result.evidence.networkActivity.length}`);
    logger.info(`  - DOM snapshots: ${result.evidence.domSnapshots?.baseline}`);

    return result;
  } finally {
    await executor.cleanup();
  }
}

/**
 * Example 3: Detecting UI Failures (The Core User Problem)
 *
 * This demonstrates what Level 5 verification CATCHES that Level 1-4 misses:
 * - Button press that leads to blank page (action executed but no result)
 * - Element covered by modal (clickable == false but visible == true)
 * - Form submission that silently fails (no error, but data not saved)
 * - CSS that hides element (display: none) but doesn't remove from DOM
 */
async function testUIFailureDetection() {
  logger.info('=== Example 3: Detecting UI Failures (Level 5 Catches What Level 1-4 Misses) ===');

  const executor = new UITestExecutor(
    path.join('/tmp', 'ui-test-evidence'),
    {
      headless: true,
      browserType: 'chromium',
      viewport: DEFAULT_VIEWPORT,
    },
    logger
  );

  try {
    const testDef: UITestDefinition = {
      id: 'failure-detection-test',
      name: 'Detect Hidden UI Failures',
      description: 'Test that would pass at Level 1-4 but fails at Level 5',
      url: 'https://example.com/problematic-page',
      viewport: DEFAULT_VIEWPORT,

      actions: [
        {
          id: 'click-button',
          type: 'click',
          selector: '.action-button',
          screenshotBefore: true, // Captures that button was visible
          screenshotAfter: true, // Captures that page is now blank (failure!)
          waitAfter: {
            type: 'networkidle',
            timeout: 3000,
          },
        },
      ],

      expectations: [
        // Level 5 verification catches failures that Level 1-4 would miss:
        {
          id: 'element-still-visible',
          type: 'element_visible',
          selector: '.content-area',
          description: 'Content area still visible (not blank page)',
          critical: true,
        },
        {
          id: 'no-js-errors',
          type: 'console_no_errors',
          description: 'No JavaScript errors (would be hidden in Level 4)',
          critical: true,
        },
        {
          id: 'api-success',
          type: 'network_success',
          description: 'API call succeeded (not fake success)',
          critical: true,
        },
        {
          id: 'data-loaded',
          type: 'text_present',
          selector: '.data-table',
          expectedValue: 'rows',
          description: 'Data actually loaded (visual evidence)',
          critical: true,
        },
      ],
    };

    const result = await executor.executeTest(testDef);

    // Level 5 verification explains WHY test passed or failed
    logger.info('Level 5 Verification Results:');

    for (const expectation of result.expectationResults) {
      logger.info({
        expectation: expectation.type,
        passed: expectation.passed,
        actual: expectation.actualValue,
        expected: expectation.expectedValue,
        evidence: (expectation.evidence as any)?.message,
      });
    }

    if (!result.passed) {
      logger.error({
        message: 'TEST FAILED - Visual evidence at:',
        screenshot: result.evidence.screenshotsFinal,
        consoleLogs: result.evidence.consoleLogs.length,
        networkActivity: result.evidence.networkActivity.length,
      });
    }

    return result;
  } finally {
    await executor.cleanup();
  }
}

/**
 * Run examples
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  UI Test Executor Examples - Level 5 Verification          ║');
  console.log('║  Solves: "Agents claim tests pass but don\'t verify UI"    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Uncomment examples to run them
    // await testButtonClick();
    // await testFormSubmission();
    // await testUIFailureDetection();

    logger.info('Examples ready to run. See code comments for details.');
  } catch (error) {
    logger.error({ error }, 'Example failed');
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { testButtonClick, testFormSubmission, testUIFailureDetection };
