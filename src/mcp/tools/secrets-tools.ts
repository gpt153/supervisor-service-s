/**
 * MCP tools for secrets management
 *
 * Provides secure storage and retrieval of secrets via MCP protocol.
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { SecretsManager } from '../../secrets/index.js';
import { AutoSecretDetector } from '../../secrets/AutoSecretDetector.js';
import { APIKeyManager } from '../../secrets/APIKeyManager.js';
import type {
  SetSecretParams,
  GetSecretParams,
  ListSecretsParams,
  DeleteSecretParams,
  SecretScope,
} from '../../types/database.js';

// Singleton instances shared across all tool calls
let secretsManagerInstance: SecretsManager | null = null;
let secretDetectorInstance: AutoSecretDetector | null = null;
let apiKeyManagerInstance: APIKeyManager | null = null;

/**
 * Get or create SecretsManager instance
 */
function getSecretsManager(): SecretsManager {
  if (!secretsManagerInstance) {
    secretsManagerInstance = new SecretsManager();
  }
  return secretsManagerInstance;
}

/**
 * Get or create AutoSecretDetector instance
 */
function getSecretDetector(): AutoSecretDetector {
  if (!secretDetectorInstance) {
    secretDetectorInstance = new AutoSecretDetector();
  }
  return secretDetectorInstance;
}

/**
 * Get or create APIKeyManager instance
 */
function getAPIKeyManager(): APIKeyManager {
  if (!apiKeyManagerInstance) {
    apiKeyManagerInstance = new APIKeyManager(getSecretsManager());
  }
  return apiKeyManagerInstance;
}

/**
 * Get a secret by key path
 *
 * Tool: mcp__meta__get_secret
 */
export const getSecretTool: ToolDefinition = {
  name: 'mcp__meta__get_secret',
  description: 'Retrieve a secret by its hierarchical key path (e.g., meta/cloudflare/api_token, project/consilio/database_url)',
  inputSchema: {
    type: 'object',
    properties: {
      keyPath: {
        type: 'string',
        description: 'Hierarchical key path to the secret (format: scope/context/name)',
      },
    },
    required: ['keyPath'],
  },
  handler: async (params: GetSecretParams, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      const value = await manager.get(params);

      if (value === null) {
        return {
          success: false,
          error: `Secret not found: ${params.keyPath}`,
          keyPath: params.keyPath,
        };
      }

      return {
        success: true,
        keyPath: params.keyPath,
        value,
      };
    } catch (error) {
      // IMPORTANT: Never log the error message if it might contain the secret value
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        keyPath: params.keyPath,
      };
    }
  },
};

/**
 * Set a secret (create or update)
 *
 * Tool: mcp__meta__set_secret
 */
export const setSecretTool: ToolDefinition = {
  name: 'mcp__meta__set_secret',
  description: 'Store or update a secret with hierarchical key path. The value will be encrypted before storage.',
  inputSchema: {
    type: 'object',
    properties: {
      keyPath: {
        type: 'string',
        description: 'Hierarchical key path for the secret (e.g., meta/cloudflare/api_token)',
      },
      value: {
        type: 'string',
        description: 'The secret value to store (will be encrypted)',
      },
      description: {
        type: 'string',
        description: 'Optional description of what this secret is for',
      },
      expiresAt: {
        type: 'string',
        description: 'Optional expiration date (ISO 8601 format)',
      },
    },
    required: ['keyPath', 'value'],
  },
  handler: async (params: SetSecretParams & { expiresAt?: string }, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();

      // Convert expiresAt string to Date if provided
      const setParams: SetSecretParams = {
        keyPath: params.keyPath,
        value: params.value,
        description: params.description,
        expiresAt: params.expiresAt ? new Date(params.expiresAt) : undefined,
      };

      await manager.set(setParams);

      return {
        success: true,
        keyPath: params.keyPath,
        message: 'Secret stored successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        keyPath: params.keyPath,
      };
    }
  },
};

/**
 * List secrets (without values)
 *
 * Tool: mcp__meta__list_secrets
 */
export const listSecretsTool: ToolDefinition = {
  name: 'mcp__meta__list_secrets',
  description: 'List available secrets (metadata only, no values). Useful for discovery.',
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Filter by scope (meta, project, or service)',
        enum: ['meta', 'project', 'service'],
      },
      project: {
        type: 'string',
        description: 'Filter by project name (only for project-scoped secrets)',
      },
      service: {
        type: 'string',
        description: 'Filter by service name (only for service-scoped secrets)',
      },
    },
  },
  handler: async (params: ListSecretsParams, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      const secrets = await manager.list(params);

      return {
        success: true,
        count: secrets.length,
        secrets: secrets.map(s => ({
          keyPath: s.keyPath,
          description: s.description,
          scope: s.scope,
          lastAccessed: s.lastAccessed,
          accessCount: s.accessCount,
          expiresAt: s.expiresAt,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Delete a secret
 *
 * Tool: mcp__meta__delete_secret
 */
export const deleteSecretTool: ToolDefinition = {
  name: 'mcp__meta__delete_secret',
  description: 'Delete a secret by its key path. This action cannot be undone.',
  inputSchema: {
    type: 'object',
    properties: {
      keyPath: {
        type: 'string',
        description: 'Hierarchical key path of the secret to delete',
      },
    },
    required: ['keyPath'],
  },
  handler: async (params: DeleteSecretParams, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      const deleted = await manager.delete(params);

      if (!deleted) {
        return {
          success: false,
          error: `Secret not found: ${params.keyPath}`,
          keyPath: params.keyPath,
        };
      }

      return {
        success: true,
        keyPath: params.keyPath,
        message: 'Secret deleted successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        keyPath: params.keyPath,
      };
    }
  },
};

/**
 * Get secrets expiring soon
 *
 * Tool: mcp__meta__get_expiring_secrets
 */
export const getExpiringSecretsTool: ToolDefinition = {
  name: 'mcp__meta__get_expiring_secrets',
  description: 'Get list of secrets that will expire soon (next 30 days by default)',
  inputSchema: {
    type: 'object',
    properties: {
      daysAhead: {
        type: 'number',
        description: 'Number of days to look ahead (default: 30)',
      },
    },
  },
  handler: async (params: { daysAhead?: number }, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      const secrets = await manager.getExpiringSoon(params.daysAhead || 30);

      return {
        success: true,
        count: secrets.length,
        daysAhead: params.daysAhead || 30,
        secrets: secrets.map(s => ({
          keyPath: s.keyPath,
          description: s.description,
          scope: s.scope,
          expiresAt: s.expiresAt,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Get secrets needing rotation
 *
 * Tool: mcp__meta__get_rotation_secrets
 */
export const getRotationSecretsTool: ToolDefinition = {
  name: 'mcp__meta__get_rotation_secrets',
  description: 'Get list of secrets marked as needing rotation',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params: {}, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      const secrets = await manager.getNeedingRotation();

      return {
        success: true,
        count: secrets.length,
        secrets: secrets.map(s => ({
          keyPath: s.keyPath,
          description: s.description,
          scope: s.scope,
          lastAccessed: s.lastAccessed,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Mark a secret for rotation
 *
 * Tool: mcp__meta__mark_secret_rotation
 */
export const markSecretRotationTool: ToolDefinition = {
  name: 'mcp__meta__mark_secret_rotation',
  description: 'Mark a secret as needing rotation',
  inputSchema: {
    type: 'object',
    properties: {
      keyPath: {
        type: 'string',
        description: 'Hierarchical key path of the secret to mark for rotation',
      },
    },
    required: ['keyPath'],
  },
  handler: async (params: { keyPath: string }, context: ProjectContext) => {
    try {
      const manager = getSecretsManager();
      await manager.markForRotation(params.keyPath);

      return {
        success: true,
        keyPath: params.keyPath,
        message: 'Secret marked for rotation',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        keyPath: params.keyPath,
      };
    }
  },
};

/**
 * Detect secrets in text
 *
 * Tool: mcp__meta__detect_secrets
 */
export const detectSecretsTool: ToolDefinition = {
  name: 'mcp__meta__detect_secrets',
  description: 'Detect API keys and secrets in text using pattern matching. Useful for validating user input or scanning for secrets.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to scan for secrets',
      },
      question: {
        type: 'string',
        description: 'Optional context question (helps with detection)',
      },
      projectName: {
        type: 'string',
        description: 'Optional project name for context',
      },
      serviceName: {
        type: 'string',
        description: 'Optional service name for context',
      },
      autoStore: {
        type: 'boolean',
        description: 'Automatically store detected secrets (default: false)',
      },
    },
    required: ['text'],
  },
  handler: async (params: {
    text: string;
    question?: string;
    projectName?: string;
    serviceName?: string;
    autoStore?: boolean;
  }, context: ProjectContext) => {
    try {
      const detector = getSecretDetector();
      const detections = detector.extractAllSecrets(params.text, {
        question: params.question,
        projectName: params.projectName,
        serviceName: params.serviceName,
      });

      // Auto-store if requested
      const stored: string[] = [];
      if (params.autoStore && detections.length > 0) {
        const manager = getSecretsManager();

        for (const detection of detections) {
          try {
            await manager.set({
              keyPath: detection.keyPath,
              value: detection.value,
              description: detection.description,
            });
            stored.push(detection.keyPath);
          } catch (error) {
            // Continue with other secrets even if one fails
            console.error(`Failed to store ${detection.keyPath}:`, error);
          }
        }
      }

      return {
        success: true,
        count: detections.length,
        stored: stored.length,
        secrets: detections.map(d => ({
          type: d.type,
          keyPath: d.keyPath,
          description: d.description,
          confidence: d.confidence,
          // NEVER return the actual value
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Create or retrieve API key
 *
 * Tool: mcp__meta__create_api_key
 */
export const createAPIKeyTool: ToolDefinition = {
  name: 'mcp__meta__create_api_key',
  description: 'Get or create an API key for a provider. Will create automatically if supported (Google, Stripe, GitHub), otherwise will require manual input.',
  inputSchema: {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        description: 'Provider name (anthropic, openai, google, gemini, stripe, github, cloudflare)',
      },
      projectName: {
        type: 'string',
        description: 'Project name (for project-level keys)',
      },
      serviceName: {
        type: 'string',
        description: 'Service name (for service-level keys)',
      },
      permissions: {
        type: 'array',
        description: 'Required permissions/scopes',
        items: { type: 'string' },
      },
      description: {
        type: 'string',
        description: 'Description for the key',
      },
    },
    required: ['provider'],
  },
  handler: async (params: {
    provider: string;
    projectName?: string;
    serviceName?: string;
    permissions?: string[];
    description?: string;
  }, context: ProjectContext) => {
    try {
      const manager = getAPIKeyManager();

      // Check if can create automatically
      const canAutomate = manager.canCreateAutomatically(params.provider);

      if (!canAutomate) {
        // Return message indicating manual input needed
        return {
          success: false,
          automated: false,
          provider: params.provider,
          message: `Automatic creation not supported for ${params.provider}. Please provide the API key manually using mcp__meta__set_secret.`,
          supportedProviders: ['google', 'gemini', 'stripe', 'github'],
        };
      }

      // Try to create automatically
      const result = await manager.getOrCreateAPIKey({
        provider: params.provider,
        projectName: params.projectName,
        serviceName: params.serviceName,
        permissions: params.permissions,
        description: params.description,
      });

      return {
        success: true,
        automated: result.automated,
        provider: params.provider,
        keyId: result.keyId,
        message: result.automated
          ? `API key created automatically for ${params.provider}`
          : `Using existing API key for ${params.provider}`,
        // NEVER return the actual API key
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
        provider: params.provider,
      };
    }
  },
};

/**
 * Check if text contains secrets
 *
 * Tool: mcp__meta__check_for_secrets
 */
export const checkForSecretsTool: ToolDefinition = {
  name: 'mcp__meta__check_for_secrets',
  description: 'Check if text contains secrets without extracting them. Useful for pre-commit hooks or validation.',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to check',
      },
    },
    required: ['text'],
  },
  handler: async (params: { text: string }, context: ProjectContext) => {
    try {
      const detector = getSecretDetector();
      const containsSecrets = detector.containsSecrets(params.text);

      return {
        success: true,
        containsSecrets,
        message: containsSecrets
          ? 'Text contains potential secrets'
          : 'No secrets detected in text',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Redact secrets from text
 *
 * Tool: mcp__meta__redact_secrets
 */
export const redactSecretsTool: ToolDefinition = {
  name: 'mcp__meta__redact_secrets',
  description: 'Redact secrets from text for safe logging or display',
  inputSchema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to redact',
      },
    },
    required: ['text'],
  },
  handler: async (params: { text: string }, context: ProjectContext) => {
    try {
      const detector = getSecretDetector();
      const redacted = detector.redactSecrets(params.text);

      return {
        success: true,
        redactedText: redacted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};

/**
 * Get all secret management tools
 */
export function getSecretTools(): ToolDefinition[] {
  return [
    getSecretTool,
    setSecretTool,
    listSecretsTool,
    deleteSecretTool,
    getExpiringSecretsTool,
    getRotationSecretsTool,
    markSecretRotationTool,
    detectSecretsTool,
    createAPIKeyTool,
    checkForSecretsTool,
    redactSecretsTool,
  ];
}
