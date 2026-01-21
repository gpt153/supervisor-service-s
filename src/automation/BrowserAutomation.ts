/**
 * Browser Automation Wrapper
 *
 * Provides a clean interface for browser automation using Playwright MCP.
 * Wraps MCP tools for common browser operations.
 */

export interface BrowserNavigateParams {
  url: string;
}

export interface BrowserClickParams {
  element: string; // Human-readable description
  ref: string; // Element reference from snapshot
}

export interface BrowserTypeParams {
  element: string;
  ref: string;
  text: string;
  submit?: boolean;
}

export interface BrowserWaitParams {
  text?: string;
  textGone?: string;
  time?: number;
}

export interface BrowserFillFormParams {
  fields: Array<{
    name: string;
    ref: string;
    type: 'textbox' | 'checkbox' | 'radio' | 'combobox' | 'slider';
    value: string;
  }>;
}

/**
 * Browser automation wrapper
 *
 * NOTE: This class expects to be called from a context where MCP tools are available.
 * It returns the tool call parameters that should be executed by the MCP client.
 */
export class BrowserAutomation {
  /**
   * Navigate to URL
   */
  navigate(url: string): { tool: string; params: BrowserNavigateParams } {
    return {
      tool: 'mcp__playwright__browser_navigate',
      params: { url },
    };
  }

  /**
   * Click element
   */
  click(element: string, ref: string): { tool: string; params: BrowserClickParams } {
    return {
      tool: 'mcp__playwright__browser_click',
      params: { element, ref },
    };
  }

  /**
   * Type into element
   */
  type(
    element: string,
    ref: string,
    text: string,
    submit = false
  ): { tool: string; params: BrowserTypeParams } {
    return {
      tool: 'mcp__playwright__browser_type',
      params: { element, ref, text, submit },
    };
  }

  /**
   * Wait for condition
   */
  wait(params: BrowserWaitParams): { tool: string; params: BrowserWaitParams } {
    return {
      tool: 'mcp__playwright__browser_wait_for',
      params,
    };
  }

  /**
   * Fill form
   */
  fillForm(fields: BrowserFillFormParams['fields']): { tool: string; params: BrowserFillFormParams } {
    return {
      tool: 'mcp__playwright__browser_fill_form',
      params: { fields },
    };
  }

  /**
   * Take screenshot
   */
  screenshot(filename?: string, fullPage = false): { tool: string; params: any } {
    return {
      tool: 'mcp__playwright__browser_take_screenshot',
      params: { filename, fullPage },
    };
  }

  /**
   * Get page snapshot (accessibility tree)
   */
  snapshot(filename?: string): { tool: string; params: any } {
    return {
      tool: 'mcp__playwright__browser_snapshot',
      params: { filename },
    };
  }

  /**
   * Close browser
   */
  close(): { tool: string; params: any } {
    return {
      tool: 'mcp__playwright__browser_close',
      params: {},
    };
  }

  /**
   * Get network requests
   */
  getNetworkRequests(includeStatic = false): { tool: string; params: any } {
    return {
      tool: 'mcp__playwright__browser_network_requests',
      params: { includeStatic },
    };
  }

  /**
   * Evaluate JavaScript
   */
  evaluate(fn: string, element?: string, ref?: string): { tool: string; params: any } {
    return {
      tool: 'mcp__playwright__browser_evaluate',
      params: { function: fn, element, ref },
    };
  }
}
