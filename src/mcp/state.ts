/**
 * In-memory server state management
 */

import { ServerState, Tool } from '../types/index.js';

// Global server state
let serverState: ServerState = {
  startTime: new Date(),
  requestCount: 0,
  errorCount: 0,
  tools: new Map<string, Tool>(),
};

export function getState(): ServerState {
  return serverState;
}

export function incrementRequestCount(): void {
  serverState.requestCount++;
}

export function incrementErrorCount(): void {
  serverState.errorCount++;
}

export function registerTool(tool: Tool): void {
  serverState.tools.set(tool.name, tool);
}

export function getTool(name: string): Tool | undefined {
  return serverState.tools.get(name);
}

export function getAllTools(): Tool[] {
  return Array.from(serverState.tools.values());
}

export function resetState(): void {
  serverState = {
    startTime: new Date(),
    requestCount: 0,
    errorCount: 0,
    tools: new Map<string, Tool>(),
  };
}

export function getUptime(): number {
  return Date.now() - serverState.startTime.getTime();
}
