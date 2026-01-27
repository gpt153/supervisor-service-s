/**
 * Integration Tests for UI Test Executor (Level 5 Verification)
 * Tests complete flow: browser automation -> action execution -> visual verification
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { pino } from 'pino';
import {
  UITestExecutor,
  BrowserManager,
  ActionExecutor,
  VisualVerifier,
  StateVerifier,
  ConsoleMonitor,
  NetworkMonitor,
} from '../../src/testing/ui/index.js';
import {
  UITestDefinition,
  BrowserConfig,
  ViewportConfig,
  DEFAULT_VIEWPORT,
} from '../../src/types/ui-testing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty',
  },
});

// Create temp directory for test artifacts
const testArtifactsDir = path.join(__dirname, '../../.test-artifacts/ui');

describe('UI Test Executor - Integration Tests', () => {
  beforeAll(async () => {
    await fs.mkdir(testArtifactsDir, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup test artifacts
    try {
      await fs.rm(testArtifactsDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('BrowserManager', () => {
    let browserManager: BrowserManager;

    afterEach(async () => {
      if (browserManager) {
        await browserManager.cleanup();
      }
    });

    it('should launch browser and create page', async () => {
      browserManager = new BrowserManager(
        {
          headless: true,
          browserType: 'chromium',
          viewport: DEFAULT_VIEWPORT,
        },
        logger
      );

      const page = await browserManager.createPage();
      expect(page).toBeDefined();

      const status = browserManager.getStatus();
      expect(status.browserOpen).toBe(true);
      expect(status.pageCount).toBe(1);
    });

    it('should manage browser context isolation', async () => {
      browserManager = new BrowserManager(
        {
          headless: true,
          browserType: 'chromium',
        },
        logger
      );

      const page1 = await browserManager.createPage('page-1');
      const page2 = await browserManager.createPage('page-2');

      expect(browserManager.getPage('page-1')).toBeDefined();
      expect(browserManager.getPage('page-2')).toBeDefined();

      await browserManager.closePage('page-1');

      expect(browserManager.getPage('page-1')).toBeUndefined();
      expect(browserManager.getPage('page-2')).toBeDefined();
    });

    it('should handle viewport configuration', async () => {
      browserManager = new BrowserManager(
        {
          headless: true,
          viewport: { width: 1024, height: 768 },
        },
        logger
      );

      const page = await browserManager.createPage();

      await browserManager.setViewport(page, {
        width: 1920,
        height: 1080,
      });

      const size = page.viewportSize();
      expect(size?.width).toBe(1920);
      expect(size?.height).toBe(1080);
    });
  });

  describe('ActionExecutor', () => {
    let browserManager: BrowserManager;
    let page: any;
    let executor: ActionExecutor;

    beforeEach(async () => {
      browserManager = new BrowserManager(
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
      page = await browserManager.createPage();
      executor = new ActionExecutor(logger);

      // Load a test HTML page
      await page.setContent(`
        <html>
          <body>
            <button id="test-button">Click Me</button>
            <input id="test-input" type="text" placeholder="Type here" />
            <div id="result" style="display:none;">Success!</div>
            <select id="test-select">
              <option value="">Select</option>
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
            </select>
          </body>
        </html>
      `);
    });

    afterEach(async () => {
      await browserManager.cleanup();
    });

    it('should execute click action', async () => {
      const result = await executor.execute(page, {
        type: 'click',
        selector: '#test-button',
      });

      expect(result.success).toBe(true);
      expect(result.durationMs).toBeGreaterThan(0);
    });

    it('should execute type action', async () => {
      const result = await executor.execute(page, {
        type: 'type',
        selector: '#test-input',
        value: 'test text',
      });

      expect(result.success).toBe(true);

      const inputValue = await page.locator('#test-input').inputValue();
      expect(inputValue).toBe('test text');
    });

    it('should execute fill action', async () => {
      await page.locator('#test-input').fill('initial');

      const result = await executor.execute(page, {
        type: 'fill',
        selector: '#test-input',
        value: 'new value',
      });

      expect(result.success).toBe(true);

      const inputValue = await page.locator('#test-input').inputValue();
      expect(inputValue).toBe('new value');
    });

    it('should handle action failures gracefully', async () => {
      const result = await executor.execute(page, {
        type: 'click',
        selector: '#nonexistent-button',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should get action descriptions', () => {
      const descriptions = [
        executor.getActionDescription({
          type: 'click',
          selector: '#button',
        }),
        executor.getActionDescription({
          type: 'type',
          selector: '#input',
          value: 'text',
        }),
        executor.getActionDescription({
          type: 'scroll',
          selector: 'bottom',
        }),
      ];

      descriptions.forEach((desc) => {
        expect(desc).toBeTruthy();
        expect(typeof desc).toBe('string');
      });
    });
  });

  describe('VisualVerifier', () => {
    let browserManager: BrowserManager;
    let page: any;
    let verifier: VisualVerifier;

    beforeEach(async () => {
      browserManager = new BrowserManager(
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
      page = await browserManager.createPage();
      verifier = new VisualVerifier(path.join(testArtifactsDir, 'screenshots'), logger);

      await page.setContent(`
        <html>
          <body>
            <h1>Test Page</h1>
            <button id="test-button">Click Me</button>
            <div id="content">Content Here</div>
          </body>
        </html>
      `);
    });

    afterEach(async () => {
      await browserManager.cleanup();
    });

    it('should capture full page screenshot', async () => {
      const screenshotPath = await verifier.captureFullPage(page, 'baseline');

      expect(screenshotPath).toBeTruthy();
      expect(screenshotPath).toContain('baseline');
      expect(screenshotPath).toContain('.png');

      // Verify file exists
      const fileExists = await fs
        .stat(screenshotPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should capture element screenshot', async () => {
      const screenshotPath = await verifier.captureElement(page, '#test-button', 'before');

      expect(screenshotPath).toBeTruthy();
      expect(screenshotPath).toContain('.png');

      const fileExists = await fs
        .stat(screenshotPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should verify visual consistency', async () => {
      const consistency = await verifier.verifyVisualConsistency(page, [
        'h1',
        '#test-button',
        '#content',
      ]);

      expect(consistency.consistent).toBe(true);
      expect(consistency.visibleElements.length).toBeGreaterThan(0);
      expect(consistency.hiddenElements.length).toBe(0);
    });

    it('should manage screenshots metadata', async () => {
      const screenshot1 = await verifier.captureFullPage(page, 'baseline');
      const screenshot2 = await verifier.captureFullPage(page, 'final');

      const allScreenshots = verifier.getScreenshots();
      expect(allScreenshots.size).toBe(2);

      const baselineScreenshots = verifier.getScreenshotsByPhase('baseline');
      expect(baselineScreenshots.length).toBe(1);
      expect(baselineScreenshots[0][0]).toBe(screenshot1);
    });
  });

  describe('StateVerifier', () => {
    let browserManager: BrowserManager;
    let page: any;
    let verifier: StateVerifier;

    beforeEach(async () => {
      browserManager = new BrowserManager(
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
      page = await browserManager.createPage();
      verifier = new StateVerifier(path.join(testArtifactsDir, 'dom'), logger);

      await page.setContent(`
        <html>
          <body>
            <button id="visible-button">Visible</button>
            <button id="hidden-button" style="display:none;">Hidden</button>
            <button id="disabled-button" disabled>Disabled</button>
            <input id="test-input" value="test value" />
            <p id="text-content">Hello World</p>
          </body>
        </html>
      `);
    });

    afterEach(async () => {
      await browserManager.cleanup();
    });

    it('should verify element visibility', async () => {
      const visibleState = await verifier.verifyElementVisible(page, '#visible-button');
      expect(visibleState.visible).toBe(true);

      const hiddenState = await verifier.verifyElementVisible(page, '#hidden-button');
      expect(hiddenState.visible).toBe(false);
    });

    it('should verify element interactivity', async () => {
      const interactiveState = await verifier.verifyElementInteractive(page, '#visible-button');
      expect(interactiveState.clickable).toBe(true);
      expect(interactiveState.disabled).toBe(false);

      const disabledState = await verifier.verifyElementInteractive(
        page,
        '#disabled-button'
      );
      expect(disabledState.disabled).toBe(true);
    });

    it('should verify CSS properties', async () => {
      const result = await verifier.verifyCSSProperty(
        page,
        '#visible-button',
        'display',
        'inline-block'
      );

      expect(result.matches).toBe(true);
    });

    it('should verify text content', async () => {
      const exactMatch = await verifier.verifyTextContent(
        page,
        '#text-content',
        'Hello World',
        'exact'
      );
      expect(exactMatch.matches).toBe(true);

      const contains = await verifier.verifyTextContent(
        page,
        '#text-content',
        'Hello',
        'contains'
      );
      expect(contains.matches).toBe(true);
    });

    it('should capture DOM state', async () => {
      const domPath = await verifier.captureDOMState(page, 'baseline');

      expect(domPath).toBeTruthy();
      expect(domPath).toContain('.html');

      const fileExists = await fs
        .stat(domPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should get element bounding box', async () => {
      const bbox = await verifier.getElementBoundingBox(page, '#visible-button');

      expect(bbox).toBeTruthy();
      expect(bbox?.x).toBeGreaterThanOrEqual(0);
      expect(bbox?.y).toBeGreaterThanOrEqual(0);
      expect(bbox?.width).toBeGreaterThan(0);
      expect(bbox?.height).toBeGreaterThan(0);
      expect(bbox?.visible).toBe(true);
    });

    it('should verify accessibility attributes', async () => {
      const accessibility = await verifier.verifyAccessibility(page, '#visible-button');

      expect(accessibility).toBeTruthy();
      expect(Array.isArray(accessibility.issues)).toBe(true);
    });
  });

  describe('ConsoleMonitor', () => {
    let browserManager: BrowserManager;
    let page: any;
    let monitor: ConsoleMonitor;

    beforeEach(async () => {
      browserManager = new BrowserManager(
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
      page = await browserManager.createPage();
      monitor = new ConsoleMonitor(logger);
      monitor.attachToPage(page);
    });

    afterEach(async () => {
      await browserManager.cleanup();
    });

    it('should capture console logs', async () => {
      await page.evaluate(() => {
        console.log('test log');
        console.warn('test warning');
        console.error('test error');
      });

      // Give time for logs to be captured
      await new Promise((resolve) => setTimeout(resolve, 100));

      const logs = monitor.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should filter logs by level', async () => {
      await page.evaluate(() => {
        console.log('info');
        console.error('error');
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const errors = monitor.getErrors();
      expect(errors.length).toBeGreaterThan(0);

      const errorFound = errors.some((e) => e.message.includes('error'));
      expect(errorFound).toBe(true);
    });

    it('should mark errors as expected', async () => {
      monitor.expectError('expected error');

      await page.evaluate(() => {
        console.error('expected error message');
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const unexpected = monitor.getUnexpectedErrors();
      // Should not include expected error
      const hasUnexpected = unexpected.some((e) => e.message.includes('expected error'));
      expect(hasUnexpected).toBeFalsy();
    });

    it('should assert no errors', async () => {
      const assertion = monitor.assertNoErrors();
      expect(assertion.passed).toBe(true);
    });

    it('should generate report', async () => {
      const report = monitor.getReport();

      expect(report).toContain('CONSOLE MONITORING REPORT');
      expect(report).toContain('Total Logs');
      expect(report).toContain('Errors');
    });
  });

  describe('NetworkMonitor', () => {
    let browserManager: BrowserManager;
    let page: any;
    let monitor: NetworkMonitor;

    beforeEach(async () => {
      browserManager = new BrowserManager(
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
      page = await browserManager.createPage();
      monitor = new NetworkMonitor(logger);
      monitor.attachToPage(page);
    });

    afterEach(async () => {
      await browserManager.cleanup();
    });

    it('should capture network requests', async () => {
      // Create a simple test server response
      await page.goto('about:blank');

      const requests = monitor.getRequests();
      expect(Array.isArray(requests)).toBe(true);
    });

    it('should get summary', () => {
      const summary = monitor.getSummary();

      expect(summary).toBeTruthy();
      expect(typeof summary.totalRequests).toBe('number');
      expect(typeof summary.successful).toBe('number');
      expect(typeof summary.failed).toBe('number');
      expect(typeof summary.byMethod).toBe('object');
    });

    it('should assert no failed requests', () => {
      const assertion = monitor.assertNoFailedRequests();
      expect(assertion).toBeTruthy();
      expect(typeof assertion.passed).toBe('boolean');
    });

    it('should generate report', () => {
      const report = monitor.getReport();

      expect(report).toContain('NETWORK MONITORING REPORT');
      expect(report).toContain('Total Requests');
    });
  });

  describe('UITestExecutor - Complete Flow', () => {
    let executor: UITestExecutor;

    beforeEach(() => {
      executor = new UITestExecutor(
        path.join(testArtifactsDir, 'complete-flow'),
        { headless: true, viewport: DEFAULT_VIEWPORT },
        logger
      );
    });

    afterEach(async () => {
      await executor.cleanup();
    });

    it('should execute complete test with actions and expectations', async () => {
      const testDef: UITestDefinition = {
        id: 'test-001',
        name: 'Complete Test',
        description: 'Test button click and text verification',
        url: 'about:blank',
        viewport: DEFAULT_VIEWPORT,
        actions: [
          {
            type: 'click',
            selector: 'body',
            screenshotBefore: true,
            screenshotAfter: true,
          },
        ],
        expectations: [
          {
            type: 'console_no_errors',
            description: 'No console errors',
            critical: true,
          },
        ],
      };

      const result = await executor.executeTest(testDef);

      expect(result.testId).toBe('test-001');
      expect(result.passed).toBe(true);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.evidence).toBeTruthy();
      expect(result.evidence.passFail).toBe('pass');
    });

    it('should collect complete evidence', async () => {
      const testDef: UITestDefinition = {
        id: 'test-002',
        name: 'Evidence Collection Test',
        description: 'Verify evidence collection',
        url: 'about:blank',
        viewport: DEFAULT_VIEWPORT,
        actions: [],
        expectations: [
          {
            type: 'console_no_errors',
            critical: true,
          },
        ],
      };

      const result = await executor.executeTest(testDef);

      // Verify evidence structure
      expect(result.evidence.screenshotBefore).toBeDefined();
      expect(result.evidence.screenshotsFinal).toBeDefined();
      expect(result.evidence.consoleLogs).toBeDefined();
      expect(result.evidence.networkActivity).toBeDefined();
      expect(Array.isArray(result.evidence.consoleLogs)).toBe(true);
      expect(Array.isArray(result.evidence.networkActivity)).toBe(true);
    });
  });
});
