/**
 * Database module exports
 */

// Client and connection management
export {
  pool,
  testConnection,
  closePool,
  query,
  transaction,
} from './client.js';

// Query helpers
export {
  // Projects
  createProject,
  getProjectByName,
  getAllProjects,
  updateProjectStatus,
  // Epics
  createEpic,
  getEpicByEpicId,
  getEpicsByProject,
  updateEpicStatus,
  // Issues
  createIssue,
  getIssuesByProject,
  getIssuesByEpic,
  updateIssueStatus,
  // Tasks
  createTask,
  getTasksByIssue,
  getTasksByEpic,
  updateTaskStatus,
  // Port Allocation
  allocatePort,
  releasePort,
  getPortAllocationsByProject,
  // Health & Stats
  getServiceHealth,
  getProjectStatistics,
} from './queries.js';
