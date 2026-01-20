/**
 * Multi-Agent Tools
 *
 * MCP tools for managing multi-agent CLI integration.
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import {
  MultiAgentExecutor,
  QuotaManager,
  AgentRouter,
  type AgentType,
  type AgentRequest,
} from '../../agents/multi/index.js';

// Shared executor instance
const executor = new MultiAgentExecutor();

/**
 * Get agent quota status
 */
const getAgentQuotasTool: ToolDefinition = {
  name: 'get-agent-quotas',
  description: 'Get quota status for all AI CLI agents (Gemini, Codex, Claude)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const quotas = await quotaManager.getAllQuotas();

      return {
        success: true,
        quotas: quotas.map((q) => ({
          agent: q.agent,
          remaining: q.remaining,
          limit: q.limit,
          resetsAt: q.resetsAt.toISOString(),
          available: q.available,
          percentageUsed: Math.round(
            ((q.limit - q.remaining) / q.limit) * 100
          ),
        })),
        timestamp: new Date().toISOString(),
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
 * Execute task with automatic agent routing
 */
const executeWithRoutingTool: ToolDefinition = {
  name: 'execute-with-routing',
  description:
    'Execute a task with automatic routing to the best AI agent based on complexity and quota',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Task prompt to execute',
      },
      description: {
        type: 'string',
        description: 'Task description for classification',
      },
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files that will be affected by this task',
      },
      estimatedLines: {
        type: 'number',
        description: 'Estimated lines of code to change',
      },
      securityCritical: {
        type: 'boolean',
        description: 'Whether this task is security-critical',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
      },
    },
    required: ['prompt', 'description'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const request: AgentRequest & any = {
        prompt: params.prompt,
        description: params.description,
        cwd: context.workingDirectory,
        files: params.files,
        estimatedLines: params.estimatedLines,
        securityCritical: params.securityCritical,
        timeout: params.timeout,
        outputFormat: 'json',
      };

      const { result, routing } = await executor.execute(request);

      return {
        success: result.success,
        output: result.output,
        agent: result.agent,
        duration: result.duration,
        cost: result.cost,
        routing: {
          selectedAgent: routing.selectedAgent,
          reason: routing.reason,
          complexity: routing.classification.complexity,
          taskType: routing.classification.type,
          confidence: routing.classification.confidence,
        },
        error: result.error,
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
 * Force agent selection
 */
const forceAgentTool: ToolDefinition = {
  name: 'force-agent-selection',
  description:
    'Execute a task with a specific agent, bypassing automatic routing',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        enum: ['gemini', 'codex', 'claude'],
        description: 'Agent to use for execution',
      },
      prompt: {
        type: 'string',
        description: 'Task prompt to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
      },
    },
    required: ['agent', 'prompt'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const request: AgentRequest = {
        prompt: params.prompt,
        cwd: context.workingDirectory,
        timeout: params.timeout,
        outputFormat: 'json',
      };

      const result = await executor.executeWithAgent(
        request,
        params.agent as AgentType
      );

      return {
        success: result.success,
        output: result.output,
        agent: result.agent,
        duration: result.duration,
        cost: result.cost,
        error: result.error,
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
 * Get routing statistics
 */
const getRoutingStatsTool: ToolDefinition = {
  name: 'get-routing-stats',
  description: 'Get statistics about agent routing decisions',
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        description: 'ISO timestamp to get stats since (optional)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const router = executor.getRouter();
      const since = params.since ? new Date(params.since) : undefined;

      const stats = await router.getRoutingStats(since);

      return {
        success: true,
        stats: {
          totalDecisions: stats.totalDecisions,
          decisionsByAgent: stats.decisionsByAgent,
          decisionsByComplexity: stats.decisionsByComplexity,
          averageConfidence: Math.round(stats.averageConfidence * 100) / 100,
        },
        period: since
          ? `Since ${since.toISOString()}`
          : 'All time',
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
 * Check agent health
 */
const checkAgentHealthTool: ToolDefinition = {
  name: 'check-agent-health',
  description: 'Check health status of all AI CLI agents',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const health = await executor.checkAgentHealth();

      return {
        success: true,
        agents: health,
        summary: {
          totalAgents: Object.keys(health).length,
          availableAgents: Object.values(health).filter((h) => h.available)
            .length,
          agentsWithQuota: Object.values(health).filter((h) => h.hasQuota)
            .length,
        },
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
 * Refresh agent quota
 */
const refreshQuotaTool: ToolDefinition = {
  name: 'refresh-agent-quota',
  description: 'Force refresh quota for a specific agent',
  inputSchema: {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        enum: ['gemini', 'codex', 'claude'],
        description: 'Agent to refresh quota for',
      },
    },
    required: ['agent'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      await quotaManager.forceRefreshQuota(params.agent as AgentType);

      const quota = await quotaManager.getQuota(params.agent as AgentType);

      return {
        success: true,
        agent: params.agent,
        quota: quota
          ? {
              remaining: quota.remaining,
              limit: quota.limit,
              resetsAt: quota.resetsAt.toISOString(),
            }
          : null,
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
 * Get Gemini API keys
 */
const getGeminiKeysTool: ToolDefinition = {
  name: 'get-gemini-keys',
  description: 'Get all Gemini API keys and their quota status',
  inputSchema: {
    type: 'object',
    properties: {
      availableOnly: {
        type: 'boolean',
        description: 'Only show keys with available quota (default: false)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const keys = params.availableOnly
        ? await quotaManager.getAvailableGeminiKeys()
        : await quotaManager.getAllGeminiKeys();

      return {
        success: true,
        keys: keys.map((k) => ({
          id: k.id,
          keyName: k.keyName,
          accountEmail: k.accountEmail,
          dailyQuota: k.dailyQuota,
          currentUsage: k.currentUsage,
          remaining: k.remaining,
          percentageUsed: Math.round((k.currentUsage / k.dailyQuota) * 100),
          quotaResetsAt: k.quotaResetsAt.toISOString(),
          isActive: k.isActive,
          priority: k.priority,
          lastUsedAt: k.lastUsedAt?.toISOString(),
        })),
        total: keys.length,
        totalRemaining: keys.reduce((sum, k) => sum + k.remaining, 0),
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
 * Add Gemini API key
 */
const addGeminiKeyTool: ToolDefinition = {
  name: 'add-gemini-key',
  description: 'Add a new Gemini API key for rotation',
  inputSchema: {
    type: 'object',
    properties: {
      keyName: {
        type: 'string',
        description: 'Friendly name for the key (e.g., "account1", "personal")',
      },
      apiKey: {
        type: 'string',
        description: 'Gemini API key (starts with AIza...)',
      },
      accountEmail: {
        type: 'string',
        description: 'Associated Gmail/Google account (optional)',
      },
      dailyQuota: {
        type: 'number',
        description: 'Daily token quota (default: 1000000)',
      },
      priority: {
        type: 'number',
        description: 'Priority (lower = higher priority, default: 0)',
      },
      notes: {
        type: 'string',
        description: 'Optional notes about this key',
      },
    },
    required: ['keyName', 'apiKey'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const keyManager = (quotaManager as any).geminiKeyManager;

      const keyId = await keyManager.addKey({
        keyName: params.keyName,
        apiKey: params.apiKey,
        accountEmail: params.accountEmail,
        dailyQuota: params.dailyQuota,
        priority: params.priority,
        notes: params.notes,
      });

      return {
        success: true,
        keyId,
        message: `Added Gemini API key: ${params.keyName}`,
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
 * Remove Gemini API key
 */
const removeGeminiKeyTool: ToolDefinition = {
  name: 'remove-gemini-key',
  description: 'Remove a Gemini API key from rotation',
  inputSchema: {
    type: 'object',
    properties: {
      keyId: {
        type: 'number',
        description: 'ID of the key to remove',
      },
    },
    required: ['keyId'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const keyManager = (quotaManager as any).geminiKeyManager;

      await keyManager.removeKey(params.keyId);

      return {
        success: true,
        message: `Removed Gemini API key with ID ${params.keyId}`,
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
 * Enable/disable Gemini API key
 */
const toggleGeminiKeyTool: ToolDefinition = {
  name: 'toggle-gemini-key',
  description: 'Enable or disable a Gemini API key',
  inputSchema: {
    type: 'object',
    properties: {
      keyId: {
        type: 'number',
        description: 'ID of the key to toggle',
      },
      enabled: {
        type: 'boolean',
        description: 'Whether to enable (true) or disable (false) the key',
      },
    },
    required: ['keyId', 'enabled'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const keyManager = (quotaManager as any).geminiKeyManager;

      if (params.enabled) {
        await keyManager.enableKey(params.keyId);
      } else {
        await keyManager.disableKey(params.keyId);
      }

      return {
        success: true,
        message: `${params.enabled ? 'Enabled' : 'Disabled'} Gemini API key with ID ${params.keyId}`,
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
 * Get Gemini key usage statistics
 */
const getGeminiKeyStatsTool: ToolDefinition = {
  name: 'get-gemini-key-stats',
  description: 'Get usage statistics for Gemini API keys',
  inputSchema: {
    type: 'object',
    properties: {
      since: {
        type: 'string',
        description: 'ISO timestamp to get stats since (optional)',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const since = params.since ? new Date(params.since) : undefined;

      const stats = await quotaManager.getGeminiKeyStats(since);

      return {
        success: true,
        totalRequests: stats.totalRequests,
        totalTokens: stats.totalTokens,
        successRate: Math.round(stats.successRate * 100) / 100,
        keyStats: stats.keyStats,
        period: since ? `Since ${since.toISOString()}` : 'All time',
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
 * Initialize Gemini keys from environment
 */
const initGeminiKeysTool: ToolDefinition = {
  name: 'init-gemini-keys',
  description: 'Load Gemini API keys from environment variables (GEMINI_KEY_1, GEMINI_KEY_2, etc.)',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const quotaManager = executor.getQuotaManager();
      const loadedCount = await quotaManager.initializeGeminiKeys();

      return {
        success: true,
        loadedCount,
        message: `Loaded ${loadedCount} Gemini API keys from environment`,
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
 * Export all multi-agent tools
 */
export function getMultiAgentTools(): ToolDefinition[] {
  return [
    getAgentQuotasTool,
    executeWithRoutingTool,
    forceAgentTool,
    getRoutingStatsTool,
    checkAgentHealthTool,
    refreshQuotaTool,
    // Gemini key management tools
    getGeminiKeysTool,
    addGeminiKeyTool,
    removeGeminiKeyTool,
    toggleGeminiKeyTool,
    getGeminiKeyStatsTool,
    initGeminiKeysTool,
  ];
}
