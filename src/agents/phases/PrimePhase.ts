/**
 * Prime Phase - Codebase Research
 *
 * Analyzes the codebase to understand:
 * - Tech stack and dependencies
 * - Naming conventions and patterns
 * - Integration points
 * - Existing similar implementations
 *
 * Generates a context document for the Plan phase.
 */

import type {
  ProjectContext,
  Epic,
  PrimeResult,
  ContextDocument,
  LocalRAG,
  RAGResult,
} from '../../types/piv.js';
import { CodebaseAnalyzer } from '../../utils/codebase-analyzer.js';
import { PIVStorage } from '../../utils/storage.js';

export class PrimePhase {
  private analyzer: CodebaseAnalyzer;
  private storage: PIVStorage;
  private localRAG?: LocalRAG;

  constructor(
    workingDirectory: string,
    options?: {
      plansDir?: string;
      contextDir?: string;
      localRAG?: LocalRAG;
    }
  ) {
    this.analyzer = new CodebaseAnalyzer(workingDirectory);
    this.storage = new PIVStorage(workingDirectory, {
      plansDir: options?.plansDir,
      contextDir: options?.contextDir,
    });
    this.localRAG = options?.localRAG;
  }

  /**
   * Execute the Prime phase
   *
   * Process:
   * 1. Initialize storage directories
   * 2. Analyze codebase structure
   * 3. Find naming conventions
   * 4. Analyze dependencies
   * 5. Find integration points
   * 6. Search local RAG for patterns (if available)
   * 7. Generate context document
   *
   * @returns PrimeResult with context path and metadata
   */
  async execute(project: ProjectContext, epic: Epic): Promise<PrimeResult> {
    console.log(`[PrimePhase] Starting research for ${epic.id}...`);

    // Initialize storage
    await this.storage.initialize();

    // Step 1: Analyze codebase structure
    console.log('[PrimePhase] Analyzing codebase structure...');
    const structure = await this.analyzer.analyzeStructure();

    // Step 2: Find naming conventions
    console.log('[PrimePhase] Detecting naming conventions...');
    const conventions = await this.analyzer.findConventions();

    // Step 3: Analyze dependencies
    console.log('[PrimePhase] Analyzing dependencies...');
    const dependencies = await this.analyzer.analyzeDependencies();

    // Step 4: Find integration points
    console.log('[PrimePhase] Finding integration points...');
    const integrationPoints = await this.analyzer.findIntegrationPoints();

    // Step 5: Search local RAG for patterns
    console.log('[PrimePhase] Searching for similar patterns...');
    const ragInsights = await this.searchRAG(project, epic);

    // Step 6: Find existing patterns
    console.log('[PrimePhase] Identifying existing patterns...');
    const existingPatterns = this.identifyPatterns(structure, conventions);

    // Step 7: Generate recommendations
    console.log('[PrimePhase] Generating recommendations...');
    const recommendations = this.generateRecommendations(
      structure,
      conventions,
      dependencies,
      integrationPoints
    );

    // Create context document
    const contextDoc: ContextDocument = {
      project: project.name,
      epicId: epic.id,
      generated: new Date().toISOString(),
      techStack: structure,
      conventions,
      dependencies,
      integrationPoints,
      ragInsights,
      existingPatterns,
      recommendations,
    };

    // Save context document
    console.log('[PrimePhase] Saving context document...');
    const contextPath = await this.storage.saveContextJSON(epic.id, contextDoc);

    console.log(`[PrimePhase] Context document saved: ${contextPath}`);

    return {
      contextPath,
      techStack: structure.techStack,
      conventions,
      dependencies,
      integrationPoints,
      ragInsights,
      readyForPlan: true,
    };
  }

  /**
   * Search local RAG for similar patterns and implementations
   */
  private async searchRAG(project: ProjectContext, epic: Epic): Promise<RAGResult[]> {
    if (!this.localRAG) {
      return [];
    }

    try {
      // Search for epic title and description
      const query = `${epic.title} ${epic.description}`;
      const results = await this.localRAG.search(query, {
        limit: 5,
        minRelevance: 0.5,
      });

      return results;
    } catch (error) {
      console.error('[PrimePhase] RAG search failed:', error);
      return [];
    }
  }

  /**
   * Identify existing patterns in the codebase
   */
  private identifyPatterns(
    structure: any,
    conventions: any
  ): string[] {
    const patterns: string[] = [];

    // Pattern: Consistent file naming
    patterns.push(`Files use ${conventions.fileNaming} naming convention`);

    // Pattern: Testing framework
    if (structure.testingFramework) {
      patterns.push(`Tests written with ${structure.testingFramework}`);
    }

    // Pattern: Build system
    if (structure.buildSystem) {
      patterns.push(`Built with ${structure.buildSystem}`);
    }

    // Pattern: Framework conventions
    for (const framework of structure.frameworks) {
      if (framework === 'React') {
        patterns.push('React components use functional components with hooks');
      }
      if (framework === 'Express') {
        patterns.push('Express routes organized by resource');
      }
    }

    // Pattern: TypeScript
    if (structure.languages.includes('TypeScript')) {
      patterns.push('Strong typing with TypeScript interfaces and types');
    }

    return patterns;
  }

  /**
   * Generate recommendations for implementation
   */
  private generateRecommendations(
    structure: any,
    conventions: any,
    dependencies: any[],
    integrationPoints: any[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommendation: Follow naming conventions
    recommendations.push(
      `Follow ${conventions.fileNaming} for file names and ${conventions.classNaming} for class names`
    );

    // Recommendation: Use existing dependencies
    const testingDep = dependencies.find((d) => d.name === 'jest' || d.name === 'vitest');
    if (testingDep) {
      recommendations.push(`Write tests using ${testingDep.name}`);
    }

    // Recommendation: Integration
    if (integrationPoints.length > 0) {
      recommendations.push(
        `Consider integration with existing ${integrationPoints.map((p) => p.type).join(', ')} layers`
      );
    }

    // Recommendation: TypeScript
    if (structure.languages.includes('TypeScript')) {
      recommendations.push('Define TypeScript interfaces for new types');
      recommendations.push('Maintain strict type safety');
    }

    // Recommendation: Build system
    if (structure.buildSystem) {
      recommendations.push(`Ensure compatibility with ${structure.buildSystem} build process`);
    }

    return recommendations;
  }
}
