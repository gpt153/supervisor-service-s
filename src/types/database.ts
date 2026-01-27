/**
 * Database type definitions for supervisor-service
 * Auto-generated from PostgreSQL schema
 */

// ============================================================================
// Core Base Types
// ============================================================================

export interface Timestamps {
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Migration 001: Initial Schema
// ============================================================================

export interface Project extends Timestamps {
  id: string;
  name: string;
  path: string;
  description: string | null;
  status: ProjectStatus;
  metadata: Record<string, any>;
}

export type ProjectStatus = 'active' | 'inactive' | 'archived' | 'paused';

export interface Epic extends Timestamps {
  id: string;
  project_id: string | null;
  epic_id: string;
  title: string;
  description: string | null;
  status: EpicStatus;
  priority: Priority;
  estimated_hours: number | null;
  actual_hours: number | null;
  complexity: Complexity | null;
  dependencies: string[];
  metadata: Record<string, any>;
  completed_at: Date | null;
}

export type EpicStatus = 'planned' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Complexity = 'simple' | 'moderate' | 'complex';

export interface Issue extends Timestamps {
  id: string;
  project_id: string;
  epic_id: string | null;
  issue_number: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: Priority;
  labels: string[];
  assignee: string | null;
  github_id: number | null;
  github_url: string | null;
  metadata: Record<string, any>;
  closed_at: Date | null;
}

export type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'closed' | 'cancelled';

export interface Task extends Timestamps {
  id: string;
  project_id: string;
  epic_id: string | null;
  issue_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  order_index: number;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  metadata: Record<string, any>;
  completed_at: Date | null;
}

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

export interface ServiceStatus extends Timestamps {
  id: string;
  project_id: string | null;
  service_name: string;
  status: ServiceHealthStatus;
  last_check: Date;
  response_time_ms: number | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface Comment extends Timestamps {
  id: string;
  issue_id: string | null;
  task_id: string | null;
  author: string;
  content: string;
  github_id: number | null;
  metadata: Record<string, any>;
}

// ============================================================================
// Migration 002: Secrets Management (Simplified Hierarchical)
// ============================================================================

export interface Secret extends Timestamps {
  id: number;
  key_path: string; // Hierarchical path: meta/cloudflare/api_token
  encrypted_value: Buffer;
  description: string | null;
  scope: SecretScope;
  project_name: string | null;
  service_name: string | null;
  created_by: string;
  last_accessed_at: Date | null;
  access_count: number;
  expires_at: Date | null;
  rotation_required: boolean;
}

export type SecretScope = 'meta' | 'project' | 'service';

export interface SecretAccessLog {
  id: number;
  key_path: string;
  accessed_by: string;
  access_type: SecretAccessType;
  success: boolean;
  error_message: string | null;
  accessed_at: Date;
}

export type SecretAccessType = 'read' | 'create' | 'update' | 'delete';

export interface SecretsExpiringSoon {
  id: number;
  key_path: string;
  description: string | null;
  scope: SecretScope;
  expires_at: Date;
  time_until_expiry: string;
}

export interface SecretsNeedingRotation {
  id: number;
  key_path: string;
  description: string | null;
  scope: SecretScope;
  last_accessed_at: Date | null;
  rotation_required: boolean;
}

// ============================================================================
// Migration 003: Port Allocation
// ============================================================================

export interface PortRange extends Timestamps {
  id: string;
  range_name: string;
  start_port: number;
  end_port: number;
  description: string | null;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface PortAllocation extends Timestamps {
  id: string;
  project_id: string;
  port_range_id: string;
  port_number: number;
  service_name: string;
  service_type: string | null;
  status: PortStatus;
  process_id: number | null;
  hostname: string;
  protocol: Protocol;
  metadata: Record<string, any>;
  allocated_at: Date;
  last_used_at: Date | null;
  released_at: Date | null;
}

export type PortStatus = 'allocated' | 'in_use' | 'released';
export type Protocol = 'tcp' | 'udp';

export interface PortHealthCheck {
  id: string;
  port_allocation_id: string;
  check_type: PortCheckType;
  status: PortHealthStatus;
  response_time_ms: number | null;
  error_message: string | null;
  metadata: Record<string, any>;
  checked_at: Date;
}

export type PortCheckType = 'tcp' | 'http' | 'ping';
export type PortHealthStatus = 'healthy' | 'unhealthy' | 'timeout';

export interface PortReservation extends Timestamps {
  id: string;
  project_id: string;
  port_range_id: string;
  port_number: number;
  service_name: string;
  reserved_by: string;
  expires_at: Date;
  metadata: Record<string, any>;
}

export interface PortRangeUtilization {
  range_id: string;
  range_name: string;
  start_port: number;
  end_port: number;
  total_ports: number;
  allocated_ports: number;
  released_ports: number;
  reserved_ports: number;
  utilization_percent: number;
}

export interface ActivePortAllocation {
  id: string;
  port_number: number;
  service_name: string;
  service_type: string | null;
  status: PortStatus;
  hostname: string;
  protocol: Protocol;
  allocated_at: Date;
  last_used_at: Date | null;
  project_name: string;
  range_name: string;
}

// ============================================================================
// Migration 004: Task Timing
// ============================================================================

export interface TaskExecution extends Timestamps {
  id: string;
  task_id: string;
  project_id: string;
  execution_number: number;
  started_at: Date;
  completed_at: Date | null;
  duration_minutes: number | null;
  estimated_minutes: number | null;
  variance_minutes: number | null;
  variance_percent: number | null;
  status: ExecutionStatus;
  complexity: Complexity | null;
  context_switches: number;
  interruptions: number;
  blockers: string[];
  notes: string | null;
  metadata: Record<string, any>;
}

export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface EstimationPattern extends Timestamps {
  id: string;
  project_id: string;
  pattern_name: string;
  task_type: string;
  complexity: Complexity;
  avg_duration_minutes: number | null;
  std_deviation: number | null;
  sample_count: number;
  confidence_score: number;
  factors: Record<string, any>;
  metadata: Record<string, any>;
}

export interface TimeTrackingSession extends Timestamps {
  id: string;
  task_execution_id: string;
  session_number: number;
  started_at: Date;
  ended_at: Date | null;
  duration_minutes: number | null;
  activity_type: ActivityType | null;
  productivity_rating: number | null;
  notes: string | null;
  metadata: Record<string, any>;
}

export type ActivityType = 'coding' | 'debugging' | 'research' | 'documentation' | 'meeting' | 'review';

export interface EstimationFactor extends Timestamps {
  id: string;
  factor_name: string;
  description: string | null;
  impact_type: ImpactType;
  average_impact: number | null;
  metadata: Record<string, any>;
}

export type ImpactType = 'multiplier' | 'additive' | 'percentage';

export interface TaskExecutionFactor {
  id: string;
  task_execution_id: string;
  factor_id: string;
  factor_value: number | null;
  notes: string | null;
  created_at: Date;
}

export interface EstimationAccuracyByProject {
  project_id: string;
  project_name: string;
  total_executions: number;
  avg_variance_percent: number | null;
  stddev_variance_percent: number | null;
  within_10_percent: number;
  within_25_percent: number;
  over_estimated: number;
  under_estimated: number;
}

export interface TaskPerformanceTrend {
  task_id: string;
  task_title: string;
  project_id: string;
  execution_count: number;
  avg_duration: number | null;
  min_duration: number | null;
  max_duration: number | null;
  avg_variance_percent: number | null;
  total_context_switches: number;
  total_interruptions: number;
}

// ============================================================================
// Migration 005: Learnings Index (RAG)
// ============================================================================

export interface KnowledgeSource extends Timestamps {
  id: string;
  project_id: string | null;
  source_type: KnowledgeSourceType;
  source_id: string | null;
  title: string;
  url: string | null;
  file_path: string | null;
  author: string | null;
  metadata: Record<string, any>;
  indexed_at: Date | null;
}

export type KnowledgeSourceType = 'adr' | 'issue' | 'epic' | 'task' | 'code' | 'documentation' | 'external';

export interface KnowledgeChunk extends Timestamps {
  id: string;
  source_id: string;
  project_id: string;
  chunk_index: number;
  content: string;
  content_hash: string | null;
  embedding: number[] | null; // pgvector stores as array
  token_count: number | null;
  metadata: Record<string, any>;
}

export interface Learning extends Timestamps {
  id: string;
  project_id: string;
  title: string;
  content: string;
  learning_type: LearningType;
  category: string | null;
  confidence_score: number;
  impact_level: ImpactLevel;
  source_chunks: string[];
  tags: string[];
  embedding: number[] | null;
  verified: boolean;
  verified_by: string | null;
  verified_at: Date | null;
  usage_count: number;
  last_used_at: Date | null;
  metadata: Record<string, any>;
}

export type LearningType = 'pattern' | 'best_practice' | 'antipattern' | 'lesson_learned' | 'tip';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';

export interface LearningApplication {
  id: string;
  learning_id: string;
  applied_to_type: ApplicationTargetType;
  applied_to_id: string | null;
  context: string | null;
  outcome: ApplicationOutcome | null;
  feedback: string | null;
  created_at: Date;
}

export type ApplicationTargetType = 'epic' | 'issue' | 'task' | 'code_review';
export type ApplicationOutcome = 'successful' | 'failed' | 'partial';

export interface SearchQuery {
  id: string;
  project_id: string | null;
  query_text: string;
  query_embedding: number[] | null;
  search_type: SearchType;
  result_count: number | null;
  top_result_id: string | null;
  top_result_similarity: number | null;
  filters: Record<string, any>;
  user_feedback: SearchFeedback | null;
  metadata: Record<string, any>;
  created_at: Date;
}

export type SearchType = 'semantic' | 'keyword' | 'hybrid';
export type SearchFeedback = 'helpful' | 'not_helpful' | 'partial';

export interface SearchKnowledgeChunksResult {
  chunk_id: string;
  source_id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

export interface SearchLearningsResult {
  learning_id: string;
  title: string;
  content: string;
  learning_type: LearningType;
  category: string | null;
  similarity: number;
  confidence_score: number;
}

export interface LearningEffectiveness {
  id: string;
  title: string;
  learning_type: LearningType;
  category: string | null;
  confidence_score: number;
  usage_count: number;
  application_count: number;
  successful_applications: number;
  failed_applications: number;
  success_rate_percent: number | null;
}

export interface KnowledgeCoverageByProject {
  project_id: string;
  project_name: string;
  source_count: number;
  chunk_count: number;
  learning_count: number;
  total_tokens: number | null;
  source_type_count: number;
  source_types: KnowledgeSourceType[];
}

export interface PopularSearchQuery {
  project_id: string | null;
  query_text: string;
  query_count: number;
  avg_results: number | null;
  helpful_count: number;
  not_helpful_count: number;
  last_queried: Date;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

export interface CreateProjectParams {
  name: string;
  path: string;
  description?: string;
  status?: ProjectStatus;
  metadata?: Record<string, any>;
}

export interface CreateEpicParams {
  project_id?: string;
  epic_id: string;
  title: string;
  description?: string;
  status?: EpicStatus;
  priority?: Priority;
  estimated_hours?: number;
  complexity?: Complexity;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface CreateIssueParams {
  project_id: string;
  epic_id?: string;
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: Priority;
  labels?: string[];
  assignee?: string;
  github_id?: number;
  github_url?: string;
  metadata?: Record<string, any>;
}

export interface CreateTaskParams {
  project_id: string;
  epic_id?: string;
  issue_id?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  order_index?: number;
  estimated_minutes?: number;
  metadata?: Record<string, any>;
}

export interface AllocatePortParams {
  project_id: string;
  range_id: string;
  service_name: string;
  service_type?: string;
  hostname?: string;
  protocol?: Protocol;
}

export interface SetSecretParams {
  keyPath: string;
  value: string; // Unencrypted value (will be encrypted before storage)
  description?: string;
  expiresAt?: Date;
}

export interface GetSecretParams {
  keyPath: string;
}

export interface ListSecretsParams {
  scope?: SecretScope;
  project?: string;
  service?: string;
}

export interface DeleteSecretParams {
  keyPath: string;
}

export interface StartTaskExecutionParams {
  task_id: string;
  project_id: string;
  estimated_minutes?: number;
  complexity?: Complexity;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CreateLearningParams {
  project_id: string;
  title: string;
  content: string;
  learning_type: LearningType;
  category?: string;
  confidence_score?: number;
  impact_level?: ImpactLevel;
  source_chunks?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface SearchKnowledgeParams {
  query_embedding: number[];
  project_id?: string;
  limit?: number;
  min_similarity?: number;
}

export interface SearchLearningsParams {
  query_embedding: number[];
  project_id?: string;
  category?: string;
  limit?: number;
  min_similarity?: number;
}

// ============================================================================
// Migration 006: Evidence Collection Framework
// ============================================================================

export interface EvidenceArtifactRow {
  id: number;
  epic_id: string;
  test_id: string;
  test_type: 'ui' | 'api' | 'unit' | 'integration';
  verification_level?: number;
  test_name: string;
  expected_outcome?: string;
  actual_outcome?: string;
  pass_fail: 'pass' | 'fail' | 'pending';
  screenshot_before?: string;
  screenshot_after?: string;
  dom_snapshot?: string;
  console_logs?: string;
  network_trace?: string;
  http_request?: string;
  http_response?: string;
  coverage_report?: string;
  timestamp: Date;
  duration_ms?: number;
  error_message?: string;
  stack_trace?: string;
  created_at: Date;
  updated_at: Date;
}

export interface EvidenceMetadata {
  id: number;
  evidence_id: number;
  metadata_key: string;
  metadata_value?: string;
  created_at: Date;
}

export interface ConsoleLogEntry {
  id: number;
  evidence_id: number;
  log_level?: 'log' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp?: Date;
  created_at: Date;
}

export interface NetworkTraceEntry {
  id: number;
  evidence_id: number;
  method?: string;
  url: string;
  status_code?: number;
  response_time_ms?: number;
  request_body?: string;
  response_body?: string;
  timestamp?: Date;
  created_at: Date;
}

export interface HttpRequestResponsePair {
  id: number;
  evidence_id: number;
  correlation_id?: string;
  request_method?: string;
  request_url: string;
  request_headers?: Record<string, string>;
  request_body?: any;
  response_status?: number;
  response_headers?: Record<string, string>;
  response_body?: any;
  response_time_ms?: number;
  timestamp?: Date;
  created_at: Date;
}

export interface ToolExecutionRecord {
  id: number;
  evidence_id: number;
  tool_name?: string;
  tool_params?: any;
  tool_response?: any;
  execution_time_ms?: number;
  success?: boolean;
  error_message?: string;
  timestamp?: Date;
  created_at: Date;
}

export interface CoverageMetrics {
  id: number;
  evidence_id: number;
  line_coverage_percent?: number;
  branch_coverage_percent?: number;
  function_coverage_percent?: number;
  statement_coverage_percent?: number;
  coverage_report_path?: string;
  timestamp?: Date;
  created_at: Date;
}

export interface RetentionRecord {
  id: number;
  evidence_id: number;
  archive_date?: Date;
  delete_date?: Date;
  archived?: boolean;
  deleted?: boolean;
  created_at: Date;
}
