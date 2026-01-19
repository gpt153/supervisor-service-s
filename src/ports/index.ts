/**
 * Port Allocation System
 *
 * Exports:
 * - PortManager: Core port allocation class
 * - Port tools: MCP tool definitions
 * - Port types: TypeScript types
 */

export { PortManager } from './PortManager.js';
export { getPortTools } from './port-tools.js';
export type {
  PortAllocation,
  PortRange,
  PortSummary,
  AuditResult,
} from './PortManager.js';
