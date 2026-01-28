/**
 * Event Store MCP Tools (Epic 007-C)
 * Provides MCP tools for event emission, querying, replaying, and listing
 *
 * Exported tools:
 * - mcp_meta_emit_event: Emit new event for instance
 * - mcp_meta_query_events: Query events with filtering
 * - mcp_meta_replay_events: Replay events to reconstruct state
 * - mcp_meta_list_event_types: List all available event types with schemas
 */

import {
  emitEvent,
  queryEvents,
  replayEvents,
  aggregateEventsByType,
  getLatestEvents,
  InvalidEventError,
  InstanceNotFoundForEventError,
  EventStoreError,
} from '../../session/EventStore.js';
import {
  EventType,
  EventTypeDefinition,
  EventCategory,
  EmitEventInputSchema,
  QueryEventsInputSchema,
  ReplayEventsInputSchema,
  EventTypeSchema,
  EventItem,
} from '../../types/event-store.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

/**
 * Event type descriptions for tool listing
 */
const EVENT_TYPE_DEFINITIONS: Record<string, EventTypeDefinition> = {
  instance_registered: {
    type: 'instance_registered',
    category: EventCategory.INSTANCE,
    description: 'Emitted when new PS/MS instance starts',
    required_fields: ['instance_type', 'project'],
    optional_fields: ['created_at'],
  },
  instance_heartbeat: {
    type: 'instance_heartbeat',
    category: EventCategory.INSTANCE,
    description: 'Periodic heartbeat to track instance liveness',
    required_fields: ['context_percent'],
    optional_fields: ['current_epic', 'age_seconds'],
  },
  instance_stale: {
    type: 'instance_stale',
    category: EventCategory.INSTANCE,
    description: 'Instance detected as stale (no heartbeat for 120s)',
    required_fields: ['last_heartbeat', 'age_seconds'],
    optional_fields: ['reason'],
  },
  epic_started: {
    type: 'epic_started',
    category: EventCategory.EPIC,
    description: 'Epic implementation begins',
    required_fields: ['epic_id', 'feature_name', 'estimated_hours', 'spawned_by'],
    optional_fields: ['acceptance_criteria_count', 'description'],
  },
  epic_completed: {
    type: 'epic_completed',
    category: EventCategory.EPIC,
    description: 'Epic implementation completed successfully',
    required_fields: ['epic_id', 'duration_hours', 'files_changed', 'tests_passed'],
    optional_fields: ['pr_url', 'validation_confidence', 'issues_encountered'],
  },
  epic_failed: {
    type: 'epic_failed',
    category: EventCategory.EPIC,
    description: 'Epic implementation failed',
    required_fields: ['epic_id', 'failure_reason'],
    optional_fields: ['error_message', 'attempts', 'last_error_type'],
  },
  test_started: {
    type: 'test_started',
    category: EventCategory.TESTING,
    description: 'Test execution begins',
    required_fields: ['test_type', 'test_count'],
    optional_fields: ['epic_id', 'description'],
  },
  test_passed: {
    type: 'test_passed',
    category: EventCategory.TESTING,
    description: 'Tests passed successfully',
    required_fields: ['test_type', 'passed_count', 'failed_count', 'duration_seconds'],
    optional_fields: ['epic_id', 'coverage_percent', 'skipped_count'],
  },
  test_failed: {
    type: 'test_failed',
    category: EventCategory.TESTING,
    description: 'Tests failed',
    required_fields: ['test_type', 'failed_count', 'duration_seconds'],
    optional_fields: ['epic_id', 'error_summary'],
  },
  validation_passed: {
    type: 'validation_passed',
    category: EventCategory.TESTING,
    description: 'Validation/quality checks passed',
    required_fields: ['validation_type', 'confidence_score', 'duration_seconds'],
    optional_fields: ['epic_id', 'checks_passed', 'checks_total'],
  },
  validation_failed: {
    type: 'validation_failed',
    category: EventCategory.TESTING,
    description: 'Validation/quality checks failed',
    required_fields: ['validation_type', 'failed_checks'],
    optional_fields: ['epic_id', 'failure_reason', 'recommendation'],
  },
  commit_created: {
    type: 'commit_created',
    category: EventCategory.GIT,
    description: 'Code committed',
    required_fields: ['commit_hash', 'message'],
    optional_fields: ['epic_id', 'branch', 'files_changed', 'lines_added', 'lines_removed'],
  },
  pr_created: {
    type: 'pr_created',
    category: EventCategory.GIT,
    description: 'Pull request created',
    required_fields: ['pr_url', 'pr_number', 'title'],
    optional_fields: ['epic_id', 'branch', 'description', 'files_changed', 'commits'],
  },
  pr_merged: {
    type: 'pr_merged',
    category: EventCategory.GIT,
    description: 'Pull request merged',
    required_fields: ['pr_url', 'pr_number', 'merge_commit'],
    optional_fields: ['epic_id', 'merged_at', 'duration_hours'],
  },
  deployment_started: {
    type: 'deployment_started',
    category: EventCategory.DEPLOYMENT,
    description: 'Deployment begins',
    required_fields: ['service', 'environment', 'deployment_type'],
    optional_fields: ['port', 'version'],
  },
  deployment_completed: {
    type: 'deployment_completed',
    category: EventCategory.DEPLOYMENT,
    description: 'Deployment completed successfully',
    required_fields: ['service', 'environment', 'health_status', 'duration_seconds'],
    optional_fields: ['port', 'response_time_ms', 'git_commit', 'docker_image'],
  },
  deployment_failed: {
    type: 'deployment_failed',
    category: EventCategory.DEPLOYMENT,
    description: 'Deployment failed',
    required_fields: ['service', 'environment', 'error_message', 'duration_seconds'],
    optional_fields: ['error_type', 'rollback_performed'],
  },
  context_window_updated: {
    type: 'context_window_updated',
    category: EventCategory.WORK_STATE,
    description: 'Context window usage changed',
    required_fields: ['context_percent', 'tokens_used', 'tokens_available'],
    optional_fields: ['checkpoint_triggered'],
  },
  checkpoint_created: {
    type: 'checkpoint_created',
    category: EventCategory.WORK_STATE,
    description: 'Checkpoint created for context recovery',
    required_fields: ['checkpoint_id', 'context_percent', 'reason'],
    optional_fields: ['state_keys', 'size_bytes'],
  },
  checkpoint_loaded: {
    type: 'checkpoint_loaded',
    category: EventCategory.WORK_STATE,
    description: 'Checkpoint restored',
    required_fields: ['checkpoint_id', 'context_percent', 'reason'],
    optional_fields: ['state_keys', 'duration_seconds'],
  },
  epic_planned: {
    type: 'epic_planned',
    category: EventCategory.PLANNING,
    description: 'Epic planning completed',
    required_fields: ['epic_id', 'feature_name', 'estimated_hours'],
    optional_fields: ['complexity', 'acceptance_criteria_count', 'dependencies'],
  },
  feature_requested: {
    type: 'feature_requested',
    category: EventCategory.PLANNING,
    description: 'New feature requested',
    required_fields: ['feature_name', 'requested_by'],
    optional_fields: ['description', 'priority', 'estimated_hours'],
  },
  task_spawned: {
    type: 'task_spawned',
    category: EventCategory.PLANNING,
    description: 'Subagent task spawned',
    required_fields: ['task_type', 'subagent_type'],
    optional_fields: ['task_id', 'epic_id', 'model', 'expected_duration_seconds'],
  },
};

/**
 * Tool: mcp_meta_emit_event
 * Emit a new event for an instance
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
        enum: Object.values(EventType),
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
        console.warn(`emitEventTool slow: ${duration}ms`);
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

      console.error('emitEventTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to emit event',
      };
    }
  },
};

/**
 * Tool: mcp_meta_query_events
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
        console.warn(`queryEventsTool slow: ${duration}ms`);
      }

      return {
        success: true,
        events: result.events,
        total_count: result.total_count,
        has_more: result.has_more,
      };
    } catch (error: any) {
      console.error('queryEventsTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to query events',
      };
    }
  },
};

/**
 * Tool: mcp_meta_replay_events
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
        console.warn(`replayEventsTool slow: ${duration}ms`);
      }

      return {
        success: true,
        final_state: result.final_state,
        events_replayed: result.events_replayed,
        duration_ms: result.duration_ms,
      };
    } catch (error: any) {
      console.error('replayEventsTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to replay events',
      };
    }
  },
};

/**
 * Tool: mcp_meta_list_event_types
 * List all available event types with descriptions and schemas
 */
export const listEventTypesTool: ToolDefinition = {
  name: 'mcp_meta_list_event_types',
  description: 'List all available event types with descriptions and schemas',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: Object.values(EventCategory),
        description: 'Optional category filter',
      },
    },
  },
  handler: async (input: any, context: ProjectContext) => {
    try {
      let definitions = Object.values(EVENT_TYPE_DEFINITIONS);

      // Filter by category if provided
      if (input.category) {
        definitions = definitions.filter((d) => d.category === input.category);
      }

      return {
        success: true,
        event_types: definitions,
        total_count: definitions.length,
      };
    } catch (error: any) {
      console.error('listEventTypesTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to list event types',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_event_aggregates
 * Get event counts by type for an instance
 */
export const getEventAggregatesTool: ToolDefinition = {
  name: 'mcp_meta_get_event_aggregates',
  description: 'Get event counts aggregated by type for an instance',
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
    try {
      const aggregates = await aggregateEventsByType(input.instance_id);

      return {
        success: true,
        aggregates,
        total_events: Object.values(aggregates).reduce((sum: number, count: any) => sum + count, 0),
      };
    } catch (error: any) {
      console.error('getEventAggregatesTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get event aggregates',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_latest_events
 * Get most recent events for an instance
 */
export const getLatestEventsTool: ToolDefinition = {
  name: 'mcp_meta_get_latest_events',
  description: 'Get most recent events for an instance',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID',
      },
      limit: {
        type: 'number',
        description: 'Number of events to return (default 10, max 100)',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    try {
      const events = await getLatestEvents(input.instance_id, input.limit || 10);

      return {
        success: true,
        events,
        count: events.length,
      };
    } catch (error: any) {
      console.error('getLatestEventsTool failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get latest events',
      };
    }
  },
};

/**
 * Export all event store tools
 */
export function getEventStoreTools(): ToolDefinition[] {
  return [
    emitEventTool,
    queryEventsTool,
    replayEventsTool,
    listEventTypesTool,
    getEventAggregatesTool,
    getLatestEventsTool,
  ];
}

export const eventStoreTools = getEventStoreTools();
