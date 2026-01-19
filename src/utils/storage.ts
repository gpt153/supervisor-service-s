/**
 * File-based storage utilities for PIV loop
 * Handles context documents and implementation plans
 */

import fs from 'fs/promises';
import path from 'path';
import type { ContextDocument, ImplementationPlan } from '../types/piv.js';

export class PIVStorage {
  private plansDir: string;
  private contextDir: string;

  constructor(workingDirectory: string, options?: { plansDir?: string; contextDir?: string }) {
    this.plansDir = path.join(workingDirectory, options?.plansDir || '.agents/plans');
    this.contextDir = path.join(workingDirectory, options?.contextDir || '.agents/context');
  }

  /**
   * Ensure storage directories exist
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.plansDir, { recursive: true });
    await fs.mkdir(this.contextDir, { recursive: true });
  }

  /**
   * Save context document from Prime phase
   */
  async saveContext(epicId: string, context: ContextDocument): Promise<string> {
    const filename = `context-${epicId}.md`;
    const filepath = path.join(this.contextDir, filename);
    const content = this.formatContextAsMarkdown(context);
    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  /**
   * Load context document
   */
  async loadContext(epicId: string): Promise<ContextDocument> {
    const filename = `context-${epicId}.md`;
    const filepath = path.join(this.contextDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return this.parseContextFromMarkdown(content);
  }

  /**
   * Save implementation plan from Plan phase
   */
  async savePlan(epicId: string, plan: ImplementationPlan): Promise<string> {
    const filename = `${epicId}-implementation.md`;
    const filepath = path.join(this.plansDir, filename);
    const content = this.formatPlanAsMarkdown(plan);
    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  /**
   * Load implementation plan
   */
  async loadPlan(epicId: string): Promise<ImplementationPlan> {
    const filename = `${epicId}-implementation.md`;
    const filepath = path.join(this.plansDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return this.parsePlanFromMarkdown(content);
  }

  /**
   * Format context document as markdown
   */
  private formatContextAsMarkdown(context: ContextDocument): string {
    const sections: string[] = [];

    sections.push(`# Context Document: ${context.project}`);
    sections.push(`**Epic ID:** ${context.epicId}`);
    sections.push(`**Generated:** ${context.generated}`);
    sections.push('');

    sections.push('## Tech Stack');
    sections.push('');
    sections.push(`- **Languages:** ${context.techStack.languages.join(', ')}`);
    sections.push(`- **Frameworks:** ${context.techStack.frameworks.join(', ')}`);
    sections.push(`- **Package Manager:** ${context.techStack.packageManager}`);
    if (context.techStack.testingFramework) {
      sections.push(`- **Testing:** ${context.techStack.testingFramework}`);
    }
    if (context.techStack.buildSystem) {
      sections.push(`- **Build System:** ${context.techStack.buildSystem}`);
    }
    sections.push('');

    sections.push('## Naming Conventions');
    sections.push('');
    sections.push(`- **Files:** ${context.conventions.fileNaming}`);
    sections.push(`- **Classes:** ${context.conventions.classNaming}`);
    sections.push(`- **Functions:** ${context.conventions.functionNaming}`);
    sections.push(`- **Constants:** ${context.conventions.constantNaming}`);
    if (context.conventions.componentNaming) {
      sections.push(`- **Components:** ${context.conventions.componentNaming}`);
    }
    sections.push('');

    sections.push('## Dependencies');
    sections.push('');
    for (const dep of context.dependencies) {
      sections.push(`- **${dep.name}** (${dep.version}) - ${dep.type}`);
      if (dep.purpose) {
        sections.push(`  - ${dep.purpose}`);
      }
    }
    sections.push('');

    sections.push('## Integration Points');
    sections.push('');
    for (const point of context.integrationPoints) {
      sections.push(`### ${point.name} (${point.type})`);
      sections.push(point.description);
      sections.push('**Files:**');
      for (const file of point.files) {
        sections.push(`- ${file}`);
      }
      sections.push('');
    }

    if (context.ragInsights.length > 0) {
      sections.push('## RAG Insights');
      sections.push('');
      for (const insight of context.ragInsights) {
        sections.push(`### ${insight.source} (relevance: ${insight.relevance})`);
        sections.push('```');
        sections.push(insight.content);
        sections.push('```');
        sections.push('');
      }
    }

    if (context.existingPatterns.length > 0) {
      sections.push('## Existing Patterns');
      sections.push('');
      for (const pattern of context.existingPatterns) {
        sections.push(`- ${pattern}`);
      }
      sections.push('');
    }

    if (context.recommendations.length > 0) {
      sections.push('## Recommendations');
      sections.push('');
      for (const rec of context.recommendations) {
        sections.push(`- ${rec}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Format implementation plan as markdown
   */
  private formatPlanAsMarkdown(plan: ImplementationPlan): string {
    const sections: string[] = [];

    sections.push(`# Implementation Plan: ${plan.epicId}`);
    sections.push(`**Project:** ${plan.projectName}`);
    sections.push(`**Generated:** ${plan.generated}`);
    sections.push('');

    sections.push('## Approach');
    sections.push('');
    sections.push(plan.approach);
    sections.push('');

    sections.push('## Phases');
    sections.push('');

    for (const phase of plan.phases) {
      sections.push(`### Phase: ${phase.name}`);
      sections.push(phase.description);
      sections.push('');

      if (phase.dependencies.length > 0) {
        sections.push(`**Dependencies:** ${phase.dependencies.join(', ')}`);
        sections.push('');
      }

      for (const task of phase.tasks) {
        sections.push(`#### Task ${task.id}: ${task.title}`);
        sections.push(`**Estimated Time:** ${task.estimatedMinutes} minutes`);
        sections.push('');
        sections.push('**Description:**');
        sections.push(task.description);
        sections.push('');
        sections.push('**Files:**');
        for (const file of task.files) {
          sections.push(`- ${file}`);
        }
        sections.push('');
        sections.push('**Prescriptive Instructions:**');
        sections.push('```');
        sections.push(task.prescriptiveInstructions);
        sections.push('```');
        sections.push('');
        sections.push('**Validations:**');
        for (const validation of task.validations) {
          sections.push(`- **${validation.description}**`);
          sections.push(`  \`\`\`bash`);
          sections.push(`  ${validation.command}`);
          sections.push(`  \`\`\``);
          if (validation.expectedOutput) {
            sections.push(`  Expected: ${validation.expectedOutput}`);
          }
          sections.push(`  On failure: ${validation.failureAction}`);
        }
        sections.push('');
      }
    }

    sections.push('## Overall Validation');
    sections.push('');
    for (const validation of plan.overallValidation) {
      sections.push(`### ${validation.description}`);
      sections.push('```bash');
      sections.push(validation.command);
      sections.push('```');
      if (validation.expectedOutput) {
        sections.push(`**Expected:** ${validation.expectedOutput}`);
      }
      sections.push(`**On failure:** ${validation.failureAction}`);
      sections.push('');
    }

    sections.push('## Acceptance Criteria');
    sections.push('');
    for (const criteria of plan.acceptanceCriteria) {
      sections.push(`- [ ] ${criteria}`);
    }
    sections.push('');

    if (plan.notes.length > 0) {
      sections.push('## Notes');
      sections.push('');
      for (const note of plan.notes) {
        sections.push(`- ${note}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Parse context from markdown (simplified - could be improved with proper parsing)
   */
  private parseContextFromMarkdown(content: string): ContextDocument {
    // This is a simplified parser - in production, use a proper markdown parser
    // For now, we'll store as JSON in a code block for easier parsing
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Fallback: basic structure
    throw new Error('Context document parsing not fully implemented - use JSON format');
  }

  /**
   * Parse plan from markdown (simplified - could be improved with proper parsing)
   */
  private parsePlanFromMarkdown(content: string): ImplementationPlan {
    // This is a simplified parser - in production, use a proper markdown parser
    // For now, we'll store as JSON in a code block for easier parsing
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    // Fallback: basic structure
    throw new Error('Plan document parsing not fully implemented - use JSON format');
  }

  /**
   * Save raw JSON for easier parsing (alternative to markdown)
   */
  async saveContextJSON(epicId: string, context: ContextDocument): Promise<string> {
    const filename = `context-${epicId}.json`;
    const filepath = path.join(this.contextDir, filename);
    await fs.writeFile(filepath, JSON.stringify(context, null, 2), 'utf-8');
    return filepath;
  }

  /**
   * Save raw JSON for easier parsing (alternative to markdown)
   */
  async savePlanJSON(epicId: string, plan: ImplementationPlan): Promise<string> {
    const filename = `${epicId}-implementation.json`;
    const filepath = path.join(this.plansDir, filename);
    await fs.writeFile(filepath, JSON.stringify(plan, null, 2), 'utf-8');
    return filepath;
  }

  /**
   * Load context from JSON
   */
  async loadContextJSON(epicId: string): Promise<ContextDocument> {
    const filename = `context-${epicId}.json`;
    const filepath = path.join(this.contextDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Load plan from JSON
   */
  async loadPlanJSON(epicId: string): Promise<ImplementationPlan> {
    const filename = `${epicId}-implementation.json`;
    const filepath = path.join(this.plansDir, filename);
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }
}
