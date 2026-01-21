/**
 * Anthropic API Key Creator
 *
 * Automates the creation of Claude API keys through Anthropic Console.
 * Uses browser automation to login, create key, and extract it.
 */

export interface AnthropicKeyCreationResult {
  success: boolean;
  apiKey?: string;
  accountEmail?: string;
  error?: string;
  steps: string[];
}

export interface AnthropicAccountCredentials {
  email: string;
  password: string;
}

/**
 * Anthropic API key creation flow
 *
 * This class provides the step-by-step flow for creating a Claude API key.
 * It returns browser automation instructions that should be executed by MCP tools.
 */
export class AnthropicAPIKeyCreator {
  private static readonly CONSOLE_URL = 'https://console.anthropic.com/settings/keys';
  private static readonly LOGIN_URL = 'https://console.anthropic.com/login';

  /**
   * Get the automation flow for creating an Anthropic API key
   *
   * This method returns a structured flow that can be executed by MCP tools.
   * Each step contains the MCP tool to call and its parameters.
   */
  static getCreationFlow(credentials: AnthropicAccountCredentials): {
    steps: Array<{
      name: string;
      tool: string;
      params: any;
      description: string;
    }>;
    extractionLogic: string;
  } {
    return {
      steps: [
        {
          name: 'navigate_to_console',
          tool: 'mcp__playwright__browser_navigate',
          params: { url: this.CONSOLE_URL },
          description: 'Navigate to Anthropic Console API Keys',
        },
        {
          name: 'wait_for_login_or_keys_page',
          tool: 'mcp__playwright__browser_snapshot',
          params: {},
          description: 'Check if login required or already on API keys page',
        },
        // If login required (detected from snapshot):
        {
          name: 'enter_email',
          tool: 'mcp__playwright__browser_type',
          params: {
            element: 'Email input',
            ref: '[to be filled from snapshot]',
            text: credentials.email,
            submit: false,
          },
          description: 'Enter Anthropic account email',
        },
        {
          name: 'enter_password',
          tool: 'mcp__playwright__browser_type',
          params: {
            element: 'Password input',
            ref: '[to be filled from snapshot]',
            text: credentials.password,
            submit: false,
          },
          description: 'Enter Anthropic account password',
        },
        {
          name: 'click_login',
          tool: 'mcp__playwright__browser_click',
          params: {
            element: 'Sign In button',
            ref: '[to be filled from snapshot]',
          },
          description: 'Click Sign In button',
        },
        {
          name: 'wait_for_console_load',
          tool: 'mcp__playwright__browser_wait_for',
          params: { text: 'API Keys', time: 10 },
          description: 'Wait for Console to load',
        },
        {
          name: 'navigate_to_keys_if_needed',
          tool: 'mcp__playwright__browser_navigate',
          params: { url: this.CONSOLE_URL },
          description: 'Navigate to API Keys page',
        },
        {
          name: 'click_create_key',
          tool: 'mcp__playwright__browser_click',
          params: {
            element: 'Create Key button',
            ref: '[to be filled from snapshot]',
          },
          description: 'Click Create Key button',
        },
        {
          name: 'enter_key_name',
          tool: 'mcp__playwright__browser_type',
          params: {
            element: 'Key name input',
            ref: '[to be filled from snapshot]',
            text: `auto_key_${new Date().toISOString().split('T')[0]}`,
            submit: false,
          },
          description: 'Enter API key name',
        },
        {
          name: 'click_create',
          tool: 'mcp__playwright__browser_click',
          params: {
            element: 'Create button',
            ref: '[to be filled from snapshot]',
          },
          description: 'Click Create button',
        },
        {
          name: 'wait_for_key_display',
          tool: 'mcp__playwright__browser_wait_for',
          params: { time: 2 },
          description: 'Wait for API key to be displayed',
        },
        {
          name: 'snapshot_to_extract_key',
          tool: 'mcp__playwright__browser_snapshot',
          params: {},
          description: 'Get snapshot to extract API key',
        },
        {
          name: 'close_browser',
          tool: 'mcp__playwright__browser_close',
          params: {},
          description: 'Close browser',
        },
      ],
      extractionLogic: `
        Extract API key from snapshot using pattern:
        - Look for text starting with "sk-ant-"
        - API key format: sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{95}
        - Usually displayed in a modal or copyable text field immediately after creation
      `,
    };
  }

  /**
   * Validate Anthropic API key format
   */
  static validateKeyFormat(apiKey: string): boolean {
    return /^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{95}$/.test(apiKey);
  }

  /**
   * Extract API key from snapshot text
   */
  static extractKeyFromSnapshot(snapshotText: string): string | null {
    const match = snapshotText.match(/sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{95}/);
    return match ? match[0] : null;
  }
}
