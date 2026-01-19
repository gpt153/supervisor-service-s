/**
 * Plan Phase - Implementation Design
 *
 * Creates a detailed implementation plan with:
 * - Solution approach
 * - Phase-by-phase breakdown
 * - Prescriptive task instructions (for Haiku execution)
 * - Validation commands for each task
 * - Acceptance criteria
 *
 * Uses context from Prime phase to ensure consistency with codebase.
 */

import type {
  Epic,
  PlanResult,
  ImplementationPlan,
  PlanPhase as PlanPhaseType,
  Task,
  ValidationCommand,
  ContextDocument,
  LocalRAG,
} from '../../types/piv.js';
import { PIVStorage } from '../../utils/storage.js';

export class PlanPhase {
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
    this.storage = new PIVStorage(workingDirectory, {
      plansDir: options?.plansDir,
      contextDir: options?.contextDir,
    });
    this.localRAG = options?.localRAG;
  }

  /**
   * Execute the Plan phase
   *
   * Process:
   * 1. Load context from Prime phase
   * 2. Analyze epic requirements
   * 3. Design solution approach
   * 4. Break down into phases
   * 5. Create tasks with prescriptive instructions
   * 6. Define validation for each task
   * 7. Generate implementation plan
   *
   * @returns PlanResult with plan path and metadata
   */
  async execute(contextPath: string, epic: Epic): Promise<PlanResult> {
    console.log(`[PlanPhase] Creating implementation plan for ${epic.id}...`);

    // Step 1: Load context from Prime phase
    console.log('[PlanPhase] Loading context document...');
    const context = await this.storage.loadContextJSON(epic.id);

    // Step 2: Design solution approach
    console.log('[PlanPhase] Designing solution approach...');
    const approach = this.designApproach(epic, context);

    // Step 3: Break down into phases
    console.log('[PlanPhase] Breaking down into phases...');
    const phases = this.createPhases(epic, context);

    // Step 4: Define overall validation
    console.log('[PlanPhase] Defining validation strategy...');
    const overallValidation = this.defineOverallValidation(context);

    // Step 5: Create implementation plan
    const plan: ImplementationPlan = {
      epicId: epic.id,
      projectName: context.project,
      generated: new Date().toISOString(),
      approach,
      phases,
      overallValidation,
      acceptanceCriteria: epic.acceptanceCriteria || [],
      notes: this.generatePlanNotes(epic, context),
    };

    // Calculate estimates
    const totalTasks = phases.reduce((sum, phase) => sum + phase.tasks.length, 0);
    const totalMinutes = phases.reduce(
      (sum, phase) => sum + phase.tasks.reduce((t, task) => t + task.estimatedMinutes, 0),
      0
    );

    // Save plan
    console.log('[PlanPhase] Saving implementation plan...');
    const planPath = await this.storage.savePlanJSON(epic.id, plan);

    console.log(`[PlanPhase] Plan saved: ${planPath}`);

    return {
      planPath,
      phases,
      totalTasks,
      estimatedHours: Math.ceil(totalMinutes / 60),
      validationStrategy: this.describeValidationStrategy(overallValidation),
      readyForExecute: true,
    };
  }

  /**
   * Design the solution approach
   */
  private designApproach(epic: Epic, context: ContextDocument): string {
    const sections: string[] = [];

    sections.push(`## Solution Approach for ${epic.title}`);
    sections.push('');
    sections.push(epic.description);
    sections.push('');

    // Tech stack considerations
    sections.push('### Technical Approach');
    sections.push('');
    sections.push(`This feature will be implemented using the existing tech stack:`);
    for (const tech of context.techStack.techStack) {
      sections.push(`- ${tech}`);
    }
    sections.push('');

    // Conventions
    sections.push('### Code Conventions');
    sections.push('');
    sections.push(`- Files: ${context.conventions.fileNaming}`);
    sections.push(`- Classes: ${context.conventions.classNaming}`);
    sections.push(`- Functions: ${context.conventions.functionNaming}`);
    sections.push('');

    // Integration
    if (context.integrationPoints.length > 0) {
      sections.push('### Integration Points');
      sections.push('');
      for (const point of context.integrationPoints) {
        sections.push(`- ${point.name} (${point.type}): ${point.description}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Create implementation phases with tasks
   */
  private createPhases(epic: Epic, context: ContextDocument): PlanPhaseType[] {
    const phases: PlanPhaseType[] = [];

    // Phase 1: Setup and types
    phases.push(this.createSetupPhase(epic, context));

    // Phase 2: Core implementation
    phases.push(this.createCorePhase(epic, context));

    // Phase 3: Testing
    if (context.techStack.testingFramework) {
      phases.push(this.createTestingPhase(epic, context));
    }

    // Phase 4: Documentation (if needed)
    if (epic.acceptanceCriteria.some((c) => c.toLowerCase().includes('documentation'))) {
      phases.push(this.createDocumentationPhase(epic, context));
    }

    return phases;
  }

  /**
   * Create setup phase
   */
  private createSetupPhase(epic: Epic, context: ContextDocument): PlanPhaseType {
    const tasks: Task[] = [];

    // Task: Create type definitions
    if (context.techStack.languages.includes('TypeScript')) {
      tasks.push({
        id: `${epic.id}-setup-1`,
        title: 'Define TypeScript interfaces and types',
        description: 'Create type definitions for new features',
        files: [`src/types/${this.getFeatureName(epic)}.ts`],
        prescriptiveInstructions: this.createTypeDefinitionInstructions(epic, context),
        validations: [
          {
            description: 'TypeScript compilation succeeds',
            command: 'npm run build',
            expectedOutput: 'no errors',
            failureAction: 'retry',
          },
        ],
        estimatedMinutes: 15,
      });
    }

    return {
      name: 'Setup',
      description: 'Create necessary types and structure',
      tasks,
      dependencies: [],
    };
  }

  /**
   * Create core implementation phase
   */
  private createCorePhase(epic: Epic, context: ContextDocument): PlanPhaseType {
    const tasks: Task[] = [];

    // This is a placeholder - in production, this would use AI to analyze
    // the epic and generate specific tasks
    tasks.push({
      id: `${epic.id}-core-1`,
      title: 'Implement core functionality',
      description: epic.description,
      files: [`src/${this.getFeatureName(epic)}.ts`],
      prescriptiveInstructions: this.createCoreInstructions(epic, context),
      validations: [
        {
          description: 'Code compiles without errors',
          command: context.techStack.buildSystem === 'TypeScript' ? 'npm run build' : 'npm run lint',
          expectedOutput: 'no errors',
          failureAction: 'retry',
        },
      ],
      estimatedMinutes: 60,
    });

    return {
      name: 'Core Implementation',
      description: 'Implement main feature functionality',
      tasks,
      dependencies: ['Setup'],
    };
  }

  /**
   * Create testing phase
   */
  private createTestingPhase(epic: Epic, context: ContextDocument): PlanPhaseType {
    const tasks: Task[] = [];

    const testFramework = context.techStack.testingFramework || 'Jest';

    tasks.push({
      id: `${epic.id}-test-1`,
      title: 'Write unit tests',
      description: `Write comprehensive unit tests using ${testFramework}`,
      files: [`src/${this.getFeatureName(epic)}.test.ts`],
      prescriptiveInstructions: this.createTestInstructions(epic, context),
      validations: [
        {
          description: 'All tests pass',
          command: 'npm test',
          expectedOutput: 'all tests passed',
          failureAction: 'retry',
        },
        {
          description: 'Code coverage meets threshold',
          command: 'npm run test:coverage',
          expectedOutput: 'coverage > 80%',
          failureAction: 'escalate',
        },
      ],
      estimatedMinutes: 45,
    });

    return {
      name: 'Testing',
      description: 'Write comprehensive tests',
      tasks,
      dependencies: ['Core Implementation'],
    };
  }

  /**
   * Create documentation phase
   */
  private createDocumentationPhase(epic: Epic, context: ContextDocument): PlanPhaseType {
    const tasks: Task[] = [];

    tasks.push({
      id: `${epic.id}-docs-1`,
      title: 'Update documentation',
      description: 'Document new feature and usage',
      files: ['README.md', `docs/${this.getFeatureName(epic)}.md`],
      prescriptiveInstructions: this.createDocumentationInstructions(epic, context),
      validations: [
        {
          description: 'Documentation is complete',
          command: 'echo "Manual review required"',
          expectedOutput: 'Manual review required',
          failureAction: 'escalate',
        },
      ],
      estimatedMinutes: 20,
    });

    return {
      name: 'Documentation',
      description: 'Update documentation for new feature',
      tasks,
      dependencies: ['Core Implementation', 'Testing'],
    };
  }

  /**
   * Define overall validation commands
   */
  private defineOverallValidation(context: ContextDocument): ValidationCommand[] {
    const validations: ValidationCommand[] = [];

    // Build validation
    validations.push({
      description: 'Full build succeeds',
      command: 'npm run build',
      expectedOutput: 'Build completed successfully',
      failureAction: 'retry',
    });

    // Test validation
    if (context.techStack.testingFramework) {
      validations.push({
        description: 'All tests pass',
        command: 'npm test',
        expectedOutput: 'All tests passed',
        failureAction: 'retry',
      });
    }

    // Lint validation
    validations.push({
      description: 'Linting passes',
      command: 'npm run lint',
      expectedOutput: 'No linting errors',
      failureAction: 'retry',
    });

    return validations;
  }

  /**
   * Generate plan notes
   */
  private generatePlanNotes(epic: Epic, context: ContextDocument): string[] {
    const notes: string[] = [];

    // Convention notes
    notes.push(`Follow ${context.conventions.fileNaming} file naming convention`);
    notes.push(`Use ${context.conventions.classNaming} for class names`);

    // Recommendations from Prime phase
    for (const rec of context.recommendations) {
      notes.push(rec);
    }

    // Pattern notes
    for (const pattern of context.existingPatterns) {
      notes.push(`Existing pattern: ${pattern}`);
    }

    return notes;
  }

  /**
   * Helper: Get feature name from epic
   */
  private getFeatureName(epic: Epic): string {
    return epic.id.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  /**
   * Helper: Create type definition instructions
   */
  private createTypeDefinitionInstructions(epic: Epic, context: ContextDocument): string {
    return `
Create TypeScript type definitions for ${epic.title}.

Follow these conventions:
- Use ${context.conventions.classNaming} for interface names
- Use ${context.conventions.constantNaming} for type constants
- Export all public types

Structure:
1. Define main interfaces
2. Define supporting types
3. Export all types

Example structure:
\`\`\`typescript
export interface MainType {
  // Properties based on epic requirements
}

export type SupportingType = string | number;

export const CONSTANT_VALUE = 'value' as const;
\`\`\`
`.trim();
  }

  /**
   * Helper: Create core implementation instructions
   */
  private createCoreInstructions(epic: Epic, context: ContextDocument): string {
    return `
Implement ${epic.title}.

Requirements:
${epic.description}

Follow these conventions:
- File naming: ${context.conventions.fileNaming}
- Function naming: ${context.conventions.functionNaming}
- Class naming: ${context.conventions.classNaming}

Integration points:
${context.integrationPoints.map((p) => `- ${p.name} (${p.type})`).join('\n')}

Implementation steps:
1. Import required dependencies
2. Define class/function structure
3. Implement core logic
4. Handle error cases
5. Add JSDoc comments

Ensure:
- Type safety with TypeScript
- Error handling
- Clear function documentation
`.trim();
  }

  /**
   * Helper: Create test instructions
   */
  private createTestInstructions(epic: Epic, context: ContextDocument): string {
    const testFramework = context.techStack.testingFramework || 'Jest';

    return `
Write comprehensive unit tests for ${epic.title} using ${testFramework}.

Test structure:
1. Import the code under test
2. Setup test fixtures
3. Write test cases:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - Boundary conditions

Follow ${testFramework} best practices:
- Use descriptive test names
- One assertion per test (when possible)
- Setup and teardown properly
- Mock external dependencies

Coverage requirements:
- Aim for 80%+ code coverage
- Cover all public methods
- Test error scenarios
`.trim();
  }

  /**
   * Helper: Create documentation instructions
   */
  private createDocumentationInstructions(epic: Epic, context: ContextDocument): string {
    return `
Document ${epic.title}.

Documentation should include:
1. Feature overview
2. Usage examples
3. API reference (if applicable)
4. Configuration options
5. Integration guide

Update:
- README.md with feature summary
- Create feature-specific docs if needed
- Add JSDoc comments to code

Follow existing documentation style in the project.
`.trim();
  }

  /**
   * Helper: Describe validation strategy
   */
  private describeValidationStrategy(validations: ValidationCommand[]): string {
    return `${validations.length} validation checks: ${validations.map((v) => v.description).join(', ')}`;
  }
}
