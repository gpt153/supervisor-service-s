/**
 * Multi-Agent CLI Integration Types
 *
 * Type definitions for routing tasks to different AI CLI agents
 * (Gemini, Codex, Claude Code) based on complexity and quota availability.
 */

/**
 * Supported CLI agent types
 */
export type AgentType = 'gemini' | 'codex' | 'claude';

/**
 * Task complexity levels
 */
export type ComplexityLevel = 'simple' | 'medium' | 'complex';

/**
 * Task classification result
 */
export interface TaskClassification {
  /** Assessed complexity level */
  complexity: ComplexityLevel;
  /** Type of task being performed */
  type: TaskType;
  /** Number of files affected */
  filesAffected: number;
  /** Estimated lines of code involved */
  linesOfCode: number;
  /** Whether task is security-critical */
  securityCritical: boolean;
  /** Confidence score of classification (0-1) */
  confidence: number;
}

/**
 * Task types for classification
 */
export type TaskType =
  | 'documentation'
  | 'test-generation'
  | 'boilerplate'
  | 'bug-fix'
  | 'api-implementation'
  | 'refactoring'
  | 'architecture'
  | 'security'
  | 'algorithm'
  | 'research'
  | 'unknown';

/**
 * Quota status for an agent
 */
export interface QuotaStatus {
  /** Agent type */
  agent: AgentType;
  /** Remaining quota */
  remaining: number;
  /** Total quota limit */
  limit: number;
  /** Quota resets at timestamp */
  resetsAt: Date;
  /** Whether agent is currently available */
  available: boolean;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Agent execution request
 */
export interface AgentRequest {
  /** Prompt to send to agent */
  prompt: string;
  /** Working directory for execution */
  cwd: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Additional context files to include */
  contextFiles?: string[];
  /** Expected output format */
  outputFormat?: 'json' | 'text' | 'markdown';
}

/**
 * Agent execution result
 */
export interface AgentResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Agent that was used */
  agent: AgentType;
  /** Parsed output from agent */
  output: any;
  /** Raw output text */
  rawOutput?: string;
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  duration: number;
  /** Estimated cost (if applicable) */
  cost?: number;
  /** Tokens used in request (for quota tracking) */
  tokensUsed?: number;
  /** Timestamp of execution */
  timestamp: Date;
}

/**
 * Routing decision made by AgentRouter
 */
export interface RoutingDecision {
  /** Selected agent */
  selectedAgent: AgentType;
  /** Reason for selection */
  reason: string;
  /** Task classification that led to decision */
  classification: TaskClassification;
  /** Quota status at time of decision */
  quotaStatus: QuotaStatus[];
  /** Fallback agents if primary fails */
  fallbackAgents: AgentType[];
}

/**
 * Agent adapter configuration
 */
export interface AdapterConfig {
  /** Whether adapter is enabled */
  enabled: boolean;
  /** CLI command name */
  cliCommand: string;
  /** Default timeout in ms */
  defaultTimeout: number;
  /** Daily quota limit */
  quotaLimit: number;
  /** Quota reset period in hours */
  quotaResetHours: number;
}

/**
 * Cost tracking entry
 */
export interface CostEntry {
  /** Agent used */
  agent: AgentType;
  /** Task type */
  taskType: TaskType;
  /** Complexity level */
  complexity: ComplexityLevel;
  /** Estimated cost */
  cost: number;
  /** Execution duration */
  duration: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Routing statistics
 */
export interface RoutingStats {
  /** Total tasks routed */
  totalTasks: number;
  /** Tasks per agent */
  tasksByAgent: Record<AgentType, number>;
  /** Tasks per complexity */
  tasksByComplexity: Record<ComplexityLevel, number>;
  /** Success rate per agent */
  successRateByAgent: Record<AgentType, number>;
  /** Average duration per agent */
  avgDurationByAgent: Record<AgentType, number>;
  /** Total estimated cost */
  totalCost: number;
  /** Cost per agent */
  costByAgent: Record<AgentType, number>;
}
