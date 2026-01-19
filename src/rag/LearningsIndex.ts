/**
 * LearningsIndex - RAG-based learning system for supervisor knowledge
 *
 * Provides semantic search over learning files using pgvector.
 * Integrates with existing database schema from migration 005.
 */

import { pool } from '../db/client.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type {
  Learning,
  LearningType,
  ImpactLevel,
  CreateLearningParams,
  SearchLearningsParams,
  SearchLearningsResult,
  LearningApplication,
  ApplicationTargetType,
  ApplicationOutcome,
} from '../types/database.js';

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'text-embedding-ada-002') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0].embedding;
  }
}

/**
 * Parsed learning file structure
 */
interface ParsedLearning {
  id: string;
  title: string;
  date: string;
  severity: ImpactLevel;
  category: string;
  tags: string[];
  content: string;
  learningType: LearningType;
}

/**
 * Learning search options
 */
export interface SearchLearningOptions {
  project_id?: string;
  category?: string;
  impact_level?: ImpactLevel;
  limit?: number;
  min_similarity?: number;
}

/**
 * Learning statistics
 */
export interface LearningStats {
  total_learnings: number;
  by_category: Record<string, number>;
  by_impact: Record<ImpactLevel, number>;
  by_type: Record<LearningType, number>;
  most_used: Array<{
    id: string;
    title: string;
    usage_count: number;
  }>;
  effectiveness_summary: {
    avg_success_rate: number;
    total_applications: number;
  };
}

/**
 * LearningsIndex - Main class for learning management
 */
export class LearningsIndex {
  private embeddingProvider: EmbeddingProvider;
  private learningsDir: string;

  constructor(
    embeddingProvider: EmbeddingProvider,
    learningsDir: string = '/home/samuel/sv/docs/supervisor-learnings/learnings'
  ) {
    this.embeddingProvider = embeddingProvider;
    this.learningsDir = learningsDir;
  }

  /**
   * Parse a learning markdown file
   */
  private parseLearningFile(filePath: string, content: string): ParsedLearning {
    const fileName = path.basename(filePath);
    const id = fileName.replace(/\.md$/, '');

    // Extract metadata from frontmatter-style headers
    const titleMatch = content.match(/^#\s+Learning\s+\d+:\s*(.+?)$/m);
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+?)$/m);
    const severityMatch = content.match(/\*\*Severity:\*\*\s*(.+?)$/mi);
    const categoryMatch = content.match(/\*\*Category:\*\*\s*(.+?)$/mi);
    const tagsMatch = content.match(/\*\*Tags:\*\*\s*(.+?)$/mi);

    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Learning';
    const date = dateMatch ? dateMatch[1].trim() : new Date().toISOString().split('T')[0];
    const severityRaw = severityMatch ? severityMatch[1].trim().toLowerCase() : 'medium';
    const category = categoryMatch ? categoryMatch[1].trim() : 'general';
    const tags = tagsMatch
      ? tagsMatch[1].split(',').map(t => t.trim())
      : [];

    // Map severity to impact level
    const severity = this.mapSeverityToImpact(severityRaw);

    // Infer learning type from content
    const learningType = this.inferLearningType(content, title);

    return {
      id,
      title,
      date,
      severity,
      category,
      tags,
      content,
      learningType,
    };
  }

  /**
   * Map severity string to ImpactLevel
   */
  private mapSeverityToImpact(severity: string): ImpactLevel {
    const s = severity.toLowerCase();
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'low') return 'low';
    return 'medium';
  }

  /**
   * Infer learning type from content
   */
  private inferLearningType(content: string, title: string): LearningType {
    const lower = (content + title).toLowerCase();

    if (lower.includes('never') || lower.includes('anti-pattern') || lower.includes('avoid')) {
      return 'antipattern';
    }
    if (lower.includes('best practice') || lower.includes('recommended')) {
      return 'best_practice';
    }
    if (lower.includes('pattern') || lower.includes('template')) {
      return 'pattern';
    }
    if (lower.includes('tip') || lower.includes('quick')) {
      return 'tip';
    }

    return 'lesson_learned';
  }

  /**
   * Chunk text into smaller pieces for embedding
   */
  private chunkText(text: string, maxChunkSize: number = 512): string[] {
    // Simple paragraph-based chunking
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + para).length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If no chunks created (very short text), return as single chunk
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Index a single learning file
   */
  async indexLearning(filePath: string, projectId?: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = this.parseLearningFile(filePath, content);

    // Generate embedding for the full content
    const embedding = await this.embeddingProvider.generateEmbedding(
      `${parsed.title}\n\n${parsed.content}`
    );

    // Calculate confidence score based on length and structure
    const confidenceScore = this.calculateConfidenceScore(parsed.content);

    // Insert learning into database
    const query = `
      INSERT INTO learnings (
        project_id,
        title,
        content,
        learning_type,
        category,
        confidence_score,
        impact_level,
        tags,
        embedding,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        learning_type = EXCLUDED.learning_type,
        category = EXCLUDED.category,
        confidence_score = EXCLUDED.confidence_score,
        impact_level = EXCLUDED.impact_level,
        tags = EXCLUDED.tags,
        embedding = EXCLUDED.embedding,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id
    `;

    const result = await pool.query(query, [
      projectId || null,
      parsed.title,
      parsed.content,
      parsed.learningType,
      parsed.category,
      confidenceScore,
      parsed.severity,
      parsed.tags,
      JSON.stringify(embedding), // pgvector accepts JSON array
      JSON.stringify({
        file_path: filePath,
        date: parsed.date,
        learning_id: parsed.id,
      }),
    ]);

    return result.rows[0].id;
  }

  /**
   * Calculate confidence score based on content quality
   */
  private calculateConfidenceScore(content: string): number {
    let score = 0.5; // Base score

    // Has clear problem section
    if (content.includes('## Problem') || content.includes('## Root Cause')) {
      score += 0.1;
    }

    // Has solution section
    if (content.includes('## Solution') || content.includes('## Fix')) {
      score += 0.1;
    }

    // Has examples
    if (content.includes('```') || content.includes('## Example')) {
      score += 0.1;
    }

    // Has verification/checklist
    if (content.includes('## Verification') || content.includes('- [ ]')) {
      score += 0.1;
    }

    // Length indicates thorough documentation
    if (content.length > 2000) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Index all learning files from the learnings directory
   */
  async indexAllLearnings(projectId?: string): Promise<number> {
    const files = await fs.readdir(this.learningsDir);
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('_'));

    let indexed = 0;
    for (const file of mdFiles) {
      try {
        const filePath = path.join(this.learningsDir, file);
        await this.indexLearning(filePath, projectId);
        indexed++;
        console.log(`Indexed learning: ${file}`);
      } catch (error) {
        console.error(`Failed to index ${file}:`, error);
      }
    }

    return indexed;
  }

  /**
   * Search for relevant learnings
   */
  async searchLearnings(
    query: string,
    options: SearchLearningOptions = {}
  ): Promise<SearchLearningsResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);

    // Use database function for search
    const sqlQuery = `
      SELECT * FROM search_learnings(
        $1::vector(1536),
        $2::uuid,
        $3::varchar,
        $4::integer,
        $5::numeric
      )
    `;

    const result = await pool.query(sqlQuery, [
      JSON.stringify(queryEmbedding),
      options.project_id || null,
      options.category || null,
      options.limit || 5,
      options.min_similarity || 0.7,
    ]);

    return result.rows;
  }

  /**
   * Track learning application
   */
  async trackApplication(
    learningId: string,
    appliedToType: ApplicationTargetType,
    appliedToId: string,
    context?: string,
    outcome?: ApplicationOutcome,
    feedback?: string
  ): Promise<void> {
    const query = `
      INSERT INTO learning_applications (
        learning_id,
        applied_to_type,
        applied_to_id,
        context,
        outcome,
        feedback
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await pool.query(query, [
      learningId,
      appliedToType,
      appliedToId,
      context || null,
      outcome || null,
      feedback || null,
    ]);
  }

  /**
   * Get learning statistics
   */
  async getStats(projectId?: string): Promise<LearningStats> {
    // Get total counts
    const totalQuery = `
      SELECT COUNT(*) as total FROM learnings
      WHERE ($1::uuid IS NULL OR project_id = $1)
    `;
    const totalResult = await pool.query(totalQuery, [projectId || null]);
    const total_learnings = parseInt(totalResult.rows[0].total);

    // By category
    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM learnings
      WHERE ($1::uuid IS NULL OR project_id = $1)
      GROUP BY category
    `;
    const categoryResult = await pool.query(categoryQuery, [projectId || null]);
    const by_category = Object.fromEntries(
      categoryResult.rows.map(r => [r.category || 'uncategorized', parseInt(r.count)])
    );

    // By impact
    const impactQuery = `
      SELECT impact_level, COUNT(*) as count
      FROM learnings
      WHERE ($1::uuid IS NULL OR project_id = $1)
      GROUP BY impact_level
    `;
    const impactResult = await pool.query(impactQuery, [projectId || null]);
    const by_impact = Object.fromEntries(
      impactResult.rows.map(r => [r.impact_level, parseInt(r.count)])
    ) as Record<ImpactLevel, number>;

    // By type
    const typeQuery = `
      SELECT learning_type, COUNT(*) as count
      FROM learnings
      WHERE ($1::uuid IS NULL OR project_id = $1)
      GROUP BY learning_type
    `;
    const typeResult = await pool.query(typeQuery, [projectId || null]);
    const by_type = Object.fromEntries(
      typeResult.rows.map(r => [r.learning_type, parseInt(r.count)])
    ) as Record<LearningType, number>;

    // Most used
    const mostUsedQuery = `
      SELECT id, title, usage_count
      FROM learnings
      WHERE ($1::uuid IS NULL OR project_id = $1)
      ORDER BY usage_count DESC
      LIMIT 10
    `;
    const mostUsedResult = await pool.query(mostUsedQuery, [projectId || null]);
    const most_used = mostUsedResult.rows.map(r => ({
      id: r.id,
      title: r.title,
      usage_count: r.usage_count,
    }));

    // Effectiveness
    const effectivenessQuery = `
      SELECT * FROM learning_effectiveness
    `;
    const effectivenessResult = await pool.query(effectivenessQuery);
    const avg_success_rate = effectivenessResult.rows.length > 0
      ? effectivenessResult.rows.reduce((sum, r) => sum + (parseFloat(r.success_rate_percent) || 0), 0) / effectivenessResult.rows.length
      : 0;
    const total_applications = effectivenessResult.rows.reduce((sum, r) => sum + parseInt(r.application_count || 0), 0);

    return {
      total_learnings,
      by_category,
      by_impact,
      by_type,
      most_used,
      effectiveness_summary: {
        avg_success_rate,
        total_applications,
      },
    };
  }

  /**
   * Get learning by ID
   */
  async getLearningById(id: string): Promise<Learning | null> {
    const query = 'SELECT * FROM learnings WHERE id = $1';
    const result = await pool.query<Learning>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Verify a learning (mark as verified)
   */
  async verifyLearning(id: string, verifiedBy: string): Promise<void> {
    const query = `
      UPDATE learnings
      SET verified = true, verified_by = $2, verified_at = NOW()
      WHERE id = $1
    `;
    await pool.query(query, [id, verifiedBy]);
  }
}
