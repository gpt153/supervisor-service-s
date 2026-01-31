/**
 * Event Lineage Debugging and Analysis MCP Tools (Epic 008-D)
 *
 * Provides MCP tools for querying event lineage, enabling:
 * - get_parent_chain: Get parent chain for debugging
 * - get_event_tree: Get all descendants of an event
 * - get_failure_chain: Get most recent failure with chain
 * - analyze_performance: Aggregate stats by event type
 * - smart_resume_context: Reconstruct context using lineage
 * - export_session: Export session events in specified format
 */

import { pool } from '../../db/client.js';
import { ToolDefinition, ProjectContext } from '../../types/project.js';

/**
 * Tool: mcp_meta_get_parent_chain
 * Get parent chain from an event back to root
 */
export const getParentChainTool: ToolDefinition = {
  name: 'mcp_meta_get_parent_chain',
  description: 'Get parent chain for debugging - returns all ancestors of an event from root to specified event',
  inputSchema: {
    type: 'object',
    properties: {
      event_uuid: {
        type: 'string',
        description: 'Event UUID to get parent chain for',
      },
      max_depth: {
        type: 'number',
        description: 'Optional maximum chain depth (default: 1000)',
        default: 1000,
      },
    },
    required: ['event_uuid'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await pool.query(
        `SELECT uuid, event_type, "timestamp", event_data, depth
         FROM get_parent_chain($1::uuid, $2::integer)
         ORDER BY depth ASC`,
        [input.event_uuid, input.max_depth || 1000]
      );

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`getParentChain slow: ${duration}ms`);
      }

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Event not found',
          event_uuid: input.event_uuid,
        };
      }

      return {
        success: true,
        chain: result.rows.map((row: any) => ({
          uuid: row.uuid,
          event_type: row.event_type,
          timestamp: row.timestamp.toISOString(),
          event_data: row.event_data,
          depth: row.depth,
        })),
        total_depth: result.rows.length > 0 ? result.rows[result.rows.length - 1].depth : 0,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('getParentChain failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get parent chain',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_event_tree
 * Get all descendants of an event
 */
export const getEventTreeTool: ToolDefinition = {
  name: 'mcp_meta_get_event_tree',
  description: 'Get all descendants of an event - returns tree structure of all child events',
  inputSchema: {
    type: 'object',
    properties: {
      root_uuid: {
        type: 'string',
        description: 'Root event UUID to get tree for',
      },
      max_depth: {
        type: 'number',
        description: 'Optional maximum tree depth (default: 10)',
        default: 10,
      },
    },
    required: ['root_uuid'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await pool.query(
        `SELECT uuid, event_type, "timestamp", event_data, depth
         FROM get_event_tree($1::uuid, $2::integer)
         ORDER BY depth ASC, "timestamp" ASC
         LIMIT 1000`,
        [input.root_uuid, input.max_depth || 10]
      );

      const duration = Date.now() - start;

      if (duration > 200) {
        console.warn(`getEventTree slow: ${duration}ms`);
      }

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Root event not found',
          root_uuid: input.root_uuid,
        };
      }

      // Build tree structure
      const tree = result.rows.map((row: any) => ({
        uuid: row.uuid,
        event_type: row.event_type,
        timestamp: row.timestamp.toISOString(),
        event_data: row.event_data,
        depth: row.depth,
      }));

      return {
        success: true,
        tree,
        total_nodes: tree.length,
        max_depth_found: Math.max(...tree.map((n: any) => n.depth)),
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('getEventTree failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get event tree',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_failure_chain
 * Get most recent failure event with full parent chain
 */
export const getFailureChainTool: ToolDefinition = {
  name: 'mcp_meta_get_failure_chain',
  description: 'Get most recent failure event with full parent chain - enables quick debugging',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to search for failures',
      },
      epic_id: {
        type: 'string',
        description: 'Optional epic ID to filter failures',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Find most recent failure event (error or failed event)
      let query = `
        SELECT event_id
        FROM event_store
        WHERE instance_id = $1
          AND event_type IN ('error', 'epic_failed', 'deployment_failed', 'test_failed', 'validation_failed')
      `;
      const params: any[] = [input.instance_id];

      if (input.epic_id) {
        query += ` AND event_data->>'epic_id' = $${params.length + 1}`;
        params.push(input.epic_id);
      }

      query += ` ORDER BY timestamp DESC LIMIT 1`;

      const failureResult = await pool.query(query, params);

      if (failureResult.rows.length === 0) {
        return {
          success: true,
          error: 'No failures found',
          instance_id: input.instance_id,
          epic_id: input.epic_id || null,
        };
      }

      const failureUuid = failureResult.rows[0].event_id;

      // Get parent chain for failure
      const chainResult = await pool.query(
        `SELECT uuid, event_type, "timestamp", event_data, depth
         FROM get_parent_chain($1::uuid, $2::integer)
         ORDER BY depth ASC`,
        [failureUuid, 1000]
      );

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`getFailureChain slow: ${duration}ms`);
      }

      const chain = chainResult.rows.map((row: any) => ({
        uuid: row.uuid,
        event_type: row.event_type,
        timestamp: row.timestamp.toISOString(),
        event_data: row.event_data,
        depth: row.depth,
      }));

      // Extract failure details
      const failureEvent = chain[chain.length - 1];

      return {
        success: true,
        failure: {
          uuid: failureEvent.uuid,
          event_type: failureEvent.event_type,
          timestamp: failureEvent.timestamp,
          event_data: failureEvent.event_data,
          depth: failureEvent.depth,
        },
        parent_chain: chain.slice(0, -1),
        chain_length: chain.length,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('getFailureChain failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get failure chain',
      };
    }
  },
};

/**
 * Tool: mcp_meta_analyze_performance
 * Aggregate performance stats by event type
 */
export const analyzePerformanceTool: ToolDefinition = {
  name: 'mcp_meta_analyze_performance',
  description: 'Analyze performance metrics aggregated by event type - identifies slow operations',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to analyze',
      },
      time_range: {
        type: 'object',
        description: 'Optional time range filter',
        properties: {
          start: {
            type: 'string',
            description: 'Start time (ISO 8601)',
          },
          end: {
            type: 'string',
            description: 'End time (ISO 8601)',
          },
        },
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      let query = `
        SELECT
          event_type,
          COUNT(*) as count,
          AVG(COALESCE((event_data->>'duration_ms')::numeric, 0)) as avg_duration_ms,
          MAX(COALESCE((event_data->>'duration_ms')::numeric, 0)) as max_duration_ms,
          MIN(COALESCE((event_data->>'duration_ms')::numeric, 0)) as min_duration_ms
        FROM event_store
        WHERE instance_id = $1
      `;
      const params: any[] = [input.instance_id];

      if (input.time_range?.start) {
        query += ` AND timestamp >= $${params.length + 1}::timestamptz`;
        params.push(input.time_range.start);
      }

      if (input.time_range?.end) {
        query += ` AND timestamp <= $${params.length + 1}::timestamptz`;
        params.push(input.time_range.end);
      }

      query += `
        GROUP BY event_type
        ORDER BY avg_duration_ms DESC NULLS LAST
        LIMIT 100
      `;

      const result = await pool.query(query, params);

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`analyzePerformance slow: ${duration}ms`);
      }

      const stats = result.rows.map((row: any) => ({
        event_type: row.event_type,
        count: parseInt(row.count),
        avg_duration_ms: row.avg_duration_ms ? parseFloat(row.avg_duration_ms) : 0,
        max_duration_ms: row.max_duration_ms ? parseFloat(row.max_duration_ms) : 0,
        min_duration_ms: row.min_duration_ms ? parseFloat(row.min_duration_ms) : 0,
      }));

      return {
        success: true,
        stats,
        total_event_types: stats.length,
        slowest_type: stats[0]?.event_type || null,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('analyzePerformance failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze performance',
      };
    }
  },
};

/**
 * Tool: mcp_meta_smart_resume_context
 * Reconstruct context using lineage for session resume
 */
export const smartResumeContextTool: ToolDefinition = {
  name: 'mcp_meta_smart_resume_context',
  description: 'Reconstruct session context using event lineage - provides context for session resume',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to reconstruct context for',
      },
      max_events: {
        type: 'number',
        description: 'Maximum number of recent events to include (default: 50)',
        default: 50,
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Get most recent events
      const recentResult = await pool.query(
        `SELECT event_id, event_type, timestamp, event_data, parent_uuid, root_uuid, depth
         FROM event_store
         WHERE instance_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [input.instance_id, input.max_events || 50]
      );

      // Get current epic from most recent epic events
      const epicResult = await pool.query(
        `SELECT event_data->>'epic_id' as epic_id
         FROM event_store
         WHERE instance_id = $1
           AND event_data->>'epic_id' IS NOT NULL
         ORDER BY timestamp DESC
         LIMIT 1`,
        [input.instance_id]
      );

      // Get parent chain for most recent event if it exists
      let parentChain: any[] = [];
      if (recentResult.rows.length > 0) {
        const mostRecentEvent = recentResult.rows[0];
        const chainResult = await pool.query(
          `SELECT uuid, event_type, "timestamp", event_data, depth
           FROM get_parent_chain($1::uuid, $2::integer)
           ORDER BY depth ASC
           LIMIT 50`,
          [mostRecentEvent.event_id, 50]
        );
        parentChain = chainResult.rows.map((row: any) => ({
          uuid: row.uuid,
          event_type: row.event_type,
          timestamp: row.timestamp.toISOString(),
          depth: row.depth,
        }));
      }

      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`smartResumeContext slow: ${duration}ms`);
      }

      const currentEpic = epicResult.rows[0]?.epic_id || null;
      const recentEvents = recentResult.rows.map((row: any) => ({
        event_id: row.event_id,
        event_type: row.event_type,
        timestamp: row.timestamp.toISOString(),
        depth: row.depth,
      }));

      return {
        success: true,
        instance_id: input.instance_id,
        current_epic: currentEpic,
        recent_events: recentEvents,
        parent_chain: parentChain,
        total_recent_events: recentEvents.length,
        chain_depth: parentChain.length,
        last_event_type: recentEvents[0]?.event_type || null,
        last_event_time: recentEvents[0]?.timestamp || null,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('smartResumeContext failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get resume context',
      };
    }
  },
};

/**
 * Tool: mcp_meta_export_session
 * Export session events in specified format
 */
export const exportSessionTool: ToolDefinition = {
  name: 'mcp_meta_export_session',
  description: 'Export session events in specified format - compatible with external analysis',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to export',
      },
      format: {
        type: 'string',
        enum: ['json', 'jsonl'],
        description: 'Export format: json (array) or jsonl (newline-delimited)',
        default: 'jsonl',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of events to export (default: 10000)',
        default: 10000,
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      // Export events with pagination to avoid memory bloat
      const result = await pool.query(
        `SELECT event_id, instance_id, event_type, "timestamp", sequence_num,
                event_data, parent_uuid, root_uuid, depth
         FROM event_store
         WHERE instance_id = $1
         ORDER BY "timestamp" ASC
         LIMIT $2`,
        [input.instance_id, input.limit || 10000]
      );

      const duration = Date.now() - start;

      if (duration > 500) {
        console.warn(`exportSession slow: ${duration}ms`);
      }

      const events = result.rows.map((row: any) => ({
        event_id: row.event_id,
        instance_id: row.instance_id,
        event_type: row.event_type,
        timestamp: row.timestamp.toISOString(),
        sequence_num: row.sequence_num,
        event_data: row.event_data,
        parent_uuid: row.parent_uuid,
        root_uuid: row.root_uuid,
        depth: row.depth,
      }));

      let exportedData: any;
      if (input.format === 'jsonl') {
        // Newline-delimited JSON
        exportedData = events.map((e: any) => JSON.stringify(e)).join('\n');
      } else {
        // Regular JSON array
        exportedData = events;
      }

      return {
        success: true,
        instance_id: input.instance_id,
        format: input.format || 'jsonl',
        event_count: events.length,
        data: exportedData,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('exportSession failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to export session',
      };
    }
  },
};

/**
 * Tool: mcp_meta_get_event_lineage_stats
 * Get statistics about event lineage depth and structure
 */
export const getEventLineageStatsTool: ToolDefinition = {
  name: 'mcp_meta_get_event_lineage_stats',
  description: 'Get statistics about event lineage - depth distribution and chain metrics',
  inputSchema: {
    type: 'object',
    properties: {
      instance_id: {
        type: 'string',
        description: 'Instance ID to analyze',
      },
    },
    required: ['instance_id'],
  },
  handler: async (input: any, context: ProjectContext) => {
    const start = Date.now();

    try {
      const result = await pool.query(
        `SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT root_uuid) as root_count,
          COUNT(DISTINCT CASE WHEN parent_uuid IS NULL THEN event_id END) as root_events,
          AVG(depth) as avg_depth,
          MAX(depth) as max_depth,
          MIN(depth) as min_depth,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY depth) as median_depth
         FROM event_store
         WHERE instance_id = $1`,
        [input.instance_id]
      );

      const duration = Date.now() - start;

      if (duration > 50) {
        console.warn(`getEventLineageStats slow: ${duration}ms`);
      }

      const stats = result.rows[0];

      return {
        success: true,
        instance_id: input.instance_id,
        total_events: parseInt(stats.total_events),
        root_count: parseInt(stats.root_count),
        root_events: parseInt(stats.root_events),
        avg_depth: stats.avg_depth ? parseFloat(stats.avg_depth) : 0,
        max_depth: stats.max_depth ? parseInt(stats.max_depth) : 0,
        min_depth: stats.min_depth ? parseInt(stats.min_depth) : 0,
        median_depth: stats.median_depth ? parseFloat(stats.median_depth) : 0,
        query_time_ms: duration,
      };
    } catch (error: any) {
      console.error('getEventLineageStats failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get lineage stats',
      };
    }
  },
};

/**
 * Export all lineage tools
 */
export function getLineageTools(): ToolDefinition[] {
  return [
    getParentChainTool,
    getEventTreeTool,
    getFailureChainTool,
    analyzePerformanceTool,
    smartResumeContextTool,
    exportSessionTool,
    getEventLineageStatsTool,
  ];
}

export const lineageTools = getLineageTools();
