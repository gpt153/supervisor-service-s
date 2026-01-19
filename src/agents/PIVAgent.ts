/**
 * PIV Agent - Plan → Implement → Validate Orchestrator
 *
 * Coordinates all three phases of the PIV loop:
 * 1. Prime - Deep codebase research and context generation
 * 2. Plan - Create detailed implementation plan with validations
 * 3. Execute - Implement with validation-driven approach
 *
 * Adapted from Cole Medin's methodology for local supervisor architecture.
 */

import type {
  ProjectContext,
  Epic,
  PIVConfig,
  PIVResult,
  LocalRAG,
} from '../types/piv.js';
import { PrimePhase } from './phases/PrimePhase.js';
import { PlanPhase } from './phases/PlanPhase.js';
import { ExecutePhase } from './phases/ExecutePhase.js';

export class PIVAgent {
  private config: PIVConfig;
  private primePhase: PrimePhase;
  private planPhase: PlanPhase;
  private executePhase: ExecutePhase;

  constructor(config: PIVConfig) {
    this.config = config;

    const storageOptions = {
      plansDir: config.storage?.plansDir,
      contextDir: config.storage?.contextDir,
    };

    const ragOptions = config.models?.plan
      ? { ...storageOptions, localRAG: this.createLocalRAG() }
      : storageOptions;

    this.primePhase = new PrimePhase(config.workingDirectory, ragOptions);
    this.planPhase = new PlanPhase(config.workingDirectory, ragOptions);
    this.executePhase = new ExecutePhase(config.workingDirectory, storageOptions);
  }

  /**
   * Run the complete PIV loop
   *
   * This is the main entry point that orchestrates all three phases:
   * Prime → Plan → Execute
   *
   * @returns PIVResult with all phase results
   */
  async run(): Promise<PIVResult> {
    console.log(`[PIVAgent] Starting PIV loop for ${this.config.epic.id}...`);
    console.log(`[PIVAgent] Project: ${this.config.project.name}`);
    console.log(`[PIVAgent] Epic: ${this.config.epic.title}`);

    const startTime = Date.now();

    try {
      // Phase 1: Prime - Research
      console.log('\n=== PHASE 1: PRIME (Research) ===');
      const primeResult = await this.primePhase.execute(
        this.config.project,
        this.config.epic
      );

      console.log('[PIVAgent] Prime phase complete');
      console.log(`  - Tech Stack: ${primeResult.techStack.join(', ')}`);
      console.log(`  - Context saved: ${primeResult.contextPath}`);

      // Phase 2: Plan - Design
      console.log('\n=== PHASE 2: PLAN (Design) ===');
      const planResult = await this.planPhase.execute(
        primeResult.contextPath,
        this.config.epic
      );

      console.log('[PIVAgent] Plan phase complete');
      console.log(`  - Total tasks: ${planResult.totalTasks}`);
      console.log(`  - Estimated time: ${planResult.estimatedHours} hours`);
      console.log(`  - Plan saved: ${planResult.planPath}`);

      // Phase 3: Execute - Implement
      console.log('\n=== PHASE 3: EXECUTE (Implement) ===');
      const executeResult = await this.executePhase.execute(
        this.config.epic,
        {
          baseBranch: this.config.git?.baseBranch,
          createBranch: this.config.git?.createBranch,
          createPR: this.config.git?.createPR,
        }
      );

      console.log('[PIVAgent] Execute phase complete');
      console.log(`  - Branch: ${executeResult.branch}`);
      console.log(`  - Files changed: ${executeResult.filesChanged.length}`);
      console.log(`  - Tests pass: ${executeResult.testsPass}`);
      console.log(`  - Build success: ${executeResult.buildSuccess}`);

      if (executeResult.prUrl) {
        console.log(`  - PR created: ${executeResult.prUrl}`);
      }

      const totalDuration = Date.now() - startTime;
      const success =
        primeResult.readyForPlan &&
        planResult.readyForExecute &&
        executeResult.success;

      console.log('\n=== PIV LOOP COMPLETE ===');
      console.log(`Success: ${success}`);
      console.log(`Total duration: ${Math.round(totalDuration / 1000)}s`);

      return {
        prime: primeResult,
        plan: planResult,
        execute: executeResult,
        totalDuration,
        success,
      };
    } catch (error) {
      console.error('[PIVAgent] PIV loop failed:', error);
      throw error;
    }
  }

  /**
   * Run only the Prime phase (research)
   */
  async runPrimeOnly() {
    console.log('[PIVAgent] Running Prime phase only...');
    return await this.primePhase.execute(this.config.project, this.config.epic);
  }

  /**
   * Run only the Plan phase (requires Prime to have run first)
   */
  async runPlanOnly(contextPath: string) {
    console.log('[PIVAgent] Running Plan phase only...');
    return await this.planPhase.execute(contextPath, this.config.epic);
  }

  /**
   * Run only the Execute phase (requires Plan to have run first)
   */
  async runExecuteOnly(executeOptions?: {
    baseBranch?: string;
    createBranch?: boolean;
    createPR?: boolean;
  }) {
    console.log('[PIVAgent] Running Execute phase only...');
    return await this.executePhase.execute(this.config.epic, executeOptions);
  }

  /**
   * Create a local RAG instance (placeholder)
   *
   * In production, this would connect to a real RAG system.
   * For now, it returns undefined.
   */
  private createLocalRAG(): LocalRAG | undefined {
    // TODO: Implement local RAG integration
    // This could use:
    // - Vector database (e.g., Chroma, Pinecone)
    // - Embeddings (e.g., OpenAI, local models)
    // - Document store
    return undefined;
  }

  /**
   * Get configuration
   */
  getConfig(): PIVConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PIVConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Factory function to create a PIV agent
 */
export function createPIVAgent(config: PIVConfig): PIVAgent {
  return new PIVAgent(config);
}

/**
 * Convenience function to run the complete PIV loop
 */
export async function runPIVLoop(config: PIVConfig): Promise<PIVResult> {
  const agent = createPIVAgent(config);
  return await agent.run();
}
