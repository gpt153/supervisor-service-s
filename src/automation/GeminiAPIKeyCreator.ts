/**
 * Gemini API Key Creator
 *
 * Automates the creation of Gemini API keys through Google AI Studio.
 * Uses browser automation to login, create key, and extract it.
 */

export interface GeminiKeyCreationResult {
  success: boolean;
  apiKey?: string;
  accountEmail?: string;
  error?: string;
  steps: string[];
}

export interface GeminiAccountCredentials {
  email: string;
  password: string;
}

/**
 * Gemini API key creation flow
 *
 * This class provides the step-by-step flow for creating a Gemini API key.
 * It returns browser automation instructions that should be executed by MCP tools.
 */
export class GeminiAPIKeyCreator {
  private static readonly AI_STUDIO_URL = 'https://aistudio.google.com/app/apikey';
  private static readonly GOOGLE_LOGIN_URL = 'https://accounts.google.com';

  /**
   * Get the automation flow for creating a Gemini API key
   *
   * This method returns a structured flow that can be executed by MCP tools.
   * Each step contains the MCP tool to call and its parameters.
   */
  static getCreationFlow(credentials: GeminiAccountCredentials): {
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
          name: 'navigate_to_ai_studio',
          tool: 'mcp__playwright__browser_navigate',
          params: { url: this.AI_STUDIO_URL },
          description: 'Navigate to Google AI Studio',
        },
        {
          name: 'wait_for_login_or_api_page',
          tool: 'mcp__playwright__browser_snapshot',
          params: {},
          description: 'Check if login required or already on API key page',
        },
        // If login required (detected from snapshot):
        {
          name: 'enter_email',
          tool: 'mcp__playwright__browser_type',
          params: {
            element: 'Email input',
            ref: '[to be filled from snapshot]',
            text: credentials.email,
            submit: true,
          },
          description: 'Enter Google account email',
        },
        {
          name: 'wait_for_password',
          tool: 'mcp__playwright__browser_wait_for',
          params: { text: 'password', time: 5 },
          description: 'Wait for password field',
        },
        {
          name: 'enter_password',
          tool: 'mcp__playwright__browser_type',
          params: {
            element: 'Password input',
            ref: '[to be filled from snapshot]',
            text: credentials.password,
            submit: true,
          },
          description: 'Enter Google account password',
        },
        {
          name: 'wait_for_ai_studio_load',
          tool: 'mcp__playwright__browser_wait_for',
          params: { text: 'API key', time: 10 },
          description: 'Wait for AI Studio to load',
        },
        {
          name: 'click_create_api_key',
          tool: 'mcp__playwright__browser_click',
          params: {
            element: 'Create API Key button',
            ref: '[to be filled from snapshot]',
          },
          description: 'Click Create API Key button',
        },
        {
          name: 'wait_for_key_dialog',
          tool: 'mcp__playwright__browser_wait_for',
          params: { time: 2 },
          description: 'Wait for API key dialog',
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
        - Look for text starting with "AIza"
        - API key format: AIza[A-Za-z0-9_-]{35}
        - Usually displayed in a code block or copyable text field
      `,
    };
  }

  /**
   * Validate Gemini API key format
   */
  static validateKeyFormat(apiKey: string): boolean {
    return /^AIza[A-Za-z0-9_-]{35}$/.test(apiKey);
  }

  /**
   * Extract API key from snapshot text
   */
  static extractKeyFromSnapshot(snapshotText: string): string | null {
    const match = snapshotText.match(/AIza[A-Za-z0-9_-]{35}/);
    return match ? match[0] : null;
  }
}
