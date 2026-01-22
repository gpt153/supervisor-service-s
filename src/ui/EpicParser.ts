/**
 * Epic Parser
 * Parses epic markdown files to extract acceptance criteria and user stories
 * Epic: UI-001 - Requirements Analysis Engine
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import type {
  ParsedEpic,
  ParsedAcceptanceCriterion,
  ParsedUserStory,
  EpicStatus,
  EpicDependency,
  EpicValidationResult,
  ValidationError,
  ValidationWarning,
} from '../types/ui-001.js';

/**
 * Parser class for epic markdown files
 */
export class EpicParser {
  private epicDirectory: string;

  constructor(epicDirectory: string = '/home/samuel/sv/supervisor-service-s/.bmad/epics') {
    this.epicDirectory = epicDirectory;
  }

  /**
   * Parse an epic markdown file
   *
   * @param epicId - Epic identifier (e.g., "epic-003-user-management" or "ui-001")
   * @returns Parsed epic data or error
   */
  async parseEpic(epicId: string): Promise<ParsedEpic | { error: string }> {
    try {
      // Construct file path
      const filePath = this.getEpicFilePath(epicId);

      // Read file content
      const content = await readFile(filePath, 'utf-8');

      // Validate epic format
      const validation = this.validateEpicFormat(content);
      if (!validation.valid) {
        return {
          error: `Invalid epic format: ${validation.errors.map(e => e.message).join(', ')}`,
        };
      }

      // Extract metadata
      const metadata = this.extractMetadata(content, epicId);

      // Extract acceptance criteria
      const acceptanceCriteria = this.extractAcceptanceCriteria(content);

      // Extract user stories
      const userStories = this.extractUserStories(content);

      // Extract dependencies
      const dependencies = this.extractDependencies(content);

      // Extract technical notes
      const technicalNotes = this.extractSection(content, 'Technical Notes') ||
                             this.extractSection(content, 'Architecture') ||
                             undefined;

      return {
        epicId: metadata.epicId,
        projectName: metadata.projectName,
        title: metadata.title,
        status: metadata.status,
        description: metadata.description,
        acceptanceCriteria,
        userStories,
        technicalNotes,
        dependencies,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { error: `Epic file not found: ${epicId}` };
      }

      return {
        error: error instanceof Error ? error.message : 'Unknown error parsing epic',
      };
    }
  }

  /**
   * Validate epic format
   *
   * @param content - Epic markdown content
   * @returns Validation result with errors and warnings
   */
  validateEpicFormat(content: string): EpicValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for required sections
    const requiredSections = ['Requirements', 'Acceptance Criteria'];
    for (const section of requiredSections) {
      if (!content.includes(`## ${section}`) && !content.includes(`### ${section}`)) {
        warnings.push({
          type: 'incomplete_ac',
          message: `Missing section: ${section}`,
        });
      }
    }

    // Check for acceptance criteria format
    const acMatches = content.match(/^[-*]\s*\[\s*[xX ]?\s*\]\s+/gm);
    if (!acMatches || acMatches.length === 0) {
      warnings.push({
        type: 'incomplete_ac',
        message: 'No acceptance criteria checkboxes found',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Extract epic metadata
   *
   * @param content - Epic markdown content
   * @param epicId - Epic identifier
   * @returns Extracted metadata
   */
  private extractMetadata(
    content: string,
    epicId: string
  ): {
    epicId: string;
    projectName: string;
    title: string;
    status: EpicStatus;
    description?: string;
  } {
    // Extract title (first # heading)
    const titleMatch = content.match(/^#\s+(?:Epic:\s+)?(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Epic';

    // Extract status
    const statusMatch = content.match(/\*\*Status:\*\*\s+(.+)$/m);
    const statusText = statusMatch ? statusMatch[1].trim() : 'Planned';
    const status = this.parseStatus(statusText);

    // Extract project name (heuristic: from epic ID or content)
    const projectMatch = content.match(/\*\*Project:\*\*\s+(.+)$/m);
    const projectName = projectMatch ? projectMatch[1].trim() : 'supervisor-service-s';

    // Extract description (from Business Context or Problem Statement)
    const description = this.extractSection(content, 'Problem Statement') ||
                       this.extractSection(content, 'Business Context') ||
                       undefined;

    return {
      epicId,
      projectName,
      title,
      status,
      description,
    };
  }

  /**
   * Extract acceptance criteria from content
   *
   * @param content - Epic markdown content
   * @returns Array of parsed acceptance criteria
   */
  private extractAcceptanceCriteria(content: string): ParsedAcceptanceCriterion[] {
    const criteria: ParsedAcceptanceCriterion[] = [];

    // Match checkbox items under Acceptance Criteria or Requirements sections
    // Patterns: - [ ] text, - [x] text, - [X] text, * [ ] text
    const lines = content.split('\n');
    let inAcceptanceSection = false;
    let acCounter = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we're entering acceptance criteria section
      if (/^#{2,3}\s+(Acceptance Criteria|Requirements|Functional Requirements)/i.test(line)) {
        inAcceptanceSection = true;
        continue;
      }

      // Exit section if we hit another major heading
      if (/^#{1,2}\s+(?!Acceptance|Requirements|Functional)/i.test(line) && inAcceptanceSection) {
        inAcceptanceSection = false;
        continue;
      }

      // Extract checkbox items
      if (inAcceptanceSection) {
        const checkboxMatch = line.match(/^[-*]\s*\[\s*[xX ]?\s*\]\s+(.+)$/);
        if (checkboxMatch) {
          const rawText = checkboxMatch[1].trim();
          const text = this.cleanAcceptanceCriterion(rawText);

          // Generate ID if not present
          const idMatch = rawText.match(/^(AC[-_]\d+):/);
          const id = idMatch ? idMatch[1] : `AC-${acCounter}`;

          criteria.push({
            id,
            text,
            rawText,
          });

          acCounter++;
        }
      }
    }

    return criteria;
  }

  /**
   * Extract user stories from content
   *
   * @param content - Epic markdown content
   * @returns Array of parsed user stories
   */
  private extractUserStories(content: string): ParsedUserStory[] {
    const stories: ParsedUserStory[] = [];

    // Match "As a... I want... So that..." patterns
    const storyPattern = /As\s+a\s+(.+?),?\s+I\s+want\s+(.+?),?\s+(?:so\s+that|to)\s+(.+?)(?:\.|$)/gi;
    const matches = content.matchAll(storyPattern);

    for (const match of matches) {
      const role = match[1].trim();
      const goal = match[2].trim();
      const benefit = match[3].trim();
      const rawText = match[0];

      stories.push({
        role,
        goal,
        benefit,
        rawText,
      });
    }

    return stories;
  }

  /**
   * Extract dependencies from content
   *
   * @param content - Epic markdown content
   * @returns Array of epic dependencies
   */
  private extractDependencies(content: string): EpicDependency[] {
    const dependencies: EpicDependency[] = [];

    // Extract from Dependencies section
    const depSection = this.extractSection(content, 'Dependencies');
    if (depSection) {
      const lines = depSection.split('\n');

      for (const line of lines) {
        // Match patterns like: - Blocks: epic-003, - Blocked by: epic-001
        const blocksMatch = line.match(/^[-*]\s*Blocks?:?\s+(.+)$/i);
        if (blocksMatch) {
          const epicId = blocksMatch[1].trim();
          dependencies.push({ type: 'blocks', epicId });
        }

        const blockedByMatch = line.match(/^[-*]\s*Blocked\s+by:?\s+(.+)$/i);
        if (blockedByMatch) {
          const epicId = blockedByMatch[1].trim();
          dependencies.push({ type: 'blocked_by', epicId });
        }

        const relatedMatch = line.match(/^[-*]\s*Related:?\s+(.+)$/i);
        if (relatedMatch) {
          const epicId = relatedMatch[1].trim();
          dependencies.push({ type: 'related', epicId });
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract a section from markdown content
   *
   * @param content - Markdown content
   * @param sectionName - Name of section to extract
   * @returns Section content or null
   */
  private extractSection(content: string, sectionName: string): string | null {
    const pattern = new RegExp(`^##+ ${sectionName}\\s*$`, 'mi');
    const match = content.match(pattern);

    if (!match) {
      return null;
    }

    const startIndex = match.index! + match[0].length;
    const afterSection = content.substring(startIndex);

    // Find next heading
    const nextHeadingMatch = afterSection.match(/^##+ /m);
    const endIndex = nextHeadingMatch ? nextHeadingMatch.index! : afterSection.length;

    return afterSection.substring(0, endIndex).trim();
  }

  /**
   * Clean acceptance criterion text (remove AC-XX: prefix if present)
   *
   * @param text - Raw AC text
   * @returns Cleaned text
   */
  private cleanAcceptanceCriterion(text: string): string {
    return text.replace(/^AC[-_]\d+:\s*/, '').trim();
  }

  /**
   * Parse status string to EpicStatus
   *
   * @param statusText - Status text from epic
   * @returns Parsed status
   */
  private parseStatus(statusText: string): EpicStatus {
    const normalized = statusText.toLowerCase();

    if (normalized.includes('progress')) {
      return 'In Progress';
    }
    if (normalized.includes('completed') || normalized.includes('done')) {
      return 'Completed';
    }
    if (normalized.includes('blocked')) {
      return 'Blocked';
    }

    return 'Planned';
  }

  /**
   * Get epic file path from epic ID
   *
   * @param epicId - Epic identifier
   * @returns Full file path
   */
  private getEpicFilePath(epicId: string): string {
    // Handle various formats:
    // - "epic-003-user-management" -> "epic-003-user-management.md"
    // - "ui-001" -> "ui-001-requirements-analysis-engine.md"
    // - "003" -> "epic-003.md" (best guess)

    // If epicId already has .md extension, use as-is
    if (epicId.endsWith('.md')) {
      return join(this.epicDirectory, epicId);
    }

    // Try exact match first
    return join(this.epicDirectory, `${epicId}.md`);
  }
}

/**
 * Convenience function to parse an epic
 *
 * @param epicId - Epic identifier
 * @returns Parsed epic data or error
 */
export async function parseEpic(epicId: string): Promise<ParsedEpic | { error: string }> {
  const parser = new EpicParser();
  return parser.parseEpic(epicId);
}
