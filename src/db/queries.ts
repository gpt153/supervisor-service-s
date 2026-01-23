/**
 * Database query helpers for common operations
 */

import { pool } from './client.js';
import type {
  Project,
  Epic,
  Issue,
  Task,
  CreateProjectParams,
  CreateEpicParams,
  CreateIssueParams,
  CreateTaskParams,
  PortAllocation,
  AllocatePortParams,
} from '../types/database.js';
import type { UIRequirement } from '../types/ui-001.js';
import type { UIMockup, DesignMethod, MockupStatus, DesignData, ComponentMapping } from '../types/ui-003.js';

// ============================================================================
// Projects
// ============================================================================

export async function createProject(params: CreateProjectParams): Promise<Project> {
  const query = `
    INSERT INTO projects (name, path, description, status, metadata)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;

  const result = await pool.query<Project>(query, [
    params.name,
    params.path,
    params.description || null,
    params.status || 'active',
    params.metadata || {},
  ]);

  return result.rows[0];
}

export async function getProjectByName(name: string): Promise<Project | null> {
  const query = 'SELECT * FROM projects WHERE name = $1';
  const result = await pool.query<Project>(query, [name]);
  return result.rows[0] || null;
}

export async function getAllProjects(): Promise<Project[]> {
  const query = 'SELECT * FROM projects ORDER BY created_at DESC';
  const result = await pool.query<Project>(query);
  return result.rows;
}

export async function updateProjectStatus(id: string, status: string): Promise<void> {
  const query = 'UPDATE projects SET status = $1 WHERE id = $2';
  await pool.query(query, [status, id]);
}

// ============================================================================
// Epics
// ============================================================================

export async function createEpic(params: CreateEpicParams): Promise<Epic> {
  const query = `
    INSERT INTO epics (
      project_id, epic_id, title, description, status, priority,
      estimated_hours, complexity, dependencies, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const result = await pool.query<Epic>(query, [
    params.project_id || null,
    params.epic_id,
    params.title,
    params.description || null,
    params.status || 'planned',
    params.priority || 'medium',
    params.estimated_hours || null,
    params.complexity || null,
    params.dependencies || [],
    params.metadata || {},
  ]);

  return result.rows[0];
}

export async function getEpicByEpicId(epic_id: string): Promise<Epic | null> {
  const query = 'SELECT * FROM epics WHERE epic_id = $1';
  const result = await pool.query<Epic>(query, [epic_id]);
  return result.rows[0] || null;
}

export async function getEpicsByProject(project_id: string): Promise<Epic[]> {
  const query = 'SELECT * FROM epics WHERE project_id = $1 ORDER BY created_at DESC';
  const result = await pool.query<Epic>(query, [project_id]);
  return result.rows;
}

export async function updateEpicStatus(id: string, status: string): Promise<void> {
  const query = `
    UPDATE epics
    SET status = $1, completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = $2
  `;
  await pool.query(query, [status, id]);
}

// ============================================================================
// Issues
// ============================================================================

export async function createIssue(params: CreateIssueParams): Promise<Issue> {
  const query = `
    INSERT INTO issues (
      project_id, epic_id, title, description, status, priority,
      labels, assignee, github_id, github_url, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  const result = await pool.query<Issue>(query, [
    params.project_id,
    params.epic_id || null,
    params.title,
    params.description || null,
    params.status || 'open',
    params.priority || 'medium',
    params.labels || [],
    params.assignee || null,
    params.github_id || null,
    params.github_url || null,
    params.metadata || {},
  ]);

  return result.rows[0];
}

export async function getIssuesByProject(project_id: string, status?: string): Promise<Issue[]> {
  let query = 'SELECT * FROM issues WHERE project_id = $1';
  const params: any[] = [project_id];

  if (status) {
    query += ' AND status = $2';
    params.push(status);
  }

  query += ' ORDER BY issue_number DESC';

  const result = await pool.query<Issue>(query, params);
  return result.rows;
}

export async function getIssuesByEpic(epic_id: string): Promise<Issue[]> {
  const query = 'SELECT * FROM issues WHERE epic_id = $1 ORDER BY issue_number DESC';
  const result = await pool.query<Issue>(query, [epic_id]);
  return result.rows;
}

export async function updateIssueStatus(id: string, status: string): Promise<void> {
  const query = `
    UPDATE issues
    SET status = $1, closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END
    WHERE id = $2
  `;
  await pool.query(query, [status, id]);
}

// ============================================================================
// Tasks
// ============================================================================

export async function createTask(params: CreateTaskParams): Promise<Task> {
  const query = `
    INSERT INTO tasks (
      project_id, epic_id, issue_id, title, description,
      status, order_index, estimated_minutes, metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await pool.query<Task>(query, [
    params.project_id,
    params.epic_id || null,
    params.issue_id || null,
    params.title,
    params.description || null,
    params.status || 'pending',
    params.order_index || 0,
    params.estimated_minutes || null,
    params.metadata || {},
  ]);

  return result.rows[0];
}

export async function getTasksByIssue(issue_id: string): Promise<Task[]> {
  const query = 'SELECT * FROM tasks WHERE issue_id = $1 ORDER BY order_index ASC';
  const result = await pool.query<Task>(query, [issue_id]);
  return result.rows;
}

export async function getTasksByEpic(epic_id: string): Promise<Task[]> {
  const query = 'SELECT * FROM tasks WHERE epic_id = $1 ORDER BY order_index ASC';
  const result = await pool.query<Task>(query, [epic_id]);
  return result.rows;
}

export async function updateTaskStatus(id: string, status: string, actual_minutes?: number): Promise<void> {
  const query = `
    UPDATE tasks
    SET
      status = $1,
      actual_minutes = COALESCE($2, actual_minutes),
      completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END
    WHERE id = $3
  `;
  await pool.query(query, [status, actual_minutes || null, id]);
}

// ============================================================================
// Port Allocation
// ============================================================================

export async function allocatePort(params: AllocatePortParams): Promise<number> {
  const query = `
    SELECT allocate_port($1, $2, $3, $4, $5, $6) as port_number
  `;

  const result = await pool.query<{ port_number: number }>(query, [
    params.project_id,
    params.range_id,
    params.service_name,
    params.service_type || null,
    params.hostname || 'localhost',
    params.protocol || 'tcp',
  ]);

  return result.rows[0].port_number;
}

export async function releasePort(port_number: number, hostname: string = 'localhost'): Promise<boolean> {
  const query = 'SELECT release_port($1, $2) as released';
  const result = await pool.query<{ released: boolean }>(query, [port_number, hostname]);
  return result.rows[0].released;
}

export async function getPortAllocationsByProject(project_id: string): Promise<PortAllocation[]> {
  const query = `
    SELECT * FROM port_allocations
    WHERE project_id = $1 AND status IN ('allocated', 'in_use')
    ORDER BY port_number ASC
  `;
  const result = await pool.query<PortAllocation>(query, [project_id]);
  return result.rows;
}

// ============================================================================
// Learning System
// ============================================================================

export async function searchLearningsByEmbedding(
  queryEmbedding: number[],
  options: {
    project_id?: string;
    category?: string;
    limit?: number;
    min_similarity?: number;
  } = {}
): Promise<any[]> {
  const query = `
    SELECT * FROM search_learnings(
      $1::vector(1536),
      $2::uuid,
      $3::varchar,
      $4::integer,
      $5::numeric
    )
  `;

  const result = await pool.query(query, [
    JSON.stringify(queryEmbedding),
    options.project_id || null,
    options.category || null,
    options.limit || 5,
    options.min_similarity || 0.7,
  ]);

  return result.rows;
}

export async function getLearningEffectiveness(): Promise<any[]> {
  const query = 'SELECT * FROM learning_effectiveness ORDER BY success_rate_percent DESC';
  const result = await pool.query(query);
  return result.rows;
}

export async function getKnowledgeCoverageByProject(): Promise<any[]> {
  const query = 'SELECT * FROM knowledge_coverage_by_project';
  const result = await pool.query(query);
  return result.rows;
}

export async function getPopularSearchQueries(): Promise<any[]> {
  const query = 'SELECT * FROM popular_search_queries';
  const result = await pool.query(query);
  return result.rows;
}

export async function recordSearchQuery(params: {
  project_id?: string;
  query_text: string;
  query_embedding: number[];
  search_type: 'semantic' | 'keyword' | 'hybrid';
  result_count: number;
  top_result_id?: string;
  top_result_similarity?: number;
}): Promise<void> {
  const query = `
    INSERT INTO search_queries (
      project_id,
      query_text,
      query_embedding,
      search_type,
      result_count,
      top_result_id,
      top_result_similarity
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  await pool.query(query, [
    params.project_id || null,
    params.query_text,
    JSON.stringify(params.query_embedding),
    params.search_type,
    params.result_count,
    params.top_result_id || null,
    params.top_result_similarity || null,
  ]);
}

// ============================================================================
// Health Checks
// ============================================================================

export async function getServiceHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    await pool.query('SELECT 1');
    return { healthy: true, message: 'Database connection healthy' };
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Statistics
// ============================================================================

export async function getProjectStatistics(project_id: string): Promise<{
  total_epics: number;
  completed_epics: number;
  total_issues: number;
  open_issues: number;
  total_tasks: number;
  completed_tasks: number;
}> {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM epics WHERE project_id = $1) as total_epics,
      (SELECT COUNT(*) FROM epics WHERE project_id = $1 AND status = 'completed') as completed_epics,
      (SELECT COUNT(*) FROM issues WHERE project_id = $1) as total_issues,
      (SELECT COUNT(*) FROM issues WHERE project_id = $1 AND status = 'open') as open_issues,
      (SELECT COUNT(*) FROM tasks WHERE project_id = $1) as total_tasks,
      (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND status = 'completed') as completed_tasks
  `;

  const result = await pool.query(query, [project_id]);
  return result.rows[0];
}

// ============================================================================
// UI Requirements (Epic UI-001)
// ============================================================================

/**
 * Create or update UI requirements for an epic
 *
 * @param requirement - UI requirement data (without id, created_at, updated_at)
 * @returns Created or updated UI requirement
 */
export async function upsertUIRequirement(
  requirement: Omit<UIRequirement, 'id' | 'created_at' | 'updated_at'>
): Promise<UIRequirement> {
  const query = `
    INSERT INTO ui_requirements (
      epic_id,
      project_name,
      acceptance_criteria,
      user_stories,
      data_requirements,
      navigation_needs,
      design_constraints
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (epic_id)
    DO UPDATE SET
      project_name = EXCLUDED.project_name,
      acceptance_criteria = EXCLUDED.acceptance_criteria,
      user_stories = EXCLUDED.user_stories,
      data_requirements = EXCLUDED.data_requirements,
      navigation_needs = EXCLUDED.navigation_needs,
      design_constraints = EXCLUDED.design_constraints,
      updated_at = NOW()
    RETURNING *
  `;

  const result = await pool.query<UIRequirement>(query, [
    requirement.epic_id,
    requirement.project_name,
    JSON.stringify(requirement.acceptance_criteria),
    JSON.stringify(requirement.user_stories),
    JSON.stringify(requirement.data_requirements),
    JSON.stringify(requirement.navigation_needs),
    requirement.design_constraints ? JSON.stringify(requirement.design_constraints) : null,
  ]);

  return result.rows[0];
}

/**
 * Get UI requirements by epic ID
 *
 * @param epicId - Epic identifier
 * @returns UI requirement or null if not found
 */
export async function getUIRequirementsByEpicId(epicId: string): Promise<UIRequirement | null> {
  const query = 'SELECT * FROM ui_requirements WHERE epic_id = $1';
  const result = await pool.query<UIRequirement>(query, [epicId]);
  return result.rows[0] || null;
}

/**
 * Get UI requirements by project name
 *
 * @param projectName - Project name
 * @returns Array of UI requirements
 */
export async function getUIRequirementsByProject(projectName: string): Promise<UIRequirement[]> {
  const query = 'SELECT * FROM ui_requirements WHERE project_name = $1 ORDER BY created_at DESC';
  const result = await pool.query<UIRequirement>(query, [projectName]);
  return result.rows;
}

/**
 * Delete UI requirements by epic ID
 *
 * @param epicId - Epic identifier
 * @returns True if deleted, false if not found
 */
export async function deleteUIRequirements(epicId: string): Promise<boolean> {
  const query = 'DELETE FROM ui_requirements WHERE epic_id = $1 RETURNING id';
  const result = await pool.query(query, [epicId]);
  return result.rowCount !== null && result.rowCount > 0;
}

// ============================================================================
// UI Mockups (Epic UI-003)
// ============================================================================

/**
 * Create or update a UI mockup
 *
 * @param mockup - UI mockup data
 * @returns Created/updated mockup
 */
export async function upsertUIMockup(mockup: {
  epic_id: string;
  project_name: string;
  design_method: DesignMethod;
  design_url?: string | null;
  design_data?: DesignData | null;
  dev_port?: number | null;
  dev_url?: string | null;
  status?: MockupStatus;
  frame0_page_id?: string | null;
  frame0_design_export?: string | null;
  component_mapping?: ComponentMapping | null;
}): Promise<UIMockup> {
  const query = `
    INSERT INTO ui_mockups (
      epic_id,
      project_name,
      design_method,
      design_url,
      design_data,
      dev_port,
      dev_url,
      status,
      frame0_page_id,
      frame0_design_export,
      component_mapping
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (epic_id)
    DO UPDATE SET
      project_name = EXCLUDED.project_name,
      design_method = EXCLUDED.design_method,
      design_url = EXCLUDED.design_url,
      design_data = EXCLUDED.design_data,
      dev_port = EXCLUDED.dev_port,
      dev_url = EXCLUDED.dev_url,
      status = EXCLUDED.status,
      frame0_page_id = EXCLUDED.frame0_page_id,
      frame0_design_export = EXCLUDED.frame0_design_export,
      component_mapping = EXCLUDED.component_mapping,
      updated_at = NOW()
    RETURNING *
  `;

  const result = await pool.query<UIMockup>(query, [
    mockup.epic_id,
    mockup.project_name,
    mockup.design_method,
    mockup.design_url || null,
    mockup.design_data ? JSON.stringify(mockup.design_data) : null,
    mockup.dev_port || null,
    mockup.dev_url || null,
    mockup.status || 'draft',
    mockup.frame0_page_id || null,
    mockup.frame0_design_export || null,
    mockup.component_mapping ? JSON.stringify(mockup.component_mapping) : null,
  ]);

  return result.rows[0];
}

/**
 * Get UI mockup by epic ID
 *
 * @param epicId - Epic identifier
 * @returns UI mockup or null if not found
 */
export async function getUIMockupByEpicId(epicId: string): Promise<UIMockup | null> {
  const query = 'SELECT * FROM ui_mockups WHERE epic_id = $1';
  const result = await pool.query<UIMockup>(query, [epicId]);
  return result.rows[0] || null;
}

/**
 * Get UI mockups by project name
 *
 * @param projectName - Project name
 * @returns Array of UI mockups
 */
export async function getUIMockupsByProject(projectName: string): Promise<UIMockup[]> {
  const query = 'SELECT * FROM ui_mockups WHERE project_name = $1 ORDER BY created_at DESC';
  const result = await pool.query<UIMockup>(query, [projectName]);
  return result.rows;
}

/**
 * Get UI mockups by design method
 *
 * @param designMethod - Design method ('frame0' or 'figma')
 * @returns Array of UI mockups
 */
export async function getUIMockupsByMethod(designMethod: DesignMethod): Promise<UIMockup[]> {
  const query = 'SELECT * FROM ui_mockups WHERE design_method = $1 ORDER BY created_at DESC';
  const result = await pool.query<UIMockup>(query, [designMethod]);
  return result.rows;
}

/**
 * Get UI mockups by status
 *
 * @param status - Mockup status
 * @returns Array of UI mockups
 */
export async function getUIMockupsByStatus(status: MockupStatus): Promise<UIMockup[]> {
  const query = 'SELECT * FROM ui_mockups WHERE status = $1 ORDER BY created_at DESC';
  const result = await pool.query<UIMockup>(query, [status]);
  return result.rows;
}

/**
 * Update UI mockup status
 *
 * @param epicId - Epic identifier
 * @param status - New status
 * @returns Updated mockup or null if not found
 */
export async function updateUIMockupStatus(epicId: string, status: MockupStatus): Promise<UIMockup | null> {
  const query = 'UPDATE ui_mockups SET status = $1, updated_at = NOW() WHERE epic_id = $2 RETURNING *';
  const result = await pool.query<UIMockup>(query, [status, epicId]);
  return result.rows[0] || null;
}

/**
 * Delete UI mockup by epic ID
 *
 * @param epicId - Epic identifier
 * @returns True if deleted, false if not found
 */
export async function deleteUIMockup(epicId: string): Promise<boolean> {
  const query = 'DELETE FROM ui_mockups WHERE epic_id = $1 RETURNING id';
  const result = await pool.query(query, [epicId]);
  return result.rowCount !== null && result.rowCount > 0;
}
