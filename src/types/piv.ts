/**
 * PIV Loop Type Definitions
 * Plan → Implement → Validate workflow types
 */

export interface ProjectContext {
  name: string;
  path: string;
  techStack?: string[];
  conventions?: Record<string, string>;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  tasks?: string[];
}

export interface CodebaseStructure {
  techStack: string[];
  packageManager: string;
  frameworks: string[];
  languages: string[];
  testingFramework?: string;
  buildSystem?: string;
}

export interface NamingConventions {
  fileNaming: string; // e.g., "kebab-case", "camelCase"
  classNaming: string; // e.g., "PascalCase"
  functionNaming: string; // e.g., "camelCase"
  constantNaming: string; // e.g., "SCREAMING_SNAKE_CASE"
  componentNaming?: string; // For UI frameworks
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  purpose?: string;
}

export interface IntegrationPoint {
  name: string;
  type: 'api' | 'database' | 'service' | 'library' | 'external';
  description: string;
  files: string[];
}

export interface RAGResult {
  source: string;
  content: string;
  relevance: number;
  metadata?: Record<string, any>;
}

// Prime Phase Types
export interface PrimeResult {
  contextPath: string;
  techStack: string[];
  conventions: NamingConventions;
  dependencies: DependencyInfo[];
  integrationPoints: IntegrationPoint[];
  ragInsights: RAGResult[];
  readyForPlan: boolean;
}

export interface ContextDocument {
  project: string;
  epicId: string;
  generated: string; // ISO timestamp
  techStack: CodebaseStructure;
  conventions: NamingConventions;
  dependencies: DependencyInfo[];
  integrationPoints: IntegrationPoint[];
  ragInsights: RAGResult[];
  existingPatterns: string[];
  recommendations: string[];
}

// Plan Phase Types
export interface ValidationCommand {
  description: string;
  command: string;
  expectedOutput?: string;
  failureAction: 'retry' | 'escalate' | 'skip';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  files: string[];
  prescriptiveInstructions: string;
  validations: ValidationCommand[];
  estimatedMinutes: number;
}

export interface PlanPhase {
  name: string;
  description: string;
  tasks: Task[];
  dependencies: string[]; // IDs of tasks that must complete first
}

export interface PlanResult {
  planPath: string;
  phases: PlanPhase[];
  totalTasks: number;
  estimatedHours: number;
  validationStrategy: string;
  readyForExecute: boolean;
}

export interface ImplementationPlan {
  epicId: string;
  projectName: string;
  generated: string; // ISO timestamp
  approach: string;
  phases: PlanPhase[];
  overallValidation: ValidationCommand[];
  acceptanceCriteria: string[];
  notes: string[];
}

// Execute Phase Types
export interface ValidationResult {
  command: string;
  success: boolean;
  output: string;
  error?: string;
  timestamp: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  filesChanged: string[];
  validationResults: ValidationResult[];
  retries: number;
  error?: string;
  duration: number; // milliseconds
}

export interface ExecuteResult {
  success: boolean;
  branch: string;
  commit: string;
  prNumber?: number;
  prUrl?: string;
  taskResults: TaskResult[];
  totalDuration: number; // milliseconds
  filesChanged: string[];
  testsPass: boolean;
  buildSuccess: boolean;
}

// PIV Agent Types
export interface PIVConfig {
  project: ProjectContext;
  epic: Epic;
  workingDirectory: string;
  models?: {
    prime?: string; // Default: claude-sonnet-4.5
    plan?: string; // Default: claude-sonnet-4.5
    execute?: string; // Default: claude-haiku-4
  };
  storage?: {
    plansDir?: string; // Default: .agents/plans
    contextDir?: string; // Default: .agents/context
  };
  git?: {
    createBranch?: boolean; // Default: true
    createPR?: boolean; // Default: true
    baseBranch?: string; // Default: main
  };
}

export interface PIVResult {
  prime: PrimeResult;
  plan: PlanResult;
  execute: ExecuteResult;
  totalDuration: number;
  success: boolean;
}

// Local RAG Types (simplified - will be expanded later)
export interface LocalRAGSearchOptions {
  limit?: number;
  minRelevance?: number;
  sources?: string[];
}

export interface LocalRAG {
  search(query: string, options?: LocalRAGSearchOptions): Promise<RAGResult[]>;
  index(source: string, content: string, metadata?: Record<string, any>): Promise<void>;
}
