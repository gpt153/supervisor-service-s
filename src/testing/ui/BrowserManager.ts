/**
 * Browser Lifecycle Manager
 * Handles Playwright browser/context/page creation, configuration, and cleanup
 * Ensures clean state between tests via context isolation
 */

import { Logger } from 'pino';
import {
  Browser,
  BrowserContext,
  Page,
  chromium,
  firefox,
  webkit,
} from 'playwright';
import {
  BrowserConfig,
  DEFAULT_BROWSER_CONFIG,
  DEFAULT_ACTION_TIMEOUT,
  ViewportConfig,
} from '../../types/ui-testing.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();
  private config: BrowserConfig;
  private logger: Logger;

  constructor(config: Partial<BrowserConfig> = {}, logger: Logger) {
    this.config = { ...DEFAULT_BROWSER_CONFIG, ...config };
    this.logger = logger;
  }

  /**
   * Launch browser instance
   */
  async launchBrowser(): Promise<Browser> {
    try {
      if (this.browser) {
        return this.browser;
      }

      this.logger.debug(
        { browserType: this.config.browserType, headless: this.config.headless },
        'Launching browser'
      );

      const launchOptions = {
        headless: this.config.headless,
      };

      switch (this.config.browserType) {
        case 'firefox':
          this.browser = await firefox.launch(launchOptions);
          break;
        case 'webkit':
          this.browser = await webkit.launch(launchOptions);
          break;
        case 'chromium':
        default:
          this.browser = await chromium.launch(launchOptions);
      }

      this.logger.info({ browserType: this.config.browserType }, 'Browser launched');
      return this.browser;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to launch browser');
      throw error;
    }
  }

  /**
   * Create new browser context (isolated state)
   */
  async createContext(): Promise<BrowserContext> {
    try {
      if (!this.browser) {
        await this.launchBrowser();
      }

      this.logger.debug('Creating browser context');

      const contextOptions: Parameters<Browser['newContext']>[0] = {
        viewport: this.config.viewport,
        colorScheme: 'light',
      };

      if (this.config.recordVideo) {
        contextOptions.recordVideo = { dir: './test-videos' };
      }

      if (this.config.recordHar) {
        contextOptions.recordHar = { path: './test.har' };
      }

      this.context = await this.browser!.newContext(contextOptions);

      this.logger.debug('Browser context created');
      return this.context;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to create context');
      throw error;
    }
  }

  /**
   * Create new page in context
   */
  async createPage(pageId?: string): Promise<Page> {
    try {
      if (!this.context) {
        await this.createContext();
      }

      const id = pageId || `page-${Date.now()}`;
      this.logger.debug({ pageId: id }, 'Creating new page');

      const page = await this.context!.newPage();

      // Set default timeout
      if (this.config.timeout) {
        page.setDefaultTimeout(this.config.timeout);
        page.setDefaultNavigationTimeout(this.config.timeout);
      }

      // Store page reference
      this.pages.set(id, page);

      this.logger.debug({ pageId: id }, 'Page created');
      return page;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to create page');
      throw error;
    }
  }

  /**
   * Get existing page
   */
  getPage(pageId: string): Page | undefined {
    return this.pages.get(pageId);
  }

  /**
   * Set viewport size for page
   */
  async setViewport(page: Page, viewport: ViewportConfig): Promise<void> {
    try {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      if (viewport.deviceScaleFactor) {
        // Note: Device scale factor must be set at context creation
        this.logger.warn(
          'Device scale factor changes require context recreation'
        );
      }

      this.logger.debug(
        { width: viewport.width, height: viewport.height },
        'Viewport size changed'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to set viewport');
      throw error;
    }
  }

  /**
   * Close specific page
   */
  async closePage(pageId: string): Promise<void> {
    try {
      const page = this.pages.get(pageId);
      if (page) {
        await page.close();
        this.pages.delete(pageId);
        this.logger.debug({ pageId }, 'Page closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message, pageId }, 'Failed to close page');
      throw error;
    }
  }

  /**
   * Close context (all pages in context)
   */
  async closeContext(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
        this.pages.clear();
        this.logger.info('Browser context closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to close context');
      throw error;
    }
  }

  /**
   * Close browser (all contexts and pages)
   */
  async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        await this.closeContext();
      }

      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.logger.info('Browser closed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: message }, 'Failed to close browser');
      throw error;
    }
  }

  /**
   * Full cleanup (emergency/forced)
   */
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Starting browser cleanup');

      // Close all pages
      for (const [id, page] of this.pages.entries()) {
        try {
          await page.close();
          this.pages.delete(id);
        } catch (err) {
          this.logger.warn({ pageId: id, error: String(err) }, 'Page cleanup failed');
        }
      }

      // Close context
      if (this.context) {
        try {
          await this.context.close();
          this.context = null;
        } catch (err) {
          this.logger.warn({ error: String(err) }, 'Context cleanup failed');
        }
      }

      // Close browser
      if (this.browser) {
        try {
          await this.browser.close();
          this.browser = null;
        } catch (err) {
          this.logger.warn({ error: String(err) }, 'Browser cleanup failed');
        }
      }

      this.logger.info('Browser cleanup completed');
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'Critical error during cleanup'
      );
    }
  }

  /**
   * Get browser health status
   */
  getStatus(): {
    browserOpen: boolean;
    contextOpen: boolean;
    pageCount: number;
  } {
    return {
      browserOpen: this.browser !== null,
      contextOpen: this.context !== null,
      pageCount: this.pages.size,
    };
  }

  /**
   * Wait for condition (helper for synchronization)
   */
  async waitForCondition(
    condition: () => Promise<boolean>,
    timeoutMs: number = DEFAULT_ACTION_TIMEOUT
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (true) {
      try {
        if (await condition()) {
          return;
        }
      } catch (err) {
        // Continue polling
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        throw new Error(
          `Condition timeout after ${timeoutMs}ms`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}
