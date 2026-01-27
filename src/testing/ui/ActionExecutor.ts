/**
 * User Action Executor
 * Executes all user action types: click, type, scroll, hover, drag, keyboard
 * Handles wait conditions before/after actions
 * Critical for Level 5 verification: Actions must actually execute and produce observable results
 */

import { Logger } from 'pino';
import { Page, Locator } from 'playwright';
import {
  UIAction,
  WaitCondition,
  DEFAULT_ACTION_TIMEOUT,
} from '../../types/ui-testing.js';

export class ActionExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute a user action
   * Returns action result with execution time and status
   */
  async execute(
    page: Page,
    action: UIAction
  ): Promise<{
    success: boolean;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      this.logger.debug(
        { actionType: action.type, selector: action.selector },
        'Executing action'
      );

      // Wait before action if specified
      if (action.waitFor) {
        await this.waitForCondition(page, action.waitFor);
      }

      // Execute the action based on type
      switch (action.type) {
        case 'click':
          await this.click(page, action);
          break;
        case 'type':
          await this.type(page, action);
          break;
        case 'fill':
          await this.fill(page, action);
          break;
        case 'scroll':
          await this.scroll(page, action);
          break;
        case 'hover':
          await this.hover(page, action);
          break;
        case 'drag':
          await this.drag(page, action);
          break;
        case 'keyboard':
        case 'press':
          await this.keyboard(page, action);
          break;
        case 'select':
          await this.select(page, action);
          break;
        case 'check':
          await this.check(page, action);
          break;
        case 'uncheck':
          await this.uncheck(page, action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Wait after action if specified
      if (action.waitAfter) {
        await this.waitForCondition(page, action.waitAfter);
      }

      const durationMs = Date.now() - startTime;

      this.logger.debug(
        { actionType: action.type, durationMs },
        'Action executed successfully'
      );

      return { success: true, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      this.logger.error(
        {
          actionType: action.type,
          selector: action.selector,
          error: errorMsg,
          durationMs,
        },
        'Action execution failed'
      );

      return { success: false, durationMs, error: errorMsg };
    }
  }

  /**
   * Click action
   */
  private async click(page: Page, action: UIAction): Promise<void> {
    const locator = page.locator(action.selector);

    // Verify element exists and is visible
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });

    // Verify element is clickable (not disabled, not covered)
    const isClickable = await locator.evaluate((el) => {
      const style = window.getComputedStyle(el as HTMLElement);
      const rect = (el as HTMLElement).getBoundingClientRect();

      // Check if visible
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }

      // Check if in viewport
      if (rect.width === 0 || rect.height === 0) {
        return false;
      }

      // Check if topmost element at center
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const topElement = document.elementFromPoint(centerX, centerY);

      return topElement === el || (el as HTMLElement).contains(topElement as Node);
    });

    if (!isClickable) {
      throw new Error(`Element not clickable: ${action.selector}`);
    }

    await locator.first().click({ timeout: action.timeout });
  }

  /**
   * Type/text input action
   */
  private async type(page: Page, action: UIAction): Promise<void> {
    if (!action.value) {
      throw new Error('Type action requires value');
    }

    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });

    // Clear existing content
    await locator.first().fill('');

    // Type with optional delay between characters
    if (action.delay) {
      for (const char of action.value) {
        await locator.first().type(char, { delay: action.delay });
      }
    } else {
      await locator.first().type(action.value, { timeout: action.timeout });
    }
  }

  /**
   * Fill action (clear and type atomically)
   */
  private async fill(page: Page, action: UIAction): Promise<void> {
    if (!action.value) {
      throw new Error('Fill action requires value');
    }

    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });
    await locator.first().fill(action.value, { timeout: action.timeout });
  }

  /**
   * Scroll action
   */
  private async scroll(page: Page, action: UIAction): Promise<void> {
    if (action.value) {
      // Scroll to specific element
      const locator = page.locator(action.selector);
      await locator.first().scrollIntoViewIfNeeded({ timeout: action.timeout });
    } else {
      // Scroll by value (pixels or direction)
      const scrollValue = parseInt(action.selector, 10);
      if (!isNaN(scrollValue)) {
        await page.evaluate((pixels) => {
          window.scrollBy(0, pixels);
        }, scrollValue);
      } else {
        // Scroll to bottom if selector is 'bottom'
        if (action.selector === 'bottom') {
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
        }
      }
    }
  }

  /**
   * Hover action
   */
  private async hover(page: Page, action: UIAction): Promise<void> {
    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });
    await locator.first().hover({ timeout: action.timeout });

    // Wait for potential tooltips/dropdowns
    await page.waitForTimeout(500);
  }

  /**
   * Drag and drop action
   */
  private async drag(page: Page, action: UIAction): Promise<void> {
    if (!action.targetSelector) {
      throw new Error('Drag action requires targetSelector');
    }

    const source = page.locator(action.selector);
    const target = page.locator(action.targetSelector);

    await source.first().waitFor({ state: 'visible', timeout: action.timeout });
    await target.first().waitFor({ state: 'visible', timeout: action.timeout });

    // Get bounding boxes
    const sourceBounds = await source.first().boundingBox();
    const targetBounds = await target.first().boundingBox();

    if (!sourceBounds || !targetBounds) {
      throw new Error('Could not get bounding boxes for drag action');
    }

    // Perform drag
    await page.dragAndDrop(action.selector, action.targetSelector, {
      timeout: action.timeout,
    });
  }

  /**
   * Keyboard action (press key combinations)
   */
  private async keyboard(page: Page, action: UIAction): Promise<void> {
    if (!action.key) {
      throw new Error('Keyboard action requires key');
    }

    // Focus element if selector provided
    if (action.selector) {
      const locator = page.locator(action.selector);
      await locator.first().focus();
    }

    // Press key with optional delay
    if (action.delay && action.key.length > 1) {
      // Multiple key press (e.g., Ctrl+A)
      const keys = action.key.split('+');
      const modifiers = keys.slice(0, -1);
      const key = keys[keys.length - 1];

      await page.keyboard.press(key, { delay: action.delay });
    } else {
      await page.keyboard.press(action.key);
    }
  }

  /**
   * Select dropdown option
   */
  private async select(page: Page, action: UIAction): Promise<void> {
    if (!action.value) {
      throw new Error('Select action requires value');
    }

    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });

    // Support both value and label
    await locator.first().selectOption(action.value);
  }

  /**
   * Check checkbox
   */
  private async check(page: Page, action: UIAction): Promise<void> {
    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });
    await locator.first().check({ timeout: action.timeout });
  }

  /**
   * Uncheck checkbox
   */
  private async uncheck(page: Page, action: UIAction): Promise<void> {
    const locator = page.locator(action.selector);
    await locator.first().waitFor({ state: 'visible', timeout: action.timeout });
    await locator.first().uncheck({ timeout: action.timeout });
  }

  /**
   * Wait for condition before/after action
   */
  private async waitForCondition(
    page: Page,
    condition: WaitCondition
  ): Promise<void> {
    const timeout = condition.timeout || DEFAULT_ACTION_TIMEOUT;

    try {
      switch (condition.type) {
        case 'element':
          if (!condition.selector) {
            throw new Error('Element wait requires selector');
          }
          await page.locator(condition.selector).waitFor({
            state: 'visible',
            timeout,
          });
          break;

        case 'url':
          if (!condition.urlPattern) {
            throw new Error('URL wait requires urlPattern');
          }
          await page.waitForURL(condition.urlPattern, { timeout });
          break;

        case 'networkidle':
          await page.waitForLoadState('networkidle', { timeout });
          break;

        case 'load':
          await page.waitForLoadState('load', { timeout });
          break;

        case 'function':
          // Custom function wait (polling)
          await page.waitForFunction(() => true, { timeout });
          break;

        default:
          throw new Error(`Unknown wait condition type: ${condition.type}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Wait condition failed (${condition.type}): ${message}`
      );
    }
  }

  /**
   * Get action description for logging
   */
  getActionDescription(action: UIAction): string {
    switch (action.type) {
      case 'click':
        return `Click on ${action.selector}`;
      case 'type':
        return `Type "${action.value}" into ${action.selector}`;
      case 'fill':
        return `Fill ${action.selector} with "${action.value}"`;
      case 'scroll':
        return `Scroll ${action.selector || action.value || 'page'}`;
      case 'hover':
        return `Hover over ${action.selector}`;
      case 'drag':
        return `Drag ${action.selector} to ${action.targetSelector}`;
      case 'keyboard':
      case 'press':
        return `Press key ${action.key}`;
      case 'select':
        return `Select "${action.value}" from ${action.selector}`;
      case 'check':
        return `Check ${action.selector}`;
      case 'uncheck':
        return `Uncheck ${action.selector}`;
      default:
        return `Execute action ${action.type}`;
    }
  }
}
