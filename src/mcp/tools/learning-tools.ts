/**
 * MCP tools for learning system integration
 *
 * Provides tools to search, index, and track learnings.
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { LearningsIndex, OpenAIEmbeddingProvider } from '../../rag/LearningsIndex.js';
import path from 'path';

// Initialize embedding provider (will use environment variable)
const getEmbeddingProvider = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable not set');
  }
  return new OpenAIEmbeddingProvider(apiKey);
};

// Lazy initialization of learnings index
let learningsIndexInstance: LearningsIndex | null = null;

const getLearningsIndex = () => {
  if (!learningsIndexInstance) {
    learningsIndexInstance = new LearningsIndex(getEmbeddingProvider());
  }
  return learningsIndexInstance;
};

/**
 * Search learnings tool
 */
export const searchLearningsTool: ToolDefinition = {
  name: 'search-learnings',
  description: 'Search for relevant learnings using semantic similarity. Returns past lessons, patterns, and best practices that apply to the current task or issue.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query describing the task, issue, or problem to find relevant learnings for',
      },
      category: {
        type: 'string',
        description: 'Optional category to filter by (e.g., "scar-integration", "database", "api")',
      },
      impact_level: {
        type: 'string',
        description: 'Optional impact level filter',
        enum: ['low', 'medium', 'high', 'critical'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of learnings to return (default: 5)',
      },
      min_similarity: {
        type: 'number',
        description: 'Minimum similarity score (0-1, default: 0.7)',
      },
    },
    required: ['query'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();

      const results = await index.searchLearnings(params.query, {
        category: params.category,
        impact_level: params.impact_level,
        limit: params.limit || 5,
        min_similarity: params.min_similarity || 0.7,
      });

      return {
        query: params.query,
        results_count: results.length,
        learnings: results.map(r => ({
          id: r.learning_id,
          title: r.title,
          category: r.category,
          type: r.learning_type,
          similarity: r.similarity,
          confidence: r.confidence_score,
          content_preview: r.content.substring(0, 300) + '...',
          full_content: r.content,
        })),
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: params.query,
      };
    }
  },
};

/**
 * Index learning tool
 */
export const indexLearningTool: ToolDefinition = {
  name: 'index-learning',
  description: 'Index a learning file into the RAG system for semantic search',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the learning markdown file to index',
      },
      project_id: {
        type: 'string',
        description: 'Optional project ID to associate the learning with',
      },
    },
    required: ['file_path'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();

      // Resolve file path
      const filePath = path.isAbsolute(params.file_path)
        ? params.file_path
        : path.join(context.workingDirectory, params.file_path);

      const learningId = await index.indexLearning(filePath, params.project_id);

      return {
        success: true,
        learning_id: learningId,
        file_path: filePath,
        message: 'Learning indexed successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        file_path: params.file_path,
      };
    }
  },
};

/**
 * Index all learnings tool
 */
export const indexAllLearningsTool: ToolDefinition = {
  name: 'index-all-learnings',
  description: 'Index all learning files from the supervisor-learnings directory',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'Optional project ID to associate learnings with',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();
      const count = await index.indexAllLearnings(params.project_id);

      return {
        success: true,
        indexed_count: count,
        message: `Successfully indexed ${count} learnings`,
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
 * Get learning statistics tool
 */
export const getLearningStatsTool: ToolDefinition = {
  name: 'get-learning-stats',
  description: 'Get statistics about learnings including usage, effectiveness, and distribution',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'Optional project ID to filter stats by',
      },
    },
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();
      const stats = await index.getStats(params.project_id);

      return {
        success: true,
        stats,
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
 * Track learning application tool
 */
export const trackLearningApplicationTool: ToolDefinition = {
  name: 'track-learning-application',
  description: 'Track when a learning is applied to a task, issue, or epic',
  inputSchema: {
    type: 'object',
    properties: {
      learning_id: {
        type: 'string',
        description: 'ID of the learning being applied',
      },
      applied_to_type: {
        type: 'string',
        description: 'Type of target (epic, issue, task, code_review)',
        enum: ['epic', 'issue', 'task', 'code_review'],
      },
      applied_to_id: {
        type: 'string',
        description: 'ID of the target (epic ID, issue number, task ID, etc.)',
      },
      context: {
        type: 'string',
        description: 'Optional context about how the learning was applied',
      },
      outcome: {
        type: 'string',
        description: 'Outcome of applying the learning',
        enum: ['successful', 'failed', 'partial'],
      },
      feedback: {
        type: 'string',
        description: 'Optional feedback about the application',
      },
    },
    required: ['learning_id', 'applied_to_type', 'applied_to_id'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();

      await index.trackApplication(
        params.learning_id,
        params.applied_to_type,
        params.applied_to_id,
        params.context,
        params.outcome,
        params.feedback
      );

      return {
        success: true,
        message: 'Learning application tracked successfully',
        learning_id: params.learning_id,
        applied_to: `${params.applied_to_type}:${params.applied_to_id}`,
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
 * Verify learning tool
 */
export const verifyLearningTool: ToolDefinition = {
  name: 'verify-learning',
  description: 'Mark a learning as verified by a human or supervisor',
  inputSchema: {
    type: 'object',
    properties: {
      learning_id: {
        type: 'string',
        description: 'ID of the learning to verify',
      },
      verified_by: {
        type: 'string',
        description: 'Name or identifier of who verified the learning',
      },
    },
    required: ['learning_id', 'verified_by'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();
      await index.verifyLearning(params.learning_id, params.verified_by);

      return {
        success: true,
        message: 'Learning verified successfully',
        learning_id: params.learning_id,
        verified_by: params.verified_by,
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
 * Get learning by ID tool
 */
export const getLearningByIdTool: ToolDefinition = {
  name: 'get-learning-by-id',
  description: 'Get full details of a specific learning by ID',
  inputSchema: {
    type: 'object',
    properties: {
      learning_id: {
        type: 'string',
        description: 'ID of the learning to retrieve',
      },
    },
    required: ['learning_id'],
  },
  handler: async (params, context: ProjectContext) => {
    try {
      const index = getLearningsIndex();
      const learning = await index.getLearningById(params.learning_id);

      if (!learning) {
        return {
          success: false,
          error: 'Learning not found',
          learning_id: params.learning_id,
        };
      }

      return {
        success: true,
        learning: {
          id: learning.id,
          title: learning.title,
          content: learning.content,
          type: learning.learning_type,
          category: learning.category,
          impact_level: learning.impact_level,
          confidence_score: learning.confidence_score,
          tags: learning.tags,
          usage_count: learning.usage_count,
          last_used_at: learning.last_used_at,
          verified: learning.verified,
          verified_by: learning.verified_by,
          verified_at: learning.verified_at,
          created_at: learning.created_at,
          updated_at: learning.updated_at,
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
 * Get all learning tools
 */
export function getLearningTools(): ToolDefinition[] {
  return [
    searchLearningsTool,
    indexLearningTool,
    indexAllLearningsTool,
    getLearningStatsTool,
    trackLearningApplicationTool,
    verifyLearningTool,
    getLearningByIdTool,
  ];
}
