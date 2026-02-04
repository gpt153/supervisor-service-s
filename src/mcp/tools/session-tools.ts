/**
 * Session Management MCP Tools (Epic 007-A through 007-E)
 * Provides MCP tools for instance management, logging, events, checkpoints, and resume
 *
 * Epic 007-A (Instance Registry):
 * - mcp_meta_register_instance: Register new PS/MS instance
 * - mcp_meta_heartbeat: Update instance heartbeat
 * - mcp_meta_list_instances: List active instances
 * - mcp_meta_get_instance_details: Query instance by ID or prefix
 *
 * Epic 007-B (Command Logging):
 * - mcp_meta_log_command: Log command/action
 * - mcp_meta_search_commands: Search command history
 *
 * Epic 007-C (Event Store):
 * - mcp_meta_emit_event: Emit state event
 * - mcp_meta_query_events: Query events
 * - mcp_meta_replay_events: Replay event sequence
 * - mcp_meta_list_event_types: List available event types
 *
 * Epic 007-D (Checkpoint System):
 * - mcp_meta_create_checkpoint: Create work state checkpoint
 * - mcp_meta_get_checkpoint: Get checkpoint with recovery instructions
 * - mcp_meta_list_checkpoints: List instance checkpoints
 * - mcp_meta_cleanup_checkpoints: Clean up old checkpoints
 *
 * Epic 007-E (Resume Engine):
 * - mcp_meta_resume_instance: Resume stale instance
 * - mcp_meta_get_resume_instance_details: Get detailed resume context
 * - mcp_meta_list_stale_instances: List all stale instances
 */

import {
  registerInstance,
  updateHeartbeat,
  listInstances,
  getInstanceDetails,
  getPrefixMatches,
  calculateInstanceAge,
  isInstanceStale,
  linkClaudeSession,
  getCommandLogger,
  getSanitizationService,
  // Epic 007-C: Event Store
  emitEvent,
  queryEvents,
  replayEvents,
  aggregateEventsByType,
  getLatestEvents,
  InvalidEventError,
  InstanceNotFoundForEventError,
  EventStoreError,
  // Epic 007-D: Checkpoint System
  getCheckpointManager,
  getWorkStateSerializer,
  CheckpointNotFoundError,
  CheckpointInstanceNotFoundError,
  CheckpointError,
  // Epic 009-A: Claude Session Reference
  resolveClaudeSessionPath,
  InstanceNotFoundError,
} from '../../session/index.js';
// Epic 007-E: Resume Engine
import {
  resumeInstance,
  getInstanceDetails as getResumeInstanceDetails,
  listStaleInstances,
} from '../../session/ResumeEngine.js';
import {
  InstanceType,
  InstanceStatus,
} from '../../types/session.js';
import {
  ExplicitLogInputSchema,
  SearchCommandsInputSchema,
} from '../../types/command-log.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

/**
 * Tool: mcp_meta_register_instance
 * Register a new PS/MS instance and get unique instance ID
 */
export const registerInstanceTool: ToolDefinition = {
  name: 'mcp_meta_register_instance',
  description:
    'Register a new Project-Supervisor or Meta-Supervisor instance and receive unique instance ID',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Project name (e.g., odin, consilio, meta)',
      },
      instance_type: {
        type: 'string',
        enum: ['PS', 'MS'],
        description: 'Instance type: PS (Project-Supervisor) or MS (Meta-Supervisor)',
      },
      initial_context: {
        type: 'object',
        description: 'Optional initial context for future checkpoint use',
      },
      claude_session_uuid: {
        type: 'string',
        description: 'Optional Claude Code session UUID from ~/.claude/projects/[project]/[uuid].jsonl (Epic 009-A)',
      },
      claude_session_path: {
        type: 'string',
        description: 'Optional full path to Claude Code transcript file (Epic 009-A). Auto-resolved from UUID if not provided.',
      },
    },
    required: ['project', 'instance_type'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const instance = await registerInstance(
        input.project,
        input.instance_type as InstanceType,
        input.initial_context,
        undefined, // hostMachine (will use env or default)
        input.claude_session_uuid,
        input.claude_session_path
      );

      const duration = Date.now() - start;

      if (duration > 55) {
        console.warn(`Register instance slow: ${duration}ms for ${instance.instance_id}`);
      }

      const response: any = {
        success: true,
        instance_id: instance.instance_id,
        project: instance.project,
        type: instance.instance_type,
        status: instance.status,
        created_at: instance.created_at.toISOString(),
        context_percent: instance.context_percent,
      };

      // Include Claude session reference if present
      if (instance.claude_session_uuid) {
        response.claude_session_uuid = instance.claude_session_uuid;
        response.claude_session_path = instance.claude_session_path;
      }

      return response;
    } catch (error: any) {
      console.error('Register instance failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to register instance',
      };
    }
  },
};

/**
 * Tool: mcp_meta_heartbeat
 * Update instance heartbeat and context tracking
 */
export const heartbeatTool: ToolDefinition = {
  name: 'mcp_meta_heartbeat',
  description:
    'Send heartbeat for instance to update last activity, context usage, and current epic',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to update',
      },
      context_percent: {
        type: 'number',
        description: 'Context usage percentage (0-100)',
        minimum: 0,
        maximum: 100,
      },
      current_epic: {
        type: 'string',
        description: 'Optional current epic ID',
      },
    },
    required: ['instance_id', 'context_percent'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const instance = await updateHeartbeat(
        input.instance_id,
        input.context_percent,
        input.current_epic
      );

      const duration = Date.now() - start;

      if (duration > 20) {
        console.warn(`Heartbeat slow: ${duration}ms for ${instance.instance_id}`);
      }

      const ageSeconds = calculateInstanceAge(instance.last_heartbeat);
      const stale = isInstanceStale(instance.last_heartbeat);

      return {
        success: true,
        instance_id: instance.instance_id,
        status: stale ? InstanceStatus.STALE : instance.status,
        last_heartbeat: instance.last_heartbeat.toISOString(),
        age_seconds: ageSeconds,
        stale,
        context_percent: instance.context_percent,
      };
    } catch (error: any) {
      console.error('Heartbeat failed:', error);
      return {
        success: false,
        error: error.message || 'Heartbeat failed',
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_instances
 * List all instances with optional filtering
 */
export const listInstancesTool: ToolDefinition = {
  name: 'mcp_meta_list_instances',
  description:
    'List all active instances, optionally filtered by project and status',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        description: 'Optional project filter',
      },
      active_only: {
        type: 'boolean',
        description: 'If true, exclude stale and closed instances',
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const instances = await listInstances(input.project, input.active_only);

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`List instances slow: ${duration}ms for ${instances.length} instances`);
      }

      const activeCount = instances.filter((i) => i.status === 'active').length;
      const staleCount = instances.filter((i) => i.status === 'stale').length;

      return {
        success: true,
        instances: instances.map((instance) => {
          const item: any = {
            instance_id: instance.instance_id,
            project: instance.project,
            type: instance.instance_type,
            status: instance.status,
            last_heartbeat: instance.last_heartbeat.toISOString(),
            age_seconds: calculateInstanceAge(instance.last_heartbeat),
            context_percent: instance.context_percent,
            current_epic: instance.current_epic,
          };
          // Include Claude session UUID if present (Epic 009-A)
          if (instance.claude_session_uuid) {
            item.claude_session_uuid = instance.claude_session_uuid;
          }
          return item;
        }),
        total_count: instances.length,
        active_count: activeCount,
        stale_count: staleCount,
      };
    } catch (error: any) {
      console.error('List instances failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to list instances',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_instance_details
 * Query instance by ID (full or prefix match)
 */
export const getInstanceDetailsTool: ToolDefinition = {
  name: 'mcp_meta_get_instance_details',
  description:
    'Get detailed information about a specific instance by ID (full or prefix match)',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID (full or prefix)',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Try exact match first
      const instance = await getInstanceDetails(input.instance_id);

      if (instance) {
        const duration = Date.now() - start;

        if (duration > 50) {
          console.warn(`Get instance details slow: ${duration}ms for ${instance.instance_id}`);
        }

        const result: any = {
          success: true,
          instance: {
            instance_id: instance.instance_id,
            project: instance.project,
            type: instance.instance_type,
            status: instance.status,
            last_heartbeat: instance.last_heartbeat.toISOString(),
            age_seconds: calculateInstanceAge(instance.last_heartbeat),
            context_percent: instance.context_percent,
            current_epic: instance.current_epic,
            created_at: instance.created_at.toISOString(),
          },
        };
        // Include Claude session UUID if present (Epic 009-A)
        if (instance.claude_session_uuid) {
          result.instance.claude_session_uuid = instance.claude_session_uuid;
          result.instance.claude_session_path = instance.claude_session_path;
        }
        return result;
      }

      // Try prefix match
      const matches = await getPrefixMatches(input.instance_id);

      if (matches.length === 0) {
        return {
          success: false,
          error: 'Instance not found',
          searched_for: input.instance_id,
        };
      }

      if (matches.length === 1) {
        // Single match - return as if exact match
        const result: any = {
          success: true,
          instance: {
            instance_id: matches[0].instance_id,
            project: matches[0].project,
            type: matches[0].instance_type,
            status: matches[0].status,
            last_heartbeat: matches[0].last_heartbeat.toISOString(),
            age_seconds: calculateInstanceAge(matches[0].last_heartbeat),
            context_percent: matches[0].context_percent,
            current_epic: matches[0].current_epic,
            created_at: matches[0].created_at.toISOString(),
          },
        };
        // Include Claude session UUID if present (Epic 009-A)
        if (matches[0].claude_session_uuid) {
          result.instance.claude_session_uuid = matches[0].claude_session_uuid;
          result.instance.claude_session_path = matches[0].claude_session_path;
        }
        return result;
      }

      // Multiple matches - disambiguation
      return {
        success: true,
        matches: matches.map((m) => ({
          instance_id: m.instance_id,
          project: m.project,
          type: m.instance_type,
          status: m.status,
          age_seconds: calculateInstanceAge(m.last_heartbeat),
        })),
        message: 'Multiple matches found. Specify full ID or project.',
      };
    } catch (error: any) {
      console.error('Get instance details failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get instance details',
      };
    }
  },
};

/**
 * Tool: mcp_meta_log_command
 * Explicitly log a command or action (Epic 007-B)
 * Used by PS for spawns, git operations, planning decisions
 */
export const logCommandTool: ToolDefinition = {
  name: 'mcp_meta_log_command',
  description: 'Explicitly log a command or action for audit trail',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description:
          'Action type: spawn_subagent, git_commit, git_push, planning, deployment, etc.',
      },
      details: {
        type: 'object',
        description: 'Details object with optional description, parameters, result',
        properties: {
          description: {
            type: 'string',
            description: 'Human-readable description of the action',
          },
          parameters: {
            type: 'object',
            description: 'Input parameters (will be sanitized)',
          },
          result: {
            type: 'object',
            description: 'Output result (will be sanitized)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for categorization (e.g., deployment, critical)',
          },
          context_data: {
            type: 'object',
            description: 'Additional context data',
          },
        },
        required: ['description'],
      },
    },
    required: ['action', 'details'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Get instance ID from context
      const instanceId = (context as any).instanceId;
      if (!instanceId) {
        return {
          success: false,
          error: 'No instance ID in context',
        };
      }

      // Validate input
      const validated = ExplicitLogInputSchema.safeParse({
        instance_id: instanceId,
        action: input.action,
        details: input.details,
      });

      if (!validated.success) {
        return {
          success: false,
          error: `Validation failed: ${validated.error.message}`,
        };
      }

      // Log the command
      const logger = getCommandLogger();
      const result = await logger.logExplicit(validated.data);

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`Log command slow: ${duration}ms for ${input.action}`);
      }

      return {
        success: true,
        logged_id: result.id.toString(),
        timestamp: result.timestamp,
        action: result.action,
      };
    } catch (error: any) {
      console.error('Log command failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to log command',
      };
    }
  },
};

/**
 * Tool: mcp_meta_search_commands
 * Search command history for an instance (Epic 007-B)
 * Query with optional filters: action, tool_name, time range, success status
 */
export const searchCommandsTool: ToolDefinition = {
  name: 'mcp_meta_search_commands',
  description: 'Search command history for an instance with optional filters',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to search',
      },
      action: {
        type: 'string',
        description: 'Optional filter by action type',
      },
      tool_name: {
        type: 'string',
        description: 'Optional filter by tool name',
      },
      time_range: {
        type: 'object',
        description: 'Optional time range filter',
        properties: {
          start_time: {
            type: 'string',
            description: 'Start time (ISO 8601)',
          },
          end_time: {
            type: 'string',
            description: 'End time (ISO 8601)',
          },
        },
      },
      success_only: {
        type: 'boolean',
        description: 'Only return successful commands (default: false)',
      },
      limit: {
        type: 'integer',
        description: 'Number of results (max 1000, default 100)',
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'integer',
        description: 'For pagination (default: 0)',
        minimum: 0,
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Validate input
      const validated = SearchCommandsInputSchema.safeParse(input);

      if (!validated.success) {
        return {
          success: false,
          error: `Validation failed: ${validated.error.message}`,
        };
      }

      // Search commands
      const logger = getCommandLogger();
      const result = await logger.searchCommands(validated.data);

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`Search commands slow: ${duration}ms`);
      }

      return {
        success: true,
        total: result.total,
        instance_id: result.instance_id,
        commands: result.commands.map((cmd) => ({
          id: cmd.id.toString(),
          action: cmd.action,
          tool_name: cmd.tool_name,
          timestamp: cmd.timestamp,
          parameters: cmd.parameters,
          result: cmd.result,
          success: cmd.success,
          execution_time_ms: cmd.execution_time_ms,
          tags: cmd.tags,
          source: cmd.source,
        })),
      };
    } catch (error: any) {
      console.error('Search commands failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to search commands',
      };
    }
  },
};

/**
 * Tool: mcp_meta_emit_event (Epic 007-C)
 * Emit a new event for session state tracking
 */
export const emitEventTool: ToolDefinition = {
  name: 'mcp_meta_emit_event',
  description: 'Emit a new event for session state tracking',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      event_type: {
        type: 'string',
        description: 'Event type',
      },
      event_data: {
        type: 'object',
        description: 'Event payload (JSONB)',
      },
      metadata: {
        type: 'object',
        description: 'Optional metadata',
      },
    },
    required: ['instance_id', 'event_type', 'event_data'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await emitEvent(
        input.instance_id,
        input.event_type,
        input.event_data,
        input.metadata
      );

      const duration = Date.now() - start;

      if (duration > 10) {
        console.warn(`emitEvent slow: ${duration}ms`);
      }

      return {
        success: true,
        event_id: result.event_id,
        sequence_num: result.sequence_num,
        timestamp: result.timestamp.toISOString(),
      };
    } catch (error: any) {
      if (
        error instanceof InvalidEventError ||
        error instanceof InstanceNotFoundForEventError
      ) {
        return {
          success: false,
          error: error.message,
        };
      }

      console.error('emitEvent failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to emit event',
      };
    }
  },
};

/**
 * Tool: mcp_meta_query_events (Epic 007-C)
 * Query events for an instance with filtering
 */
export const queryEventsTool: ToolDefinition = {
  name: 'mcp_meta_query_events',
  description: 'Query events for an instance with optional filtering',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      filters: {
        type: 'object',
        description: 'Optional filters',
        properties: {
          event_type: {
            type: ['string', 'array'],
            description: 'Filter by event type(s)',
          },
          start_date: {
            type: 'string',
            description: 'Start date (ISO 8601)',
          },
          end_date: {
            type: 'string',
            description: 'End date (ISO 8601)',
          },
          keyword: {
            type: 'string',
            description: 'Keyword search in event data',
          },
        },
      },
      limit: {
        type: 'number',
        description: 'Number of results (1-1000, default 100)',
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default 0)',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await queryEvents(
        input.instance_id,
        input.filters,
        input.limit || 100,
        input.offset || 0
      );

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`queryEvents slow: ${duration}ms`);
      }

      return {
        success: true,
        events: result.events,
        total_count: result.total_count,
        has_more: result.has_more,
      };
    } catch (error: any) {
      console.error('queryEvents failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to query events',
      };
    }
  },
};

/**
 * Tool: mcp_meta_replay_events (Epic 007-C)
 * Replay events to reconstruct state
 */
export const replayEventsTool: ToolDefinition = {
  name: 'mcp_meta_replay_events',
  description: 'Replay events to reconstruct instance state',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      to_sequence_num: {
        type: 'number',
        description: 'Optional sequence number to replay up to',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await replayEvents(input.instance_id, input.to_sequence_num);

      const duration = Date.now() - start;

      if (duration > 200) {
        console.warn(`replayEvents slow: ${duration}ms`);
      }

      return {
        success: true,
        final_state: result.final_state,
        events_replayed: result.events_replayed,
        duration_ms: result.duration_ms,
      };
    } catch (error: any) {
      console.error('replayEvents failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to replay events',
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_event_types (Epic 007-C)
 * List all available event types
 */
export const listEventTypesTool: ToolDefinition = {
  name: 'mcp_meta_list_event_types',
  description: 'List all available event types with descriptions and schemas',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional category filter',
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    const eventTypes = [
      {
        type: 'instance_registered',
        category: 'instance',
        description: 'Emitted when new PS/MS instance starts',
      },
      {
        type: 'instance_heartbeat',
        category: 'instance',
        description: 'Periodic heartbeat to track instance liveness',
      },
      {
        type: 'instance_stale',
        category: 'instance',
        description: 'Instance detected as stale (no heartbeat for 120s)',
      },
      {
        type: 'epic_started',
        category: 'epic',
        description: 'Epic implementation begins',
      },
      {
        type: 'epic_completed',
        category: 'epic',
        description: 'Epic implementation completed successfully',
      },
      {
        type: 'epic_failed',
        category: 'epic',
        description: 'Epic implementation failed',
      },
      {
        type: 'test_passed',
        category: 'testing',
        description: 'Tests passed successfully',
      },
      {
        type: 'test_failed',
        category: 'testing',
        description: 'Tests failed',
      },
      {
        type: 'validation_passed',
        category: 'testing',
        description: 'Validation/quality checks passed',
      },
      {
        type: 'validation_failed',
        category: 'testing',
        description: 'Validation/quality checks failed',
      },
      {
        type: 'commit_created',
        category: 'git',
        description: 'Code committed',
      },
      {
        type: 'pr_created',
        category: 'git',
        description: 'Pull request created',
      },
      {
        type: 'pr_merged',
        category: 'git',
        description: 'Pull request merged',
      },
      {
        type: 'deployment_started',
        category: 'deployment',
        description: 'Deployment begins',
      },
      {
        type: 'deployment_completed',
        category: 'deployment',
        description: 'Deployment completed successfully',
      },
      {
        type: 'deployment_failed',
        category: 'deployment',
        description: 'Deployment failed',
      },
      {
        type: 'context_window_updated',
        category: 'work_state',
        description: 'Context window usage changed',
      },
      {
        type: 'checkpoint_created',
        category: 'work_state',
        description: 'Checkpoint created for context recovery',
      },
      {
        type: 'checkpoint_loaded',
        category: 'work_state',
        description: 'Checkpoint restored',
      },
      {
        type: 'epic_planned',
        category: 'planning',
        description: 'Epic planning completed',
      },
      {
        type: 'feature_requested',
        category: 'planning',
        description: 'New feature requested',
      },
      {
        type: 'task_spawned',
        category: 'planning',
        description: 'Subagent task spawned',
      },
    ];

    let filtered = eventTypes;
    if (input.category) {
      filtered = eventTypes.filter((t: any) => t.category === input.category);
    }

    return {
      success: true,
      event_types: filtered,
      total_count: filtered.length,
    };
  },
};

/**
 * Tool: mcp_meta_create_checkpoint
 * Create a checkpoint for current work state (Epic 007-D)
 */
export const createCheckpointTool: ToolDefinition = {
  name: 'mcp_meta_create_checkpoint',
  description:
    'Create a checkpoint of current work state for fast recovery (context_window, epic_completion, or manual)',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      checkpoint_type: {
        type: 'string',
        enum: ['context_window', 'epic_completion', 'manual'],
        description: 'Type of checkpoint',
      },
      context_window_percent: {
        type: 'number',
        description: 'Optional context window percentage',
        minimum: 0,
        maximum: 100,
      },
      current_epic: {
        type: 'object',
        description: 'Optional current epic data',
      },
      manual_note: {
        type: 'string',
        description: 'Optional note for manual checkpoints',
      },
      working_dir: {
        type: 'string',
        description: 'Optional working directory (default: cwd)',
      },
    },
    required: ['instance_id', 'checkpoint_type'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Serialize work state
      const serializer = getWorkStateSerializer();
      const workState = await serializer.serialize(
        input.instance_id,
        input.current_epic,
        input.working_dir
      );

      // Create checkpoint
      const manager = getCheckpointManager();
      const result = await manager.createCheckpoint({
        instance_id: input.instance_id,
        checkpoint_type: input.checkpoint_type,
        context_window_percent: input.context_window_percent,
        work_state: workState,
        metadata: {
          trigger: `event_${input.checkpoint_type}`,
          manual_note: input.manual_note,
        },
      });

      const duration = Date.now() - start;

      if (duration > 200) {
        console.warn(`Create checkpoint slow: ${duration}ms`);
      }

      return {
        success: true,
        checkpoint_id: result.checkpoint_id,
        instance_id: result.instance_id,
        checkpoint_type: result.checkpoint_type,
        sequence_num: result.sequence_num,
        size_bytes: result.size_bytes,
        created_at: result.created_at,
      };
    } catch (error: any) {
      console.error('Create checkpoint failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to create checkpoint',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_checkpoint
 * Retrieve checkpoint and generate recovery instructions (Epic 007-D)
 */
export const getCheckpointTool: ToolDefinition = {
  name: 'mcp_meta_get_checkpoint',
  description:
    'Get checkpoint by ID and generate plain-language recovery instructions',
  inputSchema: {
    type: 'object',
    properties: {
      checkpoint_id: {
        type: 'string',
        description: 'Checkpoint UUID',
      },
    },
    required: ['checkpoint_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const manager = getCheckpointManager();
      const result = await manager.getCheckpoint(input.checkpoint_id);

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`Get checkpoint slow: ${duration}ms`);
      }

      return {
        success: true,
        checkpoint: {
          checkpoint_id: result.checkpoint.checkpoint_id,
          instance_id: result.checkpoint.instance_id,
          checkpoint_type: result.checkpoint.checkpoint_type,
          sequence_num: result.checkpoint.sequence_num,
          timestamp: result.checkpoint.timestamp.toISOString(),
          context_window_percent: result.checkpoint.context_window_percent,
        },
        recovery_instructions: result.recovery_instructions,
      };
    } catch (error: any) {
      console.error('Get checkpoint failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get checkpoint',
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_checkpoints
 * List checkpoints for an instance (Epic 007-D)
 */
export const listCheckpointsTool: ToolDefinition = {
  name: 'mcp_meta_list_checkpoints',
  description:
    'List checkpoints for an instance, optionally filtered by type',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      checkpoint_type: {
        type: 'string',
        enum: ['context_window', 'epic_completion', 'manual'],
        description: 'Optional filter by checkpoint type',
      },
      limit: {
        type: 'number',
        description: 'Number of results (default 50, max 1000)',
        default: 50,
      },
      offset: {
        type: 'number',
        description: 'Pagination offset (default 0)',
        default: 0,
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const manager = getCheckpointManager();
      const result = await manager.listCheckpoints(input.instance_id, {
        checkpoint_type: input.checkpoint_type,
        limit: input.limit || 50,
        offset: input.offset || 0,
      });

      const duration = Date.now() - start;

      if (duration > 30) {
        console.warn(`List checkpoints slow: ${duration}ms`);
      }

      return {
        success: true,
        checkpoints: result.checkpoints.map((cp) => ({
          checkpoint_id: cp.checkpoint_id,
          checkpoint_type: cp.checkpoint_type,
          sequence_num: cp.sequence_num,
          timestamp: cp.timestamp,
          context_window_percent: cp.context_window_percent,
          epic_id: cp.epic_id,
          size_bytes: cp.size_bytes,
        })),
        total_count: result.total_count,
        instance_id: result.instance_id,
      };
    } catch (error: any) {
      console.error('List checkpoints failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to list checkpoints',
      };
    }
  },
};

/**
 * Tool: mcp_meta_cleanup_checkpoints
 * Clean up old checkpoints based on retention policy (Epic 007-D)
 */
export const cleanupCheckpointsTool: ToolDefinition = {
  name: 'mcp_meta_cleanup_checkpoints',
  description:
    'Clean up checkpoints older than retention period (default 30 days)',
  inputSchema: {
    type: 'object',
    properties: {
      retention_days: {
        type: 'number',
        description: 'Number of days to retain (default 30)',
        default: 30,
        minimum: 1,
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const manager = getCheckpointManager();
      const result = await manager.cleanupCheckpoints(input.retention_days || 30);

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`Cleanup checkpoints slow: ${duration}ms`);
      }

      const freedMB = (result.freed_bytes / (1024 * 1024)).toFixed(2);

      return {
        success: true,
        deleted_count: result.deleted_count,
        freed_bytes: result.freed_bytes,
        freed_mb: freedMB,
        retention_days: result.retention_days,
      };
    } catch (error: any) {
      console.error('Cleanup checkpoints failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to cleanup checkpoints',
      };
    }
  },
};

/**
 * Tool: mcp_meta_resume_instance (Epic 007-E)
 * Resume a stale instance by ID, project, epic, or newest
 */
export const resumeInstanceTool: ToolDefinition = {
  name: 'mcp_meta_resume_instance',
  description:
    'Resume a stale PS/MS instance by ID (exact/partial), project name, epic ID, or newest. Returns context summary, confidence score, and next steps.',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id_hint: {
        type: 'string',
        description:
          'Instance hint: full ID ("odin-PS-8f4a2b"), partial ("8f4a"), project ("odin"), epic ("epic-003"), or omit for newest',
      },
      user_choice: {
        type: 'number',
        description:
          'If disambiguation shows multiple matches, specify choice (1, 2, 3, etc.)',
        minimum: 1,
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await resumeInstance(input.instance_id_hint, input.user_choice);

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`Resume instance slow: ${duration}ms`);
      }

      return result;
    } catch (error: any) {
      console.error('Resume instance failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to resume instance',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_resume_instance_details (Epic 007-E)
 * Get detailed information about an instance for resume context
 */
export const getResumeInstanceDetailsTool: ToolDefinition = {
  name: 'mcp_meta_get_resume_instance_details',
  description:
    'Get detailed instance information including recent commands, checkpoint info, and context state',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await getResumeInstanceDetails(input.instance_id);

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`Get resume instance details slow: ${duration}ms`);
      }

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('Get resume instance details failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get instance details',
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_stale_instances (Epic 007-E)
 * List all stale instances (heartbeat >2 min ago) for cleanup or resume
 */
export const listStaleInstancesTool: ToolDefinition = {
  name: 'mcp_meta_list_stale_instances',
  description:
    'List all stale instances (last heartbeat >2 minutes ago) sorted by most recent',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await listStaleInstances();

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`List stale instances slow: ${duration}ms`);
      }

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('List stale instances failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to list stale instances',
      };
    }
  },
};

/**
 * Tool: mcp_meta_link_claude_session
 * Link a Claude Code session to an existing instance (Epic 009-A)
 * Used for post-registration linking when Claude session UUID is discovered later
 */
export const linkClaudeSessionTool: ToolDefinition = {
  name: 'mcp_meta_link_claude_session',
  description:
    'Link a Claude Code session transcript to an existing supervisor instance for transcript lookup (Epic 009-A)',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to link to',
      },
      claude_session_uuid: {
        type: 'string',
        description: 'Claude Code session UUID from ~/.claude/projects/[project]/[uuid].jsonl',
      },
      claude_session_path: {
        type: 'string',
        description: 'Optional full path to Claude Code transcript file. Auto-resolved from UUID if not provided.',
      },
    },
    required: ['instance_id', 'claude_session_uuid'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const instance = await linkClaudeSession(
        input.instance_id,
        input.claude_session_uuid,
        input.claude_session_path
      );

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`Link Claude session slow: ${duration}ms for ${instance.instance_id}`);
      }

      return {
        success: true,
        instance_id: instance.instance_id,
        project: instance.project,
        claude_session_uuid: instance.claude_session_uuid,
        claude_session_path: instance.claude_session_path,
      };
    } catch (error: any) {
      if (error instanceof InstanceNotFoundError) {
        return {
          success: false,
          error: error.message,
        };
      }

      console.error('Link Claude session failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to link Claude session',
      };
    }
  },
};

/**
 * Export all session tools
 */
export function getSessionTools(): ToolDefinition[] {
  return [
    // Epic 007-A: Instance Registry
    registerInstanceTool,
    heartbeatTool,
    listInstancesTool,
    getInstanceDetailsTool,
    // Epic 009-A: Claude Session Reference
    linkClaudeSessionTool,
    // Epic 007-B: Command Logging
    logCommandTool,
    searchCommandsTool,
    // Epic 007-C: Event Store
    emitEventTool,
    queryEventsTool,
    replayEventsTool,
    listEventTypesTool,
    // Epic 007-D: Checkpoint System
    createCheckpointTool,
    getCheckpointTool,
    listCheckpointsTool,
    cleanupCheckpointsTool,
    // Epic 007-E: Resume Engine
    resumeInstanceTool,
    getResumeInstanceDetailsTool,
    listStaleInstancesTool,
  ];
}

export const sessionTools = getSessionTools();
