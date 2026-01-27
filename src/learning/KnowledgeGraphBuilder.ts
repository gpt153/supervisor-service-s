/**
 * Knowledge Graph Builder
 * Epic: 006-F
 *
 * Builds knowledge graph of failure → fix relationships
 */

import { getReliableLearnings } from '../db/queries/fix-learnings.js';
import type { FixLearning } from '../types/fixing.js';

/**
 * Node in knowledge graph
 */
interface GraphNode {
  id: string;
  type: 'failure' | 'strategy' | 'category';
  label: string;
  metadata?: any;
}

/**
 * Edge in knowledge graph
 */
interface GraphEdge {
  from: string;
  to: string;
  weight: number; // Success rate
  metadata?: any;
}

/**
 * Knowledge graph
 */
interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class KnowledgeGraphBuilder {
  /**
   * Build knowledge graph from learnings
   *
   * @returns Knowledge graph
   */
  async build(): Promise<KnowledgeGraph> {
    const result = await getReliableLearnings(0.5); // Include all with >50% success
    if (!result.success || !result.data) {
      return { nodes: [], edges: [] };
    }

    const learnings = result.data;
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    for (const learning of learnings) {
      // Create failure node
      const failureId = `failure:${this.sanitizeId(learning.failure_pattern)}`;
      if (!nodeIds.has(failureId)) {
        nodes.push({
          id: failureId,
          type: 'failure',
          label: learning.failure_pattern,
          metadata: {
            complexity: learning.complexity,
            error_regex: learning.error_regex,
            file_pattern: learning.file_pattern
          }
        });
        nodeIds.add(failureId);
      }

      // Create strategy node
      const strategyId = `strategy:${learning.fix_strategy}`;
      if (!nodeIds.has(strategyId)) {
        nodes.push({
          id: strategyId,
          type: 'strategy',
          label: learning.fix_strategy,
          metadata: {}
        });
        nodeIds.add(strategyId);
      }

      // Create edge from failure to strategy
      edges.push({
        from: failureId,
        to: strategyId,
        weight: learning.success_rate || 0,
        metadata: {
          times_tried: learning.times_tried,
          times_succeeded: learning.times_succeeded
        }
      });

      // Create category node if complexity exists
      if (learning.complexity) {
        const categoryId = `category:${learning.complexity}`;
        if (!nodeIds.has(categoryId)) {
          nodes.push({
            id: categoryId,
            type: 'category',
            label: learning.complexity,
            metadata: {}
          });
          nodeIds.add(categoryId);
        }

        // Edge from failure to category
        edges.push({
          from: failureId,
          to: categoryId,
          weight: 1.0, // Fixed relationship
          metadata: {}
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Export graph as DOT format (Graphviz)
   *
   * @returns DOT string
   */
  async exportAsDot(): Promise<string> {
    const graph = await this.build();
    const lines: string[] = [];

    lines.push('digraph KnowledgeGraph {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box];');
    lines.push('');

    // Add nodes
    for (const node of graph.nodes) {
      const color = node.type === 'failure' ? 'lightblue' : node.type === 'strategy' ? 'lightgreen' : 'lightyellow';
      lines.push(`  "${node.id}" [label="${node.label}", fillcolor="${color}", style=filled];`);
    }

    lines.push('');

    // Add edges
    for (const edge of graph.edges) {
      const weight = (edge.weight * 100).toFixed(0);
      lines.push(`  "${edge.from}" -> "${edge.to}" [label="${weight}%"];`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Export graph as JSON
   *
   * @returns JSON string
   */
  async exportAsJson(): Promise<string> {
    const graph = await this.build();
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Get graph statistics
   *
   * @returns Statistics about the graph
   */
  async getStats(): Promise<{
    total_nodes: number;
    total_edges: number;
    failure_nodes: number;
    strategy_nodes: number;
    category_nodes: number;
    avg_edge_weight: number;
  }> {
    const graph = await this.build();

    const failureNodes = graph.nodes.filter(n => n.type === 'failure').length;
    const strategyNodes = graph.nodes.filter(n => n.type === 'strategy').length;
    const categoryNodes = graph.nodes.filter(n => n.type === 'category').length;

    const avgWeight = graph.edges.length > 0
      ? graph.edges.reduce((sum, e) => sum + e.weight, 0) / graph.edges.length
      : 0;

    return {
      total_nodes: graph.nodes.length,
      total_edges: graph.edges.length,
      failure_nodes: failureNodes,
      strategy_nodes: strategyNodes,
      category_nodes: categoryNodes,
      avg_edge_weight: avgWeight
    };
  }

  /**
   * Find paths from failure to strategy
   *
   * @param failurePattern - Failure pattern to find paths for
   * @returns List of paths (strategy chains)
   */
  async findPaths(failurePattern: string): Promise<Array<{ strategy: string; weight: number }>> {
    const graph = await this.build();
    const failureId = `failure:${this.sanitizeId(failurePattern)}`;

    const paths: Array<{ strategy: string; weight: number }> = [];

    for (const edge of graph.edges) {
      if (edge.from === failureId && edge.to.startsWith('strategy:')) {
        paths.push({
          strategy: edge.to.replace('strategy:', ''),
          weight: edge.weight
        });
      }
    }

    // Sort by weight descending
    paths.sort((a, b) => b.weight - a.weight);

    return paths;
  }

  /**
   * Get most successful strategies
   *
   * @param limit - Number of strategies to return
   * @returns Top strategies by success rate
   */
  async getTopStrategies(limit: number = 5): Promise<Array<{ strategy: string; avg_success: number; uses: number }>> {
    const graph = await this.build();
    const strategyStats = new Map<string, { totalWeight: number; count: number }>();

    for (const edge of graph.edges) {
      if (edge.to.startsWith('strategy:')) {
        const strategy = edge.to.replace('strategy:', '');
        const existing = strategyStats.get(strategy) || { totalWeight: 0, count: 0 };
        existing.totalWeight += edge.weight;
        existing.count += 1;
        strategyStats.set(strategy, existing);
      }
    }

    const topStrategies = Array.from(strategyStats.entries())
      .map(([strategy, stats]) => ({
        strategy,
        avg_success: stats.totalWeight / stats.count,
        uses: stats.count
      }))
      .sort((a, b) => b.avg_success - a.avg_success)
      .slice(0, limit);

    return topStrategies;
  }

  /**
   * Sanitize ID for graph node
   *
   * @param text - Text to sanitize
   * @returns Sanitized ID
   */
  private sanitizeId(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50);
  }
}
