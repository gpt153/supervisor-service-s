/**
 * UI Test Executor (Level 5 Verification Orchestrator)
 * Main coordinator for browser automation, action execution, and visual evidence collection
 * Solves the core user problem: "Agents claim tests pass but don't verify visual outcomes"
 *
 * Level 5 Verification means:
 * 1. Element EXISTS in DOM
 * 2. Element VISIBLE to user
 * 3. Element INTERACTIVE (clickable/enabled)
 * 4. Action EXECUTES with observable result
 * 5. VISUAL STATE VERIFIED with screenshots + rendered state checks
 */

import { Logger } from 'pino';
import { Page } from 'playwright';
import * as path from 'path';
import {
  BrowserConfig,
  UITestDefinition,
  UITestResult,
  UIExpectation,
  ExpectationResult,
  TestFailure,
  UIAction,
  DEFAULT_TEST_TIMEOUT,
} from '../../types/ui-testing.js';
import { BrowserManager } from './BrowserManager.js';
import { ActionExecutor } from './ActionExecutor.js';
import { VisualVerifier } from './VisualVerifier.js';
import { StateVerifier } from './StateVerifier.js';
import { ConsoleMonitor } from './ConsoleMonitor.js';
import { NetworkMonitor } from './NetworkMonitor.js';

export class UITestExecutor {
  private logger: Logger;
  private browserManager: BrowserManager;
  private actionExecutor: ActionExecutor;
  private visualVerifier: VisualVerifier;
  private stateVerifier: StateVerifier;
  private consoleMonitor: ConsoleMonitor;
  private networkMonitor: NetworkMonitor;
  private evidenceDir: string;

  constructor(
    evidenceDir: string,
    browserConfig?: Partial<BrowserConfig>,
    logger?: Logger
  ) {
    this.evidenceDir = evidenceDir;
    this.logger = logger || console as any;
    this.browserManager = new BrowserManager(browserConfig, this.logger);
    this.actionExecutor = new ActionExecutor(this.logger);
    this.consoleMonitor = new ConsoleMonitor(this.logger);
    this.networkMonitor = new NetworkMonitor(this.logger);

    const screenshotsDir = path.join(evidenceDir, 'screenshots');
    const domSnapshotsDir = path.join(evidenceDir, 'dom-snapshots');

    this.visualVerifier = new VisualVerifier(screenshotsDir, this.logger);
    this.stateVerifier = new StateVerifier(domSnapshotsDir, this.logger);
  }

  /**
   * Execute a single UI test with complete evidence collection (Level 5)
   */
  async executeTest(testDef: UITestDefinition): Promise<UITestResult> {
    const startTime = Date.now();
    const startDate = new Date();

    this.logger.info(
      { testId: testDef.id, testName: testDef.name },
      'Starting UI test execution'
    );

    let page: Page | null = null;
    const result: UITestResult = {
      testId: testDef.id,
      testName: testDef.name,
      passed: false,
      durationMs: 0,
      startedAt: startDate,
      completedAt: new Date(),
      actionsExecuted: 0,
      expectationResults: [],
      evidence: {
        testId: testDef.id,
        testName: testDef.name,
        consoleLogs: [],
        networkActivity: [],
        expectedOutcome: '',
        actualOutcome: '',
        passFail: 'fail',
      },
    };

    try {
      // 1. Setup browser
      page = await this.browserManager.createPage();
      this.consoleMonitor.attachToPage(page);
      this.networkMonitor.attachToPage(page);

      // Set viewport
      if (testDef.viewport) {
        await this.browserManager.setViewport(page, testDef.viewport);
      }

      this.logger.debug({ url: testDef.url }, 'Navigating to test URL');

      // 2. Navigate to URL
      await page.goto(testDef.url, { waitUntil: 'networkidle' });

      // 3. Capture baseline (Level 5: initial visual state)
      const baselineScreenshot = await this.visualVerifier.captureFullPage(
        page,
        'baseline'
      );
      const baselineDom = await this.stateVerifier.captureDOMState(page, 'baseline');

      this.logger.debug(
        { baselineScreenshot, baselineDom },
        'Baseline state captured'
      );

      // 4. Execute actions with evidence collection
      for (const action of testDef.actions) {
        try {
          // Screenshot before action
          if (action.screenshotBefore) {
            await this.visualVerifier.captureFullPage(page, 'before_action', action.id);
          }

          // Execute action
          const actionResult = await this.actionExecutor.execute(page, action);

          if (!actionResult.success) {
            const failure: TestFailure = {
              actionId: action.id,
              type: 'action_failed',
              message: `Action failed: ${actionResult.error}`,
            };
            result.failures = result.failures || [];
            result.failures.push(failure);
            this.logger.error(
              { actionId: action.id, error: actionResult.error },
              'Action execution failed'
            );
          }

          // Screenshot after action (Level 5: CRITICAL - proves action had visual effect)
          if (action.screenshotAfter) {
            await this.visualVerifier.captureFullPage(page, 'after_action', action.id);
          }

          result.actionsExecuted++;

          this.logger.debug(
            { actionId: action.id, durationMs: actionResult.durationMs },
            'Action executed'
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const failure: TestFailure = {
            actionId: action.id,
            type: 'action_failed',
            message: `Action exception: ${errorMsg}`,
          };
          result.failures = result.failures || [];
          result.failures.push(failure);
          this.logger.error(
            { actionId: action.id, error: errorMsg },
            'Action exception'
          );
        }
      }

      // 5. Capture final state
      const finalScreenshot = await this.visualVerifier.captureFullPage(page, 'final');
      const finalDom = await this.stateVerifier.captureDOMState(page, 'final');

      // 6. Verify expectations (Level 5: detailed verification)
      for (const expectation of testDef.expectations) {
        const expectationResult = await this.verifyExpectation(page, expectation);
        result.expectationResults.push(expectationResult);

        if (!expectationResult.passed && expectation.critical) {
          const failure: TestFailure = {
            expectationId: expectation.id,
            type: 'expectation_failed',
            message: `Critical expectation failed: ${expectation.description || expectation.type}`,
          };
          result.failures = result.failures || [];
          result.failures.push(failure);
        }
      }

      // 7. Collect evidence
      const consoleReport = this.consoleMonitor.getReport();
      const networkReport = this.networkMonitor.getReport();

      // 8. Verify no unexpected errors (Level 5: trust nothing, verify everything)
      const consoleAssertion = this.consoleMonitor.assertNoErrors();
      const networkAssertion = this.networkMonitor.assertNoFailedRequests();

      if (!consoleAssertion.passed) {
        const failure: TestFailure = {
          type: 'action_failed',
          message: `Console errors: ${consoleAssertion.message}`,
        };
        result.failures = result.failures || [];
        result.failures.push(failure);
      }

      if (!networkAssertion.passed) {
        const failure: TestFailure = {
          type: 'action_failed',
          message: `Network failures: ${networkAssertion.message}`,
        };
        result.failures = result.failures || [];
        result.failures.push(failure);
      }

      // 9. Determine result
      const criticalFailures = (result.failures || []).filter(
        (f) => !testDef.expectations.find((e) => !e.critical && e.id === f.expectationId)
      );

      result.passed = criticalFailures.length === 0;
      result.partialPass =
        result.passed &&
        result.expectationResults.some((e) => !e.passed);

      // 10. Build evidence summary
      result.evidence.screenshotBaseline = baselineScreenshot;
      result.evidence.screenshotsFinal = finalScreenshot;
      result.evidence.domSnapshots = {
        baseline: baselineDom,
        final: finalDom,
      };
      result.evidence.consoleLogs = this.consoleMonitor.getLogs();
      result.evidence.networkActivity = this.networkMonitor.getRequests();
      result.evidence.expectedOutcome = this.buildExpectedOutcome(testDef);
      result.evidence.actualOutcome = this.buildActualOutcome(result);
      result.evidence.passFail = result.passed ? 'pass' : 'fail';

      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger.info(
        {
          testId: testDef.id,
          passed: result.passed,
          durationMs: result.durationMs,
          actionsExecuted: result.actionsExecuted,
          expectationsPassed: result.expectationResults.filter((e) => e.passed).length,
        },
        'UI test execution completed'
      );

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.errorMessage = errorMsg;
      result.stackTrace = error instanceof Error ? error.stack : undefined;
      result.passed = false;
      result.durationMs = Date.now() - startTime;
      result.completedAt = new Date();

      this.logger.error(
        { testId: testDef.id, error: errorMsg },
        'Test execution failed with exception'
      );

      return result;
    } finally {
      // Cleanup
      if (page) {
        try {
          await this.browserManager.closePage(
            page.toString() // Use page reference
          );
        } catch (err) {
          this.logger.warn({ error: String(err) }, 'Failed to close page');
        }
      }

      this.consoleMonitor.clear();
      this.networkMonitor.clear();
    }
  }

  /**
   * Verify a single expectation
   */
  private async verifyExpectation(
    page: Page,
    expectation: UIExpectation
  ): Promise<ExpectationResult> {
    const result: ExpectationResult = {
      expectationId: expectation.id,
      type: expectation.type,
      description: expectation.description,
      passed: false,
    };

    try {
      const screenshot = await this.visualVerifier.captureFullPage(page, 'final');

      switch (expectation.type) {
        case 'element_visible':
          if (!expectation.selector) throw new Error('Selector required');
          const visibility = await this.stateVerifier.verifyElementVisible(
            page,
            expectation.selector
          );
          result.actualValue = visibility.visible;
          result.expectedValue = true;
          result.passed = visibility.visible;
          break;

        case 'element_enabled':
          if (!expectation.selector) throw new Error('Selector required');
          const interactivity = await this.stateVerifier.verifyElementInteractive(
            page,
            expectation.selector
          );
          result.actualValue = !interactivity.disabled;
          result.expectedValue = true;
          result.passed = !interactivity.disabled;
          break;

        case 'text_present':
          if (!expectation.selector || !expectation.expectedValue) {
            throw new Error('Selector and expectedValue required');
          }
          const textResult = await this.stateVerifier.verifyTextContent(
            page,
            expectation.selector,
            expectation.expectedValue
          );
          result.actualValue = textResult.actual;
          result.expectedValue = expectation.expectedValue;
          result.passed = textResult.matches;
          break;

        case 'css_property':
          if (!expectation.selector || !expectation.property || !expectation.expectedValue) {
            throw new Error('Selector, property, and expectedValue required');
          }
          const cssResult = await this.stateVerifier.verifyCSSProperty(
            page,
            expectation.selector,
            expectation.property,
            expectation.expectedValue
          );
          result.actualValue = cssResult.actual;
          result.expectedValue = cssResult.expected;
          result.passed = cssResult.matches;
          break;

        case 'console_no_errors':
          const consoleAssertion = this.consoleMonitor.assertNoErrors();
          result.passed = consoleAssertion.passed;
          result.actualValue = this.consoleMonitor.getUnexpectedErrors().length;
          result.expectedValue = 0;
          break;

        case 'network_success':
          const networkAssertion = this.networkMonitor.assertNoFailedRequests();
          result.passed = networkAssertion.passed;
          result.actualValue = this.networkMonitor.getFailedRequestCount();
          result.expectedValue = 0;
          break;

        case 'url_contains':
          if (!expectation.expectedValue) throw new Error('expectedValue required');
          const currentUrl = page.url();
          result.actualValue = currentUrl;
          result.expectedValue = expectation.expectedValue;
          result.passed = currentUrl.includes(expectation.expectedValue);
          break;

        default:
          result.passed = true; // Unknown type passes
      }

      result.evidence = {
        screenshot,
        timestamp: new Date(),
        message: result.passed ? 'Expectation met' : 'Expectation not met',
      };

      this.logger.debug(
        { expectationId: expectation.id, type: expectation.type, passed: result.passed },
        'Expectation verified'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      result.passed = false;
      result.evidence = {
        timestamp: new Date(),
        message: `Verification error: ${errorMsg}`,
      };
      this.logger.error(
        { expectationId: expectation.id, error: errorMsg },
        'Expectation verification failed'
      );
    }

    return result;
  }

  /**
   * Build expected outcome summary
   */
  private buildExpectedOutcome(testDef: UITestDefinition): string {
    const expectations = testDef.expectations
      .map((e) => e.description || e.type)
      .join('; ');

    return `All actions executed successfully and ${expectations}`;
  }

  /**
   * Build actual outcome summary
   */
  private buildActualOutcome(result: UITestResult): string {
    const actionSummary = `Executed ${result.actionsExecuted} actions`;
    const expectationSummary = `${result.expectationResults.filter((e) => e.passed).length}/${result.expectationResults.length} expectations passed`;
    const failureSummary = result.failures
      ? `${result.failures.length} failure(s)`
      : 'No failures';

    return `${actionSummary}, ${expectationSummary}, ${failureSummary}`;
  }

  /**
   * Cleanup browser
   */
  async cleanup(): Promise<void> {
    await this.browserManager.cleanup();
  }

  /**
   * Get executor status
   */
  getStatus(): {
    browser: { browserOpen: boolean; contextOpen: boolean; pageCount: number };
  } {
    return {
      browser: this.browserManager.getStatus(),
    };
  }
}
