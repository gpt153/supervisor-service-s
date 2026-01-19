/**
 * Project configuration and type definitions
 */

export interface ProjectConfig {
  name: string;
  displayName: string;
  path: string;
  description: string;
  endpoints: string[];
  tools: string[];
  enabled: boolean;
}

export interface ProjectsConfig {
  [projectName: string]: ProjectConfig;
}

export interface ProjectContext {
  project: ProjectConfig;
  workingDirectory: string;
  isolatedState: Map<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  handler: (params: any, context: ProjectContext) => Promise<any>;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPEndpoint {
  path: string;
  projectName: string;
  tools: ToolDefinition[];
  context: ProjectContext;
}
