import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import {
  InstructionLayer,
  InstructionSection,
  AssemblyResult,
  AssemblyOptions,
  InstructionMetadata,
} from '../types/instruction-types.js';

/**
 * InstructionAssembler - Combines layered instructions into final CLAUDE.md
 *
 * Layers (in order of priority):
 * 1. Core (.supervisor-core/) - Shared across all supervisors
 *    - Keep these LEAN using reference pattern
 *    - Core behavior inline, templates/guides in /docs/
 * 2. Meta (.supervisor-meta/) - Meta/supervisor-service specific
 * 3. Project (.supervisor-specific/) - Project-specific (preserved)
 *
 * Reference Pattern:
 * - Core instructions reference external templates/guides in /home/samuel/sv/docs/
 * - PSes can read referenced docs when needed using Read tool
 * - Keeps CLAUDE.md files lean (~1200 lines vs 1600+ lines)
 *
 * See: /home/samuel/sv/supervisor-service-s/.supervisor-core/README.md
 */
export class InstructionAssembler {
  private corePath: string;
  private metaPath: string;
  private projectPath: string;
  private supervisorServicePath: string;

  constructor(basePath: string, supervisorServicePath?: string) {
    this.corePath = join(basePath, '.supervisor-core');
    this.metaPath = join(basePath, '.supervisor-meta');

    // Support both .supervisor-specific (new) and .claude-specific (legacy)
    const supervisorSpecificPath = join(basePath, '.supervisor-specific');
    const claudeSpecificPath = join(basePath, '.claude-specific');

    // Prefer .supervisor-specific if it exists
    this.projectPath = supervisorSpecificPath;

    // Fallback to supervisor-service core if core not found locally
    this.supervisorServicePath = supervisorServicePath || '/home/samuel/sv/supervisor-service-s';
  }

  /**
   * Assemble CLAUDE.md from all layers
   */
  async assemble(options: AssemblyOptions = {}): Promise<AssemblyResult> {
    const sections: InstructionSection[] = [];
    const sources: string[] = [];

    // Determine if this is meta-supervisor (has meta instructions)
    const isMetaSupervisor = options.isMetaSupervisor || false;

    // 1. Load core instructions (local first, then supervisor-service fallback)
    let coreContent = await this.loadLayer(this.corePath, 'core', { isMetaSupervisor });
    if (!coreContent && this.supervisorServicePath) {
      const fallbackCorePath = join(this.supervisorServicePath, '.supervisor-core');
      coreContent = await this.loadLayer(fallbackCorePath, 'core', { isMetaSupervisor });
    }

    if (coreContent) {
      sections.push(...coreContent.sections);
      sources.push(...coreContent.sources);
    }

    // 2. Load meta-specific instructions (only for supervisor-service)
    const metaContent = await this.loadLayer(this.metaPath, 'meta', { isMetaSupervisor });
    if (metaContent) {
      sections.push(...metaContent.sections);
      sources.push(...metaContent.sources);
    }

    // 3. Load project-specific instructions (if preserve flag set)
    if (options.preserveProjectSpecific) {
      const projectContent = await this.loadLayer(this.projectPath, 'project', { isMetaSupervisor });
      if (projectContent) {
        sections.push(...projectContent.sections);
        sources.push(...projectContent.sources);
      }
    }

    // Assemble final content
    let content = '';

    // Add metadata header if requested
    if (options.includeMetadata) {
      content += this.generateMetadataHeader(sources);
    }

    // Combine sections
    content += sections.map(s => s.content).join('\n\n');

    return {
      content,
      sections,
      timestamp: new Date(),
      sources,
    };
  }

  /**
   * Load all markdown files from a layer directory
   */
  private async loadLayer(
    layerPath: string,
    source: 'core' | 'meta' | 'project',
    options?: { isMetaSupervisor?: boolean }
  ): Promise<{ sections: InstructionSection[]; sources: string[] } | null> {
    try {
      const stats = await stat(layerPath);
      if (!stats.isDirectory()) return null;

      const files = await readdir(layerPath);
      let mdFiles = files
        .filter(f => f.endsWith('.md'))
        .sort(); // Alphabetical order

      // Exclude meta-specific files from project-supervisors
      if (source === 'core' && !options?.isMetaSupervisor) {
        mdFiles = mdFiles.filter(f =>
          f !== 'README.md' && f !== 'QUICK-START.md'
        );
      }

      const sections: InstructionSection[] = [];
      const sources: string[] = [];

      for (const file of mdFiles) {
        const filePath = join(layerPath, file);
        const content = await readFile(filePath, 'utf-8');

        sections.push({
          marker: `<!-- ${source}:${file} -->`,
          content: content.trim(),
          source,
        });

        sources.push(filePath);
      }

      return { sections, sources };
    } catch (error) {
      // Directory doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Generate metadata header for CLAUDE.md
   */
  private generateMetadataHeader(sources: string[]): string {
    const metadata: InstructionMetadata = {
      version: '1.0.0',
      lastUpdated: new Date(),
      layers: sources,
      autoGenerated: true,
    };

    return `<!-- AUTO-GENERATED CLAUDE.md -->
<!-- Do not edit this file directly. Edit source files in: -->
<!-- ${sources.map(s => `  - ${s}`).join('\n')} -->
<!-- Generated: ${metadata.lastUpdated.toISOString()} -->

`;
  }

  /**
   * Write assembled instructions to CLAUDE.md
   */
  async writeToFile(targetPath: string, result: AssemblyResult): Promise<void> {
    await writeFile(targetPath, result.content, 'utf-8');
  }

  /**
   * Full assembly and write operation
   */
  async assembleAndWrite(
    targetPath: string,
    options: AssemblyOptions = {}
  ): Promise<AssemblyResult> {
    const result = await this.assemble({
      ...options,
      includeMetadata: true,
    });

    await this.writeToFile(targetPath, result);
    return result;
  }

  /**
   * Extract and preserve project-specific sections from existing CLAUDE.md
   */
  async extractProjectSpecific(claudeMdPath: string): Promise<string[]> {
    try {
      const content = await readFile(claudeMdPath, 'utf-8');
      const sections: string[] = [];

      // Look for project-specific markers
      const projectMarkerRegex = /<!-- project-specific:start -->([\s\S]*?)<!-- project-specific:end -->/g;
      let match;

      while ((match = projectMarkerRegex.exec(content)) !== null) {
        sections.push(match[1].trim());
      }

      return sections;
    } catch (error) {
      return [];
    }
  }

  /**
   * Save project-specific sections to .claude-specific/
   */
  async saveProjectSpecific(sections: string[]): Promise<void> {
    if (sections.length === 0) return;

    // Create directory if it doesn't exist
    const fs = await import('fs/promises');
    await fs.mkdir(this.projectPath, { recursive: true });

    // Save each section as a numbered file
    for (let i = 0; i < sections.length; i++) {
      const filePath = join(this.projectPath, `section-${i + 1}.md`);
      const content = `<!-- project-specific:start -->\n${sections[i]}\n<!-- project-specific:end -->`;
      await writeFile(filePath, content, 'utf-8');
    }
  }

  /**
   * Regenerate CLAUDE.md preserving project-specific content
   */
  async regenerate(claudeMdPath: string): Promise<AssemblyResult> {
    // Extract project-specific sections
    const projectSections = await this.extractProjectSpecific(claudeMdPath);

    // Save them
    await this.saveProjectSpecific(projectSections);

    // Reassemble with preservation
    return await this.assembleAndWrite(claudeMdPath, {
      preserveProjectSpecific: true,
      includeMetadata: true,
    });
  }
}
