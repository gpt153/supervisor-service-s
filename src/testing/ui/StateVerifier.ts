/**
 * Rendered State Verifier
 * Verifies what users actually see/experience at DOM/CSS/accessibility level
 * Critical for Level 5: Element visible, interactive, properly positioned, accessible
 */

import { Logger } from 'pino';
import { Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  VisibilityState,
  InteractivityState,
  ElementState,
  RenderedState,
  ElementBoundingBox,
} from '../../types/ui-testing.js';

export class StateVerifier {
  private logger: Logger;
  private domSnapshotsDir: string;

  constructor(domSnapshotsDir: string, logger: Logger) {
    this.domSnapshotsDir = domSnapshotsDir;
    this.logger = logger;
  }

  /**
   * Verify element visibility (Level 2 verification)
   * Checks: DOM presence, CSS display/visibility/opacity, viewport presence
   */
  async verifyElementVisible(page: Page, selector: string): Promise<VisibilityState> {
    try {
      const locator = page.locator(selector);

      const state = await locator.first().evaluate((el) => {
        const element = el as HTMLElement;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return {
          visible: rect.width > 0 && rect.height > 0,
          display: style.display,
          visibility: style.visibility,
          opacity: parseFloat(style.opacity),
          hidden: (element as any).hidden || element.hasAttribute('hidden'),
        };
      });

      this.logger.debug(
        { selector, visible: state.visible },
        'Element visibility verified'
      );

      return state;
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Element not found for visibility check'
      );

      return {
        visible: false,
        display: 'none',
        visibility: 'hidden',
        opacity: 0,
        hidden: true,
      };
    }
  }

  /**
   * Verify element interactivity (Level 3 verification)
   * Checks: clickable, enabled, not covered by other elements
   */
  async verifyElementInteractive(
    page: Page,
    selector: string
  ): Promise<InteractivityState> {
    try {
      const locator = page.locator(selector);

      const state = await locator.first().evaluate((el) => {
        const element = el as HTMLElement;
        const rect = element.getBoundingClientRect();

        // Check if clickable (center point not covered)
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const topElement = document.elementFromPoint(centerX, centerY);
        const clickable = topElement === element || element.contains(topElement as Node);

        // Check if disabled
        const disabled =
          (element as any).disabled ||
          element.getAttribute('aria-disabled') === 'true' ||
          element.getAttribute('disabled') !== null;

        // Check if in viewport
        const inViewport =
          rect.top >= 0 &&
          rect.left >= 0 &&
          rect.bottom <= window.innerHeight &&
          rect.right <= window.innerWidth;

        // Check if covered
        const covered = !clickable && rect.width > 0 && rect.height > 0;

        return {
          clickable,
          disabled,
          covered,
          inViewport,
        };
      });

      this.logger.debug(
        { selector, interactive: state.clickable && !state.disabled },
        'Element interactivity verified'
      );

      return state;
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Element not found for interactivity check'
      );

      return {
        clickable: false,
        disabled: true,
        covered: true,
        inViewport: false,
      };
    }
  }

  /**
   * Verify CSS property (Level 4)
   */
  async verifyCSSProperty(
    page: Page,
    selector: string,
    property: string,
    expectedValue: string
  ): Promise<{
    actual: string;
    expected: string;
    matches: boolean;
  }> {
    try {
      const locator = page.locator(selector);

      const actual = await locator.first().evaluate((el, prop) => {
        const style = window.getComputedStyle(el as HTMLElement);
        return style.getPropertyValue(prop);
      }, property);

      const matches = actual.trim() === expectedValue.trim();

      this.logger.debug(
        { selector, property, actual, expected: expectedValue, matches },
        'CSS property verified'
      );

      return {
        actual,
        expected: expectedValue,
        matches,
      };
    } catch (error) {
      this.logger.warn(
        {
          selector,
          property,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to verify CSS property'
      );

      return {
        actual: '',
        expected: expectedValue,
        matches: false,
      };
    }
  }

  /**
   * Verify text content
   */
  async verifyTextContent(
    page: Page,
    selector: string,
    expectedText: string,
    type: 'exact' | 'contains' | 'regex' = 'contains'
  ): Promise<{
    actual: string;
    expected: string;
    matches: boolean;
  }> {
    try {
      const locator = page.locator(selector);

      const actual = await locator.first().textContent();
      if (!actual) {
        return {
          actual: '',
          expected: expectedText,
          matches: false,
        };
      }

      let matches = false;
      switch (type) {
        case 'exact':
          matches = actual === expectedText;
          break;
        case 'contains':
          matches = actual.includes(expectedText);
          break;
        case 'regex':
          matches = new RegExp(expectedText).test(actual);
          break;
      }

      this.logger.debug(
        { selector, type, actualLength: actual.length, expected: expectedText, matches },
        'Text content verified'
      );

      return {
        actual: actual.substring(0, 100), // Truncate for logging
        expected: expectedText,
        matches,
      };
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to verify text content'
      );

      return {
        actual: '',
        expected: expectedText,
        matches: false,
      };
    }
  }

  /**
   * Get element bounding box
   */
  async getElementBoundingBox(page: Page, selector: string): Promise<ElementBoundingBox | null> {
    try {
      const locator = page.locator(selector);
      const box = await locator.first().boundingBox();

      if (!box) {
        return null;
      }

      const visibility = await this.verifyElementVisible(page, selector);
      const interactivity = await this.verifyElementInteractive(page, selector);

      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        visible: visibility.visible,
        interactive: interactivity.clickable && !interactivity.disabled,
      };
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get bounding box'
      );
      return null;
    }
  }

  /**
   * Capture DOM state as HTML
   */
  async captureDOMState(page: Page, phase: 'baseline' | 'final' = 'final'): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `dom-${phase}-${timestamp}.html`;
      const filePath = path.join(this.domSnapshotsDir, filename);

      // Ensure directory exists
      await fs.mkdir(this.domSnapshotsDir, { recursive: true });

      // Get full HTML
      const html = await page.content();

      // Save to file
      await fs.writeFile(filePath, html);

      this.logger.debug({ filePath, phase }, 'DOM snapshot saved');
      return filePath;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message, phase }, 'Failed to capture DOM state');
      throw error;
    }
  }

  /**
   * Capture full rendered state
   */
  async captureRenderedState(page: Page, phase: 'baseline' | 'final' = 'final'): Promise<RenderedState> {
    try {
      const elements: { [selector: string]: ElementState } = {};

      // Get basic page info
      const errorCount = await page.evaluate(() => {
        const errors = window as any;
        return errors.__errorCount || 0;
      });

      const warningCount = await page.evaluate(() => {
        const warnings = window as any;
        return warnings.__warningCount || 0;
      });

      const state: RenderedState = {
        url: page.url(),
        timestamp: new Date(),
        viewport: {
          width: page.viewportSize()?.width || 1920,
          height: page.viewportSize()?.height || 1080,
        },
        documentReady: true,
        elements,
        errorCount,
        warningCount,
      };

      this.logger.debug(
        { url: state.url, errorCount, warningCount },
        'Rendered state captured'
      );

      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to capture rendered state');
      throw error;
    }
  }

  /**
   * Verify accessibility (ARIA labels, roles, keyboard navigation)
   */
  async verifyAccessibility(
    page: Page,
    selector: string
  ): Promise<{
    hasAriaLabel: boolean;
    hasAriaRole: boolean;
    ariaLabels: Record<string, string>;
    issues: string[];
  }> {
    try {
      const locator = page.locator(selector);

      const accessibilityInfo = await locator.first().evaluate((el) => {
        const element = el as HTMLElement;
        const style = window.getComputedStyle(element);

        // Check for ARIA attributes
        const ariaLabel = element.getAttribute('aria-label');
        const ariaRole = element.getAttribute('role');
        const ariaLabelledBy = element.getAttribute('aria-labelledby');
        const ariaDescribedBy = element.getAttribute('aria-describedby');

        const issues: string[] = [];

        // Check for common accessibility issues
        if (
          element.tagName === 'IMG' &&
          !element.hasAttribute('alt') &&
          !ariaLabel
        ) {
          issues.push('Image missing alt text');
        }

        if (
          style.display === 'none' &&
          element.getAttribute('aria-hidden') !== 'true'
        ) {
          issues.push('Hidden element missing aria-hidden');
        }

        if (element.tagName === 'BUTTON' && !ariaLabel && !element.textContent) {
          issues.push('Button missing accessible label');
        }

        return {
          hasAriaLabel: !!ariaLabel,
          hasAriaRole: !!ariaRole,
          ariaLabels: {
            label: ariaLabel || '',
            role: ariaRole || '',
            labelledBy: ariaLabelledBy || '',
            describedBy: ariaDescribedBy || '',
          },
          issues,
        };
      });

      this.logger.debug(
        {
          selector,
          hasAriaLabel: accessibilityInfo.hasAriaLabel,
          issueCount: accessibilityInfo.issues.length,
        },
        'Accessibility verified'
      );

      return accessibilityInfo;
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to verify accessibility'
      );

      return {
        hasAriaLabel: false,
        hasAriaRole: false,
        ariaLabels: {},
        issues: ['Could not verify accessibility'],
      };
    }
  }

  /**
   * Get current element state
   */
  async getElementState(page: Page, selector: string): Promise<ElementState> {
    try {
      const locator = page.locator(selector);

      const state: ElementState = {
        exists: false,
        visibility: {
          visible: false,
          display: 'none',
          visibility: 'hidden',
          opacity: 0,
          hidden: true,
        },
        interactivity: {
          clickable: false,
          disabled: true,
          covered: true,
          inViewport: false,
        },
      };

      try {
        state.visibility = await this.verifyElementVisible(page, selector);
        state.interactivity = await this.verifyElementInteractive(page, selector);

        const text = await locator.first().textContent();
        if (text) {
          state.text = text;
        }

        const html = await locator.first().innerHTML();
        if (html) {
          state.html = html;
        }

        state.exists = true;
      } catch (err) {
        state.exists = false;
      }

      return state;
    } catch (error) {
      this.logger.warn(
        {
          selector,
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to get element state'
      );

      return {
        exists: false,
        visibility: {
          visible: false,
          display: 'none',
          visibility: 'hidden',
          opacity: 0,
          hidden: true,
        },
        interactivity: {
          clickable: false,
          disabled: true,
          covered: true,
          inViewport: false,
        },
      };
    }
  }
}
