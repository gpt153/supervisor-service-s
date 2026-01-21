/**
 * API Key Automation MCP Tools
 *
 * Tools for automated API key creation through browser automation.
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { GeminiAPIKeyCreator } from '../../automation/GeminiAPIKeyCreator.js';
import { AnthropicAPIKeyCreator } from '../../automation/AnthropicAPIKeyCreator.js';
import { SecretsManager } from '../../secrets/SecretsManager.js';

/**
 * Get Gemini API key creation flow
 *
 * Returns step-by-step instructions for browser automation.
 * User must execute each step using Playwright MCP tools.
 */
const getGeminiKeyCreationFlowTool: ToolDefinition = {
  name: 'get-gemini-key-creation-flow',
  description: 'Get browser automation flow for creating a Gemini API key',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Google account email',
      },
      password: {
        type: 'string',
        description: 'Google account password',
      },
    },
    required: ['email', 'password'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const flow = GeminiAPIKeyCreator.getCreationFlow({
        email: params.email,
        password: params.password,
      });

      return {
        success: true,
        message: 'Execute each step using Playwright MCP tools in order',
        steps: flow.steps,
        extractionLogic: flow.extractionLogic,
        nextSteps: [
          '1. Execute each browser automation step in sequence',
          '2. Extract API key from final snapshot',
          '3. Call add-gemini-key to store the key',
          '4. Optionally call store-account-credentials to save credentials',
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Get Claude API key creation flow
 */
const getClaudeKeyCreationFlowTool: ToolDefinition = {
  name: 'get-claude-key-creation-flow',
  description: 'Get browser automation flow for creating a Claude API key',
  inputSchema: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        description: 'Anthropic account email',
      },
      password: {
        type: 'string',
        description: 'Anthropic account password',
      },
    },
    required: ['email', 'password'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const flow = AnthropicAPIKeyCreator.getCreationFlow({
        email: params.email,
        password: params.password,
      });

      return {
        success: true,
        message: 'Execute each step using Playwright MCP tools in order',
        steps: flow.steps,
        extractionLogic: flow.extractionLogic,
        nextSteps: [
          '1. Execute each browser automation step in sequence',
          '2. Extract API key from final snapshot',
          '3. Call add-claude-key to store the key',
          '4. Optionally call store-account-credentials to save credentials',
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Extract Gemini API key from snapshot
 */
const extractGeminiKeyTool: ToolDefinition = {
  name: 'extract-gemini-key',
  description: 'Extract Gemini API key from browser snapshot text',
  inputSchema: {
    type: 'object',
    properties: {
      snapshotText: {
        type: 'string',
        description: 'Text from browser snapshot',
      },
    },
    required: ['snapshotText'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const apiKey = GeminiAPIKeyCreator.extractKeyFromSnapshot(params.snapshotText);

      if (!apiKey) {
        return {
          success: false,
          error: 'No Gemini API key found in snapshot',
        };
      }

      const valid = GeminiAPIKeyCreator.validateKeyFormat(apiKey);

      return {
        success: true,
        apiKey,
        valid,
        message: valid
          ? 'API key extracted successfully'
          : 'API key extracted but format validation failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Extract Claude API key from snapshot
 */
const extractClaudeKeyTool: ToolDefinition = {
  name: 'extract-claude-key',
  description: 'Extract Claude API key from browser snapshot text',
  inputSchema: {
    type: 'object',
    properties: {
      snapshotText: {
        type: 'string',
        description: 'Text from browser snapshot',
      },
    },
    required: ['snapshotText'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const apiKey = AnthropicAPIKeyCreator.extractKeyFromSnapshot(params.snapshotText);

      if (!apiKey) {
        return {
          success: false,
          error: 'No Claude API key found in snapshot',
        };
      }

      const valid = AnthropicAPIKeyCreator.validateKeyFormat(apiKey);

      return {
        success: true,
        apiKey,
        valid,
        message: valid
          ? 'API key extracted successfully'
          : 'API key extracted but format validation failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Store account credentials in secrets manager
 */
const storeAccountCredentialsTool: ToolDefinition = {
  name: 'store-account-credentials',
  description: 'Store account credentials securely in secrets manager',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        enum: ['gemini', 'claude'],
        description: 'Service name (gemini or claude)',
      },
      accountName: {
        type: 'string',
        description: 'Account identifier (e.g., "account1", "personal")',
      },
      email: {
        type: 'string',
        description: 'Account email',
      },
      password: {
        type: 'string',
        description: 'Account password',
      },
    },
    required: ['service', 'accountName', 'email', 'password'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const secretsManager = new SecretsManager();

      // Store credentials as JSON
      const credentials = {
        email: params.email,
        password: params.password,
        storedAt: new Date().toISOString(),
      };

      const keyPath = `meta/${params.service}/credentials/${params.accountName}`;
      await secretsManager.set(keyPath, JSON.stringify(credentials));

      return {
        success: true,
        message: `Credentials stored securely at ${keyPath}`,
        keyPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Retrieve account credentials from secrets manager
 */
const getAccountCredentialsTool: ToolDefinition = {
  name: 'get-account-credentials',
  description: 'Retrieve account credentials from secrets manager',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        enum: ['gemini', 'claude'],
        description: 'Service name (gemini or claude)',
      },
      accountName: {
        type: 'string',
        description: 'Account identifier',
      },
    },
    required: ['service', 'accountName'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const secretsManager = new SecretsManager();
      const keyPath = `meta/${params.service}/credentials/${params.accountName}`;
      const value = await secretsManager.get(keyPath);

      if (!value) {
        return {
          success: false,
          error: `No credentials found for ${params.service}/${params.accountName}`,
        };
      }

      const credentials = JSON.parse(value);

      return {
        success: true,
        credentials: {
          email: credentials.email,
          // Don't return password in response for security
          passwordStored: true,
          storedAt: credentials.storedAt,
        },
        keyPath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * List stored account credentials
 */
const listAccountCredentialsTool: ToolDefinition = {
  name: 'list-account-credentials',
  description: 'List all stored account credentials',
  inputSchema: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        enum: ['gemini', 'claude'],
        description: 'Optional service filter',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const secretsManager = new SecretsManager();
      const basePath = params.service ? `meta/${params.service}/credentials` : 'meta';
      const secrets = await secretsManager.list(basePath);

      const credentials = secrets
        .filter(s => s.key_path.includes('/credentials/'))
        .map(s => {
          const parts = s.key_path.split('/');
          const service = parts[1]; // meta/<service>/credentials/<name>
          const accountName = parts[3];

          return {
            service,
            accountName,
            keyPath: s.key_path,
            createdAt: s.created_at,
          };
        });

      return {
        success: true,
        credentials,
        total: credentials.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Export all API key automation tools
 */
export function getAPIKeyAutomationTools(): ToolDefinition[] {
  return [
    getGeminiKeyCreationFlowTool,
    getClaudeKeyCreationFlowTool,
    extractGeminiKeyTool,
    extractClaudeKeyTool,
    storeAccountCredentialsTool,
    getAccountCredentialsTool,
    listAccountCredentialsTool,
  ];
}
