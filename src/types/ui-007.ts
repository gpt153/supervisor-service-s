/**
 * Type definitions for Dev Environment Deployment (Epic UI-007)
 *
 * This module defines types for deploying interactive UI mockups to dev environments
 * with hot reload, path-based routing, and mock data.
 */

import { Timestamps } from './database.js';
import type { UIMockup } from './ui-003.js';

// ============================================================================
// Deployment Configuration Types
// ============================================================================

/**
 * Framework for dev environment
 */
export type DevFramework = 'vite' | 'nextjs';

/**
 * Dev environment deployment status
 */
export type DeploymentStatus = 'pending' | 'building' | 'running' | 'stopped' | 'failed';

/**
 * Dev environment deployment record
 */
export interface DevDeployment extends Timestamps {
  id: number;
  epic_id: string;
  project_name: string;
  framework: DevFramework;
  port: number;
  base_path: string; // e.g., "/consilio/dev"
  dev_url: string; // Full URL: https://ui.153.se/consilio/dev
  process_id: number | null;
  status: DeploymentStatus;
  build_output: string | null;
  error_message: string | null;
  hot_reload_enabled: boolean;
  mock_data_injected: boolean;
}

/**
 * Vite configuration for dev server
 */
export interface ViteConfig {
  port: number;
  basePath: string;
  proxyTarget?: string; // For API proxy
  https?: {
    cert: string;
    key: string;
  };
  hmr?: {
    protocol: 'wss' | 'ws';
    host: string;
    port: number;
    path: string;
  };
}

/**
 * Next.js configuration for dev server
 */
export interface NextConfig {
  port: number;
  basePath: string;
  assetPrefix?: string;
  rewrites?: NextRewrite[];
}

/**
 * Next.js rewrite rule
 */
export interface NextRewrite {
  source: string;
  destination: string;
}

/**
 * Nginx configuration for path-based routing
 */
export interface NginxConfig {
  projectName: string;
  basePath: string;
  port: number;
  ssl: boolean;
  proxyPass: string;
  websocketSupport: boolean;
}

// ============================================================================
// MCP Tool Parameter Types
// ============================================================================

/**
 * Parameters for ui_deploy_mockup MCP tool
 */
export interface DeployMockupParams {
  epicId: string;
  framework?: DevFramework; // Default: vite
  port?: number; // Auto-allocated if not provided
  hotReload?: boolean; // Default: true
  mockDataInjection?: boolean; // Default: true
  basePath?: string; // Default: /[project]/dev
}

/**
 * Result of ui_deploy_mockup MCP tool
 */
export interface DeployMockupResult {
  success: boolean;
  deployment?: DevDeployment;
  devUrl?: string;
  previewUrls?: PreviewUrl[];
  buildLog?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Parameters for ui_get_preview_urls MCP tool
 */
export interface GetPreviewUrlsParams {
  epicId?: string;
  projectName?: string;
  status?: DeploymentStatus;
}

/**
 * Result of ui_get_preview_urls MCP tool
 */
export interface GetPreviewUrlsResult {
  success: boolean;
  deployments?: PreviewDeployment[];
  error?: string;
}

/**
 * Preview deployment info
 */
export interface PreviewDeployment {
  epicId: string;
  projectName: string;
  framework: DevFramework;
  devUrl: string;
  status: DeploymentStatus;
  previewUrls: PreviewUrl[];
  lastUpdated: string;
}

/**
 * Preview URL for a specific page/route
 */
export interface PreviewUrl {
  path: string;
  fullUrl: string;
  description: string;
  acceptanceCriteria?: string[];
}

// ============================================================================
// Template Types
// ============================================================================

/**
 * Template variables for Vite config
 */
export interface ViteTemplateVars {
  port: number;
  basePath: string;
  projectName: string;
  epicId: string;
  hmrPort: number;
  proxyTarget?: string;
}

/**
 * Template variables for Next.js config
 */
export interface NextTemplateVars {
  port: number;
  basePath: string;
  projectName: string;
  epicId: string;
  assetPrefix: string;
}

/**
 * Template variables for package.json
 */
export interface PackageJsonVars {
  projectName: string;
  epicId: string;
  framework: DevFramework;
  devPort: number;
}

/**
 * Template variables for index.html (Vite)
 */
export interface IndexHtmlVars {
  title: string;
  basePath: string;
  epicId: string;
}

// ============================================================================
// Component Generation Types
// ============================================================================

/**
 * React component code generation result
 */
export interface ComponentCodeGenResult {
  success: boolean;
  files: GeneratedFile[];
  entryPoint: string; // Path to main App.tsx
  error?: string;
}

/**
 * Generated file
 */
export interface GeneratedFile {
  path: string;
  content: string;
  type: 'component' | 'style' | 'config' | 'data' | 'route';
}

/**
 * Mock data injection config
 */
export interface MockDataInjectionConfig {
  dataFiles: string[]; // Paths to mock data JSON files
  apiEndpoints: MockApiEndpoint[];
  stateInitialization: Record<string, any>;
}

/**
 * Mock API endpoint
 */
export interface MockApiEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  mockDataKey: string; // Key in mock data object
  delay?: number; // Simulate network delay (ms)
}

// ============================================================================
// Process Management Types
// ============================================================================

/**
 * Dev server process info
 */
export interface DevServerProcess {
  pid: number;
  port: number;
  epicId: string;
  framework: DevFramework;
  startTime: Date;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
  memoryUsage?: number; // MB
  cpuUsage?: number; // Percentage
}

/**
 * Process management result
 */
export interface ProcessResult {
  success: boolean;
  process?: DevServerProcess;
  output?: string;
  error?: string;
}

// ============================================================================
// Hot Reload Types
// ============================================================================

/**
 * Hot reload configuration
 */
export interface HotReloadConfig {
  enabled: boolean;
  protocol: 'wss' | 'ws';
  host: string;
  port: number;
  path: string;
  timeout: number;
  overlay: boolean; // Show error overlay
}

/**
 * File watcher configuration
 */
export interface FileWatcherConfig {
  paths: string[];
  ignored: string[];
  debounce: number; // ms
}

// ============================================================================
// Deployment Strategy Types
// ============================================================================

/**
 * Deployment strategy
 */
export interface DeploymentStrategy {
  framework: DevFramework;
  portAllocation: PortAllocationStrategy;
  pathRouting: PathRoutingStrategy;
  hotReload: HotReloadConfig;
  mockData: MockDataInjectionConfig;
  buildSteps: BuildStep[];
}

/**
 * Port allocation strategy
 */
export interface PortAllocationStrategy {
  method: 'auto' | 'manual';
  range?: { start: number; end: number };
  preferredPort?: number;
}

/**
 * Path routing strategy
 */
export interface PathRoutingStrategy {
  basePath: string;
  rewriteRules: RewriteRule[];
  nginxUpdate: boolean;
}

/**
 * Rewrite rule for path-based routing
 */
export interface RewriteRule {
  from: string;
  to: string;
  type: 'exact' | 'prefix' | 'regex';
}

/**
 * Build step
 */
export interface BuildStep {
  name: string;
  command: string;
  cwd: string;
  timeout: number;
  required: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Deployment validation result
 */
export interface DeploymentValidationResult {
  valid: boolean;
  errors: DeploymentValidationError[];
  warnings: DeploymentValidationWarning[];
  metrics: DeploymentMetrics;
}

/**
 * Deployment validation error
 */
export interface DeploymentValidationError {
  type: 'port_conflict' | 'path_conflict' | 'missing_dependency' | 'build_failure' | 'config_invalid';
  message: string;
  details?: Record<string, any>;
}

/**
 * Deployment validation warning
 */
export interface DeploymentValidationWarning {
  type: 'port_recommendation' | 'performance' | 'security' | 'compatibility';
  message: string;
  recommendation?: string;
}

/**
 * Deployment metrics
 */
export interface DeploymentMetrics {
  buildTime: number; // seconds
  bundleSize: number; // bytes
  startupTime: number; // seconds
  memoryUsage: number; // MB
  portCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default Vite config
 */
export const DEFAULT_VITE_CONFIG: Partial<ViteConfig> = {
  basePath: '/',
  hmr: {
    protocol: 'wss',
    host: 'ui.153.se',
    port: 443,
    path: '/__vite_hmr',
  },
};

/**
 * Default Next.js config
 */
export const DEFAULT_NEXT_CONFIG: Partial<NextConfig> = {
  basePath: '/',
  rewrites: [],
};

/**
 * Default hot reload config
 */
export const DEFAULT_HOT_RELOAD_CONFIG: HotReloadConfig = {
  enabled: true,
  protocol: 'wss',
  host: 'ui.153.se',
  port: 443,
  path: '/__vite_hmr',
  timeout: 30000,
  overlay: true,
};

/**
 * Port range for dev deployments (within OpenHorizon range)
 */
export const DEV_PORT_RANGE = {
  start: 5260,
  end: 5279,
};

/**
 * Template paths
 */
export const TEMPLATE_PATHS = {
  vite: {
    config: 'templates/vite-config/vite.config.ts.template',
    package: 'templates/vite-config/package.json.template',
    html: 'templates/vite-config/index.html.template',
    tsconfig: 'templates/vite-config/tsconfig.json.template',
  },
  nextjs: {
    config: 'templates/nextjs-config/next.config.js.template',
    package: 'templates/nextjs-config/package.json.template',
    tsconfig: 'templates/nextjs-config/tsconfig.json.template',
  },
};
