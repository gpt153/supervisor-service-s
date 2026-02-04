/**
 * Snippet Extractor Service
 * Epic 009-B: Conversation Snippet Extraction
 *
 * Extract snippets from Claude Code JSONL transcript files
 */

import { readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { SnippetType } from '../types/snippet.js';

/**
 * Error: File not found
 */
export class FileNotFoundError extends Error {
  constructor(filePath: string) {
    super(`File not found: ${filePath}`);
    this.name = 'FileNotFoundError';
  }
}

/**
 * Error: Invalid line range
 */
export class InvalidLineRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLineRangeError';
  }
}

/**
 * Error: Extraction failed
 */
export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Represents a parsed JSONL record from Claude Code transcript
 */
interface TranscriptRecord {
  type?: string;
  role?: string;
  content?: string;
  [key: string]: any;
}

/**
 * Extract snippets from Claude Code JSONL transcript files
 */
export class SnippetExtractor {
  /**
   * Read a section of a JSONL transcript file
   * Uses streaming to avoid loading large files into memory
   *
   * @param filePath Path to .jsonl file
   * @param startLine Starting line number (1-indexed)
   * @param endLine Ending line number (1-indexed)
   * @returns Array of parsed JSONL records
   * @throws FileNotFoundError if file doesn't exist
   * @throws InvalidLineRangeError if range is invalid
   */
  async readSection(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<TranscriptRecord[]> {
    // Validate file exists and range is valid
    try {
      await readFile(filePath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(filePath);
      }
      throw error;
    }

    if (startLine < 1) {
      throw new InvalidLineRangeError(`startLine must be >= 1, got ${startLine}`);
    }
    if (endLine < startLine) {
      throw new InvalidLineRangeError(
        `endLine must be >= startLine, got ${startLine}-${endLine}`
      );
    }

    const records: TranscriptRecord[] = [];
    let currentLine = 0;

    return new Promise((resolve, reject) => {
      const rl = createInterface({
        input: createReadStream(filePath),
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        currentLine++;

        // Skip lines before start
        if (currentLine < startLine) {
          return;
        }

        // Stop after end
        if (currentLine > endLine) {
          rl.close();
          return;
        }

        // Parse JSONL line
        try {
          const record = JSON.parse(line);
          records.push(record);
        } catch (error) {
          // Log warning but continue (graceful error handling)
          console.warn(`Warning: Failed to parse line ${currentLine}: ${error}`);
        }
      });

      rl.on('close', () => {
        resolve(records);
      });

      rl.on('error', reject);
    });
  }

  /**
   * Extract and format a snippet from a transcript
   * Combines multiple conversation turns into a coherent snippet
   *
   * @param filePath Path to .jsonl file
   * @param startLine Start line (1-indexed)
   * @param endLine End line (1-indexed)
   * @param snippetType Type classification for formatting hints
   * @returns Formatted snippet content string (100 bytes - 10KB)
   * @throws ExtractionError if extraction or formatting fails
   */
  async extractFormatted(
    filePath: string,
    startLine: number,
    endLine: number,
    snippetType: SnippetType
  ): Promise<string> {
    const records = await this.readSection(filePath, startLine, endLine);

    if (records.length === 0) {
      throw new ExtractionError(
        `No records found in range ${startLine}-${endLine}`
      );
    }

    // Format based on snippet type
    let formatted = '';

    switch (snippetType) {
      case SnippetType.ERROR_REASONING:
        formatted = this.formatErrorReasoning(records);
        break;
      case SnippetType.DECISION_RATIONALE:
        formatted = this.formatDecisionRationale(records);
        break;
      case SnippetType.LEARNING_PATTERN:
        formatted = this.formatLearningPattern(records);
        break;
    }

    // Validate size
    const bytes = Buffer.byteLength(formatted, 'utf-8');
    if (bytes < 100) {
      throw new ExtractionError(
        `Extracted content too short: ${bytes} bytes (minimum 100)`
      );
    }
    if (bytes > 10240) {
      throw new ExtractionError(
        `Extracted content too long: ${bytes} bytes (maximum 10240)`
      );
    }

    return formatted;
  }

  /**
   * Format error reasoning snippet
   * Includes problem description, attempted solutions, and resolution
   */
  private formatErrorReasoning(records: TranscriptRecord[]): string {
    const parts: string[] = [];

    for (const record of records) {
      if (record.role === 'assistant' || record.type === 'assistant') {
        parts.push(record.content || '');
      } else if (record.role === 'user' || record.type === 'user') {
        parts.push(`User: ${record.content || ''}`);
      } else if (record.content) {
        parts.push(record.content);
      }
    }

    return parts.filter((p) => p.trim()).join('\n\n');
  }

  /**
   * Format decision rationale snippet
   * Emphasizes why a choice was made and alternatives
   */
  private formatDecisionRationale(records: TranscriptRecord[]): string {
    const parts: string[] = [];

    for (const record of records) {
      const content = record.content || '';

      // Prioritize decision-related content
      if (
        content.toLowerCase().includes('decide') ||
        content.toLowerCase().includes('approach') ||
        content.toLowerCase().includes('alternative') ||
        content.toLowerCase().includes('instead of')
      ) {
        parts.push(`Decision: ${content}`);
      } else if (record.role === 'assistant' || record.type === 'assistant') {
        parts.push(content);
      } else if (record.role === 'user' || record.type === 'user') {
        parts.push(`Consideration: ${content}`);
      } else if (content) {
        parts.push(content);
      }
    }

    return parts.filter((p) => p.trim()).join('\n\n');
  }

  /**
   * Format learning pattern snippet
   * Highlights reusable techniques and patterns
   */
  private formatLearningPattern(records: TranscriptRecord[]): string {
    const parts: string[] = [];

    for (const record of records) {
      const content = record.content || '';

      // Prioritize pattern-related content
      if (
        content.toLowerCase().includes('pattern') ||
        content.toLowerCase().includes('technique') ||
        content.toLowerCase().includes('approach') ||
        content.toLowerCase().includes('way to') ||
        content.toLowerCase().includes('can use')
      ) {
        parts.push(`Pattern: ${content}`);
      } else if (record.role === 'assistant' || record.type === 'assistant') {
        parts.push(content);
      } else if (content) {
        parts.push(content);
      }
    }

    return parts.filter((p) => p.trim()).join('\n\n');
  }
}

/**
 * Global instance (singleton)
 */
let globalInstance: SnippetExtractor | null = null;

/**
 * Get or create the global snippet extractor
 */
export function getSnippetExtractor(): SnippetExtractor {
  if (!globalInstance) {
    globalInstance = new SnippetExtractor();
  }
  return globalInstance;
}

/**
 * Reset the global instance (for testing)
 */
export function resetSnippetExtractor(): void {
  globalInstance = null;
}
