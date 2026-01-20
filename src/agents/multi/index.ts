/**
 * Multi-Agent CLI Integration
 *
 * Export all multi-agent components for easy importing.
 */

// Core types
export * from './types.js';

// Base adapter
export { CLIAdapter } from './CLIAdapter.js';

// Specific adapters
export { ClaudeCLIAdapter } from './ClaudeCLIAdapter.js';
export { GeminiCLIAdapter } from './GeminiCLIAdapter.js';
export { CodexCLIAdapter } from './CodexCLIAdapter.js';

// Classification and routing
export { TaskClassifier, type TaskInfo } from './TaskClassifier.js';
export { QuotaManager } from './QuotaManager.js';
export { AgentRouter } from './AgentRouter.js';

// High-level executor
export { MultiAgentExecutor } from './MultiAgentExecutor.js';
