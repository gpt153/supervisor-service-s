/**
 * Session Continuity System - All Modules (Epics 007-A through 007-F)
 * Exports instance registry, heartbeat management, command logging, footer rendering,
 * PS bootstrap, and all supporting services
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

// Epic 007-D: Checkpoint System
export {
  CheckpointManager,
  getCheckpointManager,
  resetCheckpointManager,
  CheckpointNotFoundError,
  CheckpointInstanceNotFoundError,
  CheckpointError,
} from './CheckpointManager.js';

export {
  WorkStateSerializer,
  getWorkStateSerializer,
  resetWorkStateSerializer,
} from './WorkStateSerializer.js';

export {
  ResumeInstructionGenerator,
  getResumeInstructionGenerator,
  resetResumeInstructionGenerator,
} from './ResumeInstructionGenerator.js';

// Epic 007-F: PS Integration
export {
  renderFooter,
  renderFooterWithSeparator,
  getResumeHint,
  formatFooterComplete,
  parseInstanceIdFromFooter,
  isValidFooterFormat,
  FOOTER_EXAMPLES,
  type FooterConfig,
} from './FooterRenderer.js';

export {
  PSBootstrap,
  createPSBootstrap,
  INTEGRATION_EXAMPLE,
  type PSSessionState,
} from './PSBootstrap.js';

// Re-export types
export * from '../types/session.js';
export * from '../types/command-log.js';
export * from '../types/event-store.js';
export * from '../types/checkpoint.js';
