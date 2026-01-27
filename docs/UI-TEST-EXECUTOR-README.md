# UI Test Executor - Level 5 Verification Framework

## Overview

The UI Test Executor solves a critical problem reported by users:

> "Agents claim 98% of tests pass, but in reality only 2% works. Agents fake button presses and never verify visual outcomes."

This framework implements **Level 5 Verification** - comprehensive UI testing that proves visual state changes with screenshots, not just code inspection.

## Level 5 Verification Explained

### Traditional Testing (Level 1-4) - The Problem

```typescript
// WRONG: What agents currently do (Level 1-3 only)
const button = await page.locator('.submit-button');
expect(button).toBeTruthy(); // ✓ Element exists in DOM (Level 1)
expect(button).toBeVisible(); // ✓ Element visible (Level 2)
expect(button).toBeEnabled(); // ✓ Element enabled (Level 3)
await button.click(); // ✓ Action executed (Level 4)

// Missing: Did anything actually happen? Blank page? Network failure?
// User never sees this test fail even when button is broken!
```

### Level 5 Verification - The Solution

```typescript
// RIGHT: What Level 5 does (Complete verification)
const screenshotBefore = await page.screenshot();
const button = await page.locator('.submit-button');
expect(button).toBeVisible(); // Level 2
expect(button).toBeEnabled(); // Level 3
await button.click(); // Level 4

// Level 5: Prove something actually changed
const screenshotAfter = await page.screenshot();
await expect(page.locator('h1')).toContainText('Dashboard'); // Visual result
await expect(page.locator('.data-table')).toBeVisible(); // Data loaded
expect(consoleLogs).toHaveNoneErrors(); // No JS errors hiding failure
expect(networkRequests).toHaveNoFailures(); // API calls succeeded

// Evidence proves: Button press → page navigation → data loaded
```

## Architecture

### Core Components

```
UITestExecutor (Main Orchestrator)
├── BrowserManager        - Playwright browser/page lifecycle
├── ActionExecutor        - Execute user actions (click, type, scroll, hover, drag)
├── VisualVerifier        - Screenshot capture, visual diffs
├── StateVerifier         - Verify rendered state (CSS, visibility, interactivity)
├── ConsoleMonitor        - Capture console logs, auto-fail on errors
└── NetworkMonitor        - Capture network requests/responses
```

### Type Definitions

```typescript
// Complete schema in: src/types/ui-testing.ts

interface UITestDefinition {
  id: string;
  name: string;
  url: string;
  viewport: { width: number; height: number };
  actions: UIAction[];           // Click, type, scroll, hover, drag, keyboard
  expectations: UIExpectation[]; // Visibility, text, CSS, network, console
}

interface UIAction {
  type: 'click' | 'type' | 'fill' | 'scroll' | 'hover' | 'drag' | 'keyboard';
  selector: string;
  value?: string;
  screenshotBefore?: boolean;   // CRITICAL: Baseline
  screenshotAfter?: boolean;    // CRITICAL: Result
  waitAfter?: WaitCondition;
}

interface UIExpectation {
  type: 'element_visible' | 'text_present' | 'css_property' | 'console_no_errors' | 'network_success';
  selector?: string;
  expectedValue?: any;
  critical?: boolean;
}

interface UITestEvidence {
  screenshotBefore?: string;     // Full page baseline
  screenshotAfter?: string;      // Full page final
  elementScreenshots?: {         // Element-specific before/after
    [key: string]: { before?: string; after?: string };
  };
  consoleLogs: ConsoleLog[];
  networkActivity: NetworkActivity[];
  domSnapshots?: { baseline?: string; final?: string };
  passFail: 'pass' | 'fail';
}
```

## File Structure

```
src/testing/ui/
├── BrowserManager.ts          - Browser lifecycle management
├── ActionExecutor.ts          - User action execution
├── VisualVerifier.ts          - Screenshot capture, visual diffs
├── StateVerifier.ts           - Rendered state verification
├── ConsoleMonitor.ts          - Console log monitoring
├── NetworkMonitor.ts          - Network request monitoring
├── UITestExecutor.ts          - Main orchestrator
└── index.ts                   - Exports

src/types/ui-testing.ts        - Complete type definitions

tests/integration/ui-test-executor.test.ts - Integration tests

src/examples/ui-test-example.ts - Usage examples
```

## Usage

### Basic Test

```typescript
import { UITestExecutor } from './src/testing/ui/index.js';

const executor = new UITestExecutor(
  '/tmp/ui-test-evidence',
  { headless: true, browserType: 'chromium' },
  logger
);

const result = await executor.executeTest({
  id: 'login-test',
  name: 'Login Flow',
  url: 'https://example.com/login',
  viewport: { width: 1920, height: 1080 },

  actions: [
    {
      type: 'fill',
      selector: 'input[name="email"]',
      value: 'user@example.com',
      screenshotBefore: true,
      screenshotAfter: true,
    },
    {
      type: 'fill',
      selector: 'input[name="password"]',
      value: 'password123',
      screenshotBefore: true,
      screenshotAfter: true,
    },
    {
      type: 'click',
      selector: 'button[type="submit"]',
      screenshotBefore: true,
      screenshotAfter: true,
      waitAfter: { type: 'url', urlPattern: '.*/dashboard' },
    },
  ],

  expectations: [
    {
      type: 'url_contains',
      expectedValue: '/dashboard',
      critical: true,
    },
    {
      type: 'text_present',
      selector: 'h1',
      expectedValue: 'Welcome',
      critical: true,
    },
    {
      type: 'console_no_errors',
      critical: true,
    },
    {
      type: 'network_success',
      critical: true,
    },
  ],
});

console.log({
  passed: result.passed,
  durationMs: result.durationMs,
  screenshotBefore: result.evidence.screenshotBefore,
  screenshotAfter: result.evidence.screenshotsFinal,
  consoleLogs: result.evidence.consoleLogs,
  networkActivity: result.evidence.networkActivity,
});

await executor.cleanup();
```

### Advanced: Custom Expectations

```typescript
expectations: [
  {
    id: 'button-clickable',
    type: 'element_enabled',
    selector: '.action-button',
    critical: true,
  },
  {
    id: 'content-visible',
    type: 'element_visible',
    selector: '.data-table',
    critical: true,
  },
  {
    id: 'correct-color',
    type: 'css_property',
    selector: '.status-badge',
    property: 'color',
    expectedValue: 'rgb(0, 128, 0)',
    critical: false,
  },
  {
    id: 'data-loaded',
    type: 'text_present',
    selector: '.row-count',
    expectedValue: /(\d+) rows/,
    critical: true,
  },
]
```

## Key Features

### 1. Complete Action Support

- **Click**: Click buttons, links, elements
- **Type**: Type text with optional delay
- **Fill**: Clear and fill input fields
- **Scroll**: Scroll to elements or by pixels
- **Hover**: Hover over elements (tooltips, dropdowns)
- **Drag**: Drag and drop elements
- **Keyboard**: Press keys and key combinations
- **Select**: Select dropdown options
- **Check/Uncheck**: Toggle checkboxes

### 2. Comprehensive Verification

#### Element State
- Visibility (display, visibility, opacity, in viewport)
- Interactivity (clickable, enabled, not covered)
- CSS properties (color, size, position)
- Text content (exact, contains, regex)
- Layout position (bounding box)

#### Page State
- Console logs (capture, filter, assert)
- Network requests (capture, validate, check failures)
- Performance metrics (LCP, FCP, TTI)
- Accessibility (ARIA labels, roles, keyboard nav)

#### Visual Evidence
- Full page screenshots (with scroll)
- Element-specific screenshots (cropped)
- Before/after comparison
- DOM snapshots (HTML for comparison)

### 3. Automatic Failure Detection

```typescript
// Auto-fails test on:
- Unexpected console errors (unless explicitly expected)
- Failed network requests (4xx, 5xx)
- Element not visible when clicked
- Action timeout
- Navigation failure
- Missing visual evidence
```

### 4. Evidence Storage

All evidence is organized by test:
```
/evidence/
├── screenshots/
│   ├── baseline-fullpage-1234567.png
│   ├── before-action-element-submit-btn-1234567.png
│   ├── after-action-element-submit-btn-1234568.png
│   └── final-fullpage-1234568.png
├── dom-snapshots/
│   ├── dom-baseline-1234567.html
│   └── dom-final-1234568.html
└── metadata/
    └── test-result-1234567.json
```

## Test Result Structure

```typescript
interface UITestResult {
  testId: string;
  testName: string;
  passed: boolean;
  partialPass?: boolean;
  durationMs: number;
  actionsExecuted: number;
  expectationResults: ExpectationResult[];
  failures?: TestFailure[];

  evidence: {
    screenshotBefore?: string;
    screenshotsFinal?: string;
    elementScreenshots?: { [key: string]: { before?: string; after?: string } };
    consoleLogs: ConsoleLog[];
    networkActivity: NetworkActivity[];
    domSnapshots?: { baseline?: string; final?: string };
    expectedOutcome: string;
    actualOutcome: string;
    passFail: 'pass' | 'fail';
  };

  errorMessage?: string;
  stackTrace?: string;
}
```

## Debugging Tips

### Check Screenshots

Always examine the before/after screenshots:

```typescript
const result = await executor.executeTest(test);

// Before action
console.log('Before:', result.evidence.screenshotBefore);

// After action
console.log('After:', result.evidence.screenshotsFinal);

// Element-specific
console.log('Element before:', result.evidence.elementScreenshots?.['#button']?.before);
console.log('Element after:', result.evidence.elementScreenshots?.['#button']?.after);
```

### Console Logs

Check what the app actually said:

```typescript
console.log('Unexpected errors:', result.evidence.consoleLogs
  .filter(log => log.level === 'error'));

console.log('Warnings:', result.evidence.consoleLogs
  .filter(log => log.level === 'warning'));
```

### Network Requests

Check what API calls were made:

```typescript
console.log('Failed requests:', result.evidence.networkActivity
  .filter(req => req.statusCode >= 400));

console.log('POST requests:', result.evidence.networkActivity
  .filter(req => req.method === 'POST'));
```

### DOM Snapshots

Compare HTML before and after:

```bash
diff dom-baseline-1234567.html dom-final-1234568.html
```

## Common Issues

### Issue: "Test passes but page looks wrong"

**Solution**: Add visual expectations:
```typescript
{
  type: 'text_present',
  selector: '.error-message',
  expectedValue: '',  // Should be empty
  critical: true,
}
```

### Issue: "Test hangs waiting for element"

**Solution**: Set explicit timeout:
```typescript
{
  type: 'click',
  selector: '.button',
  timeout: 5000,  // 5 second timeout
  waitAfter: { type: 'networkidle', timeout: 3000 },
}
```

### Issue: "Screenshot dir fills up"

**Solution**: Use cleanup:
```typescript
// Cleanup old screenshots after 7 days
await visualVerifier.cleanupOldScreenshots(7);
```

### Issue: "Test flaky - sometimes passes, sometimes fails"

**Solution**: Add explicit waits:
```typescript
{
  type: 'fill',
  selector: '#input',
  value: 'text',
  waitAfter: { type: 'element', selector: '.validation-ok' },
}
```

## Performance

- **Typical test execution**: 10-30 seconds (including screenshots)
- **Screenshot capture**: 1-2 seconds per screenshot
- **Evidence file size**: ~2-5 MB per test (screenshots)
- **Parallel execution**: Supported (isolated browser contexts)

## Integration with Existing Code

### UIEvidenceCollector Integration

```typescript
import { UIEvidenceCollector } from './src/evidence/UIEvidenceCollector.js';

const result = await executor.executeTest(testDef);

// Save evidence
const collected = await evidenceCollector.collectUITestEvidence({
  testId: result.testId,
  testName: result.testName,
  screenshotBefore: result.evidence.screenshotBefore,
  screenshotAfter: result.evidence.screenshotsFinal,
  domBefore: result.evidence.domSnapshots?.baseline,
  domAfter: result.evidence.domSnapshots?.final,
  consoleLogs: result.evidence.consoleLogs,
  networkActivity: result.evidence.networkActivity,
  expectedOutcome: result.evidence.expectedOutcome,
  actualOutcome: result.evidence.actualOutcome,
  passFail: result.evidence.passFail,
  url: testDef.url,
  action: result.actionsExecuted.toString(),
});
```

### Red Flag Detection Integration

Evidence from UI tests feeds directly into Red Flag Detection (Epic 006-B):

```typescript
// Red flag detector analyzes:
- Unexpected console errors (log parsing)
- Failed network requests (API failures)
- Missing visual evidence (incomplete screenshots)
- DOM changes (HTML diffs)
- Performance degradation (timing analysis)
```

## Testing

### Run Integration Tests

```bash
npm test -- tests/integration/ui-test-executor.test.ts
```

### Run Specific Test Suite

```bash
npm test -- tests/integration/ui-test-executor.test.ts -t "BrowserManager"
```

## Future Enhancements

1. **Visual Regression Detection**
   - Pixel-level diff generation (using pixelmatch)
   - Threshold-based failure detection
   - Historical baseline comparison

2. **Advanced Accessibility**
   - axe-core integration
   - WCAG compliance checking
   - Keyboard navigation testing

3. **Performance Profiling**
   - Lighthouse integration
   - Core Web Vitals tracking
   - Custom metric collection

4. **Distributed Execution**
   - Test result aggregation
   - Cross-browser testing (Edge, Firefox, Safari)
   - Parallel test execution

## References

- **Playwright Documentation**: https://playwright.dev
- **Type Definitions**: `src/types/ui-testing.ts`
- **Examples**: `src/examples/ui-test-example.ts`
- **Integration Tests**: `tests/integration/ui-test-executor.test.ts`
- **Epic 006-A (Evidence Collection)**: Base framework for artifact storage
- **Epic 006-B (Red Flag Detection)**: Analyzes UI test evidence

## Author

Meta-Supervisor (MS) - Supervisor Service
Part of automatic-quality-workflows feature

---

**Key Principle**: Level 5 Verification means never claiming a test passes without visual proof. Screenshots are truth.
