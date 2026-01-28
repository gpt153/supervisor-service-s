/**
 * Session Continuity System - All Modules (Epics 007-A, 007-B)
 * Exports instance registry, heartbeat management, command logging, and sanitization services
 */

// Epic 007-A: Instance Registry
export {
  registerInstance,
  updateHeartbeat,
  listInstances,
  getInstanceDetails,
  getPrefixMatches,
  markInstanceClosed,
  calculateInstanceAge,
  isInstanceStale,
  DuplicateInstanceError,
  InstanceNotFoundError,
} from './InstanceRegistry.js';

export {
  generateInstanceId,
  validateInstanceId,
  parseInstanceId,
} from './InstanceIdGenerator.js';

export {
  sendHeartbeat,
  sendHeartbeatAsync,
  checkStaleness,
  getStaleTimeout,
  formatStalenessMessage,
} from './HeartbeatManager.js';

// Epic 007-B: Command Logging
export {
  CommandLogger,
  getCommandLogger,
  resetCommandLogger,
} from './CommandLogger.js';

export {
  SanitizationService,
  getSanitizationService,
  resetSanitizationService,
} from './SanitizationService.js';

export {
  ToolCallLogger,
  getToolCallLogger,
  resetToolCallLogger,
  createToolCallLoggingMiddleware,
} from './ToolCallLogger.js';

// Epic 007-C: Event Store
export {
  emitEvent,
  queryEvents,
  replayEvents,
  aggregateEventsByType,
  getLatestEvents,
  getEventById,
  getEventCount,
  deleteEventsForInstance,
  InvalidEventError,
  InstanceNotFoundForEventError,
  EventStoreError,
} from './EventStore.js';

// Re-export types
export * from '../types/session.js';
export * from '../types/command-log.js';
export * from '../types/event-store.js';
