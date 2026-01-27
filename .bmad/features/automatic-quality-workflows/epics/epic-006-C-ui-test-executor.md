# Epic 006-C: UI Test Executor with Level 5 Verification

**Epic ID:** 006-C
**Feature:** automatic-quality-workflows
**Created:** 2026-01-27
**Status:** Pending
**Complexity:** High (90-110 hours)
**Model:** Haiku for execution, Sonnet for complex UI reasoning

---

## Rationale

**Problem:** Current validation agents claim UI tests pass without actually performing user actions or verifying visual outcomes. Research shows agents skip browser automation, fake screenshots, or report success based on DOM inspection alone.

**Research Findings:**
- **Level 5 verification required**: Must verify visual/interactive layer (screenshots, user actions, rendered state)
- **Agents shortcut UI testing**: Check if element exists in DOM instead of verifying it's visible/interactive
- **Missing user perspective**: Tests don't validate what user actually sees/experiences
- **No visual regression detection**: Can't catch layout breaks, styling issues, rendering errors

**Solution:** Build a comprehensive UI test executor that:
1. **Executes real browser automation** (Playwright/Puppeteer)
2. **Captures visual evidence** (screenshots before/after every action)
3. **Verifies interactive behavior** (click, type, scroll, hover)
4. **Validates rendered state** (CSS, layout, visibility, accessibility)
5. **Collects comprehensive evidence** (DOM, console, network, screenshots)

**Why Level 5:** UI tests must verify what users see, not just what's in the code. DOM presence ≠ visual presence.

---

## Acceptance Criteria

### AC1: Browser Automation Framework
- [ ] Playwright integration for Chrome/Firefox/Safari
- [ ] Headless mode for CI, headed mode for debugging
- [ ] Browser context isolation per test (clean state)
- [ ] Viewport configuration (desktop, tablet, mobile)
- [ ] Network interception for API mocking

### AC2: User Action Execution
- [ ] Click actions with wait-for-element
- [ ] Text input with validation
- [ ] Form submission with success verification
- [ ] Scroll actions with viewport tracking
- [ ] Hover actions with tooltip verification
- [ ] Drag-and-drop with position validation
- [ ] Keyboard shortcuts (Ctrl+C, Escape, etc.)

### AC3: Visual Evidence Collection (Level 5)
- [ ] Screenshot before action (baseline)
- [ ] Screenshot after action (result)
- [ ] Full page screenshots (scroll capture)
- [ ] Element-specific screenshots (cropped)
- [ ] Visual diff generation (before vs after)
- [ ] Screenshot storage with metadata (timestamp, viewport, URL)

### AC4: Rendered State Verification
- [ ] Verify element visibility (not just DOM presence)
- [ ] Verify element interactivity (not disabled, not covered)
- [ ] Verify CSS properties (color, size, position, z-index)
- [ ] Verify text content (exact match, regex, contains)
- [ ] Verify layout (element positions relative to each other)
- [ ] Verify accessibility (ARIA labels, roles, keyboard navigation)

### AC5: Console & Network Monitoring
- [ ] Capture console logs (errors, warnings, info, debug)
- [ ] Capture network requests (XHR, fetch, WebSocket)
- [ ] Capture network responses (status, headers, body, timing)
- [ ] Detect console errors (auto-fail test)
- [ ] Detect failed network requests (4xx, 5xx)
- [ ] Track page load performance (LCP, FCP, TTI)

### AC6: Test Result Validation
- [ ] Compare actual vs expected outcomes (visual, behavioral, data)
- [ ] Generate pass/fail with evidence paths
- [ ] Auto-fail on console errors (unless explicitly expected)
- [ ] Auto-fail on missing visual evidence
- [ ] Support partial success (some actions passed, some failed)

---

## Files to Create/Modify

```
supervisor-service-s/src/
├── testing/
│   ├── ui/
│   │   ├── UITestExecutor.ts        # NEW - Main UI test orchestrator
│   │   ├── BrowserManager.ts        # NEW - Playwright browser lifecycle
│   │   ├── ActionExecutor.ts        # NEW - Execute user actions (click, type, etc.)
│   │   ├── VisualVerifier.ts        # NEW - Screenshot capture, visual diff
│   │   ├── StateVerifier.ts         # NEW - Verify rendered state (CSS, layout, visibility)
│   │   ├── ConsoleMonitor.ts        # NEW - Capture console logs
│   │   ├── NetworkMonitor.ts        # NEW - Capture network activity
│   │   └── AccessibilityChecker.ts  # NEW - Verify ARIA, keyboard nav

├── evidence/
│   └── UIEvidenceCollector.ts       # MODIFY - Integrate with UITestExecutor

└── types/
    └── ui-testing.ts                 # NEW - UI test type definitions

.claude/commands/subagents/testing/
├── execute-ui-test.md                # NEW - UI test execution agent
└── validate-ui-evidence.md           # NEW - UI evidence validation agent

tests/integration/
└── ui-test-executor.test.ts          # NEW - Integration tests for UI testing
```

---

## Implementation Notes

### UI Test Definition Schema

```typescript
interface UITest {
  id: string;
  name: string;
  description: string;
  url: string;
  viewport: { width: number; height: number }; // e.g., {1920, 1080}

  actions: UIAction[];
  expectedOutcomes: UIExpectation[];
}

interface UIAction {
  type: 'click' | 'type' | 'scroll' | 'hover' | 'drag' | 'keyboard';
  selector: string; // CSS selector or XPath
  value?: string; // for 'type' action
  waitFor?: string; // Wait for element after action
  screenshotBefore: boolean;
  screenshotAfter: boolean;
}

interface UIExpectation {
  type: 'element_visible' | 'text_present' | 'css_property' | 'network_request' | 'console_log';
  selector?: string;
  property?: string;
  expectedValue: any;
  actualValue?: any; // filled during execution
  passed?: boolean;
}
```

### Test Execution Flow

```typescript
class UITestExecutor {
  async executeTest(test: UITest): Promise<UITestResult> {
    // 1. Setup
    const browser = await this.browserManager.launch();
    const page = await browser.newPage();
    await page.setViewportSize(test.viewport);

    // 2. Navigation
    await page.goto(test.url);
    const screenshotBaseline = await this.visualVerifier.captureFullPage(page);

    // 3. Execute actions with evidence collection
    for (const action of test.actions) {
      // Screenshot before
      if (action.screenshotBefore) {
        await this.visualVerifier.captureElement(page, action.selector, 'before');
      }

      // Execute action
      await this.actionExecutor.execute(page, action);

      // Screenshot after
      if (action.screenshotAfter) {
        await this.visualVerifier.captureElement(page, action.selector, 'after');
      }

      // Wait for stability
      await page.waitForLoadState('networkidle');
    }

    // 4. Verify expectations
    const results = await this.verifyExpectations(page, test.expectedOutcomes);

    // 5. Collect evidence
    const evidence = {
      screenshots: this.visualVerifier.getScreenshots(),
      consoleLogs: this.consoleMonitor.getLogs(),
      networkActivity: this.networkMonitor.getRequests(),
      domSnapshots: await this.stateVerifier.captureDOMState(page)
    };

    // 6. Cleanup
    await browser.close();

    return {
      testId: test.id,
      passed: results.every(r => r.passed),
      evidence,
      results
    };
  }
}
```

### Visual Verification Pattern

```typescript
class VisualVerifier {
  async captureFullPage(page: Page): Promise<string> {
    const timestamp = Date.now();
    const filePath = `/evidence/${this.epicId}/ui/${timestamp}/fullpage.png`;

    await page.screenshot({
      path: filePath,
      fullPage: true
    });

    return filePath;
  }

  async captureElement(page: Page, selector: string, phase: 'before' | 'after'): Promise<string> {
    const element = await page.$(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    const timestamp = Date.now();
    const filePath = `/evidence/${this.epicId}/ui/${timestamp}/${phase}-${selector.replace(/[^a-z0-9]/gi, '_')}.png`;

    await element.screenshot({ path: filePath });

    return filePath;
  }

  async generateVisualDiff(beforePath: string, afterPath: string): Promise<string> {
    // Use pixelmatch or similar library
    const diff = await this.pixelDiff(beforePath, afterPath);
    const diffPath = beforePath.replace('before', 'diff');
    await diff.save(diffPath);
    return diffPath;
  }
}
```

### State Verification Pattern

```typescript
class StateVerifier {
  async verifyElementVisible(page: Page, selector: string): Promise<boolean> {
    const element = await page.$(selector);
    if (!element) return false;

    // Check DOM presence
    const exists = await element.isVisible();

    // Check CSS visibility
    const display = await element.evaluate(el => window.getComputedStyle(el).display);
    const visibility = await element.evaluate(el => window.getComputedStyle(el).visibility);
    const opacity = await element.evaluate(el => window.getComputedStyle(el).opacity);

    return exists && display !== 'none' && visibility !== 'hidden' && parseFloat(opacity) > 0;
  }

  async verifyElementInteractive(page: Page, selector: string): Promise<boolean> {
    const element = await page.$(selector);
    if (!element) return false;

    // Check if clickable
    const isClickable = await element.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(x, y);
      return topElement === el || el.contains(topElement);
    });

    // Check if disabled
    const isDisabled = await element.evaluate(el =>
      el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    );

    return isClickable && !isDisabled;
  }

  async verifyCSSProperty(page: Page, selector: string, property: string, expectedValue: string): Promise<boolean> {
    const element = await page.$(selector);
    if (!element) return false;

    const actualValue = await element.evaluate((el, prop) =>
      window.getComputedStyle(el).getPropertyValue(prop),
      property
    );

    return actualValue === expectedValue;
  }
}
```

---

## Model Selection

**Test Execution:** Haiku
- Browser automation is deterministic (clear Playwright API)
- Evidence collection is mechanical (screenshots, logs)
- Action execution follows clear patterns
- Fast execution critical for test suites

**Complex UI Reasoning:** Sonnet
- Understanding visual outcomes (does this look correct?)
- Interpreting layout issues (is element properly positioned?)
- Analyzing console errors (is this expected or a bug?)
- Making judgment calls on partial success

**Workflow:**
1. Haiku executes all tests, collects evidence
2. Sonnet reviews failed tests for false positives
3. Sonnet analyzes visual diffs for regression detection

---

## Estimated Effort

- **Playwright integration**: 12 hours
- **BrowserManager (lifecycle, contexts)**: 10 hours
- **ActionExecutor (all action types)**: 20 hours
- **VisualVerifier (screenshots, diffs)**: 16 hours
- **StateVerifier (visibility, interactivity, CSS)**: 16 hours
- **ConsoleMonitor**: 8 hours
- **NetworkMonitor**: 10 hours
- **AccessibilityChecker**: 12 hours
- **Evidence integration**: 10 hours
- **Unit tests**: 24 hours
- **Integration tests**: 22 hours

**Total: 160 hours (4 weeks)**

---

## Dependencies

**Blocked By:**
- Epic 006-A (Evidence Collection - needs UIEvidenceCollector)

**Blocks:**
- Epic 006-G (Test Orchestrator - needs UI executor component)

---

## Testing Approach

### Unit Tests

**ActionExecutor:**
- [ ] Click actions (success, element not found, not clickable)
- [ ] Type actions (input fields, textareas, content-editable)
- [ ] Scroll actions (by pixels, to element, to bottom)
- [ ] Hover actions (trigger tooltips, dropdowns)
- [ ] Drag-and-drop (draggable elements)

**VisualVerifier:**
- [ ] Full page screenshots (with scroll)
- [ ] Element screenshots (cropped, not found)
- [ ] Visual diff generation (identical, changed, new elements)

**StateVerifier:**
- [ ] Element visibility (DOM present, CSS hidden, covered by other element)
- [ ] Element interactivity (clickable, disabled, behind overlay)
- [ ] CSS property verification (color, size, position)
- [ ] Text content verification (exact, regex, contains)

### Integration Tests

**End-to-End UI Test:**
1. Launch browser
2. Navigate to test page
3. Execute action sequence (click button → fill form → submit)
4. Capture screenshots at each step
5. Verify expected outcomes (success message visible)
6. Collect all evidence (screenshots, console, network)
7. Verify evidence completeness
8. Generate test report

**Visual Regression Test:**
1. Capture baseline screenshot
2. Make CSS change
3. Capture new screenshot
4. Generate visual diff
5. Verify diff detected changes
6. Verify diff highlights changed pixels

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Flaky tests** (timing issues) | False failures | Smart waits (networkidle, element visible), retry logic, timeouts |
| **Browser crashes** | Test suite fails | Auto-restart, isolate tests, resource limits |
| **Screenshot storage** (large files) | Disk space | Compression (PNG optimize), retention policy, archive old tests |
| **Slow execution** | Long test cycles | Parallel browsers, headless mode, test prioritization |

---

## Success Metrics

- **Test execution reliability**: 95% success rate (no flaky failures)
- **Evidence completeness**: 100% of tests have screenshots + logs
- **Visual regression detection**: Catch 100% of layout/styling changes
- **Execution speed**: <30 seconds per test (including evidence collection)
- **False negative rate**: 0% (never report pass without evidence)

---

**Next Steps After Completion:**
1. Integrate with test orchestrator (Epic 006-G)
2. Create UI test library for common patterns (login, form submission, etc.)
3. Build visual regression dashboard

---

**References:**
- Playwright documentation: https://playwright.dev
- Level 5 verification requirements
- Evidence collection framework (Epic 006-A)
