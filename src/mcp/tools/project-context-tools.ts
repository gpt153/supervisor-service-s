/**
 * MCP Tools for Project Context Management
 *
 * These tools analyze projects and generate rich context for CLAUDE.md
 */

import { ToolDefinition, ProjectContext } from '../../types/project.js';
import { readFile, readdir, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { InstructionAssembler } from '../../instructions/InstructionAssembler.js';

const execAsync = promisify(exec);

interface ProjectAnalysis {
  projectName: string;
  projectPath: string;
  techStack: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    deployment: string[];
  };
  epicStatus: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    epics: Array<{
      id: string;
      title: string;
      status: 'completed' | 'in-progress' | 'not-started';
    }>;
  };
  recentActivity: {
    lastCommit: string;
    lastCommitDate: string;
    recentCommits: string[];
  };
  structure: {
    hasBackend: boolean;
    hasFrontend: boolean;
    hasTests: boolean;
    hasDocs: boolean;
  };
  dependencies: {
    runtime: string[];
    dev: string[];
  };
  currentState: {
    deploymentStatus: string;
    knownIssues: string[];
    nextPriorities: string[];
  };
}

/**
 * Refresh project context - Analyze project and update .supervisor-specific/
 */
export const refreshProjectContextTool: ToolDefinition = {
  name: 'mcp__meta__refresh_project_context',
  description:
    'Analyze a project and refresh its context in .supervisor-specific/01-project.md. This should be run after planning sessions, epic completions, or major updates.',
  inputSchema: {
    type: 'object',
    properties: {
      projectName: {
        type: 'string',
        description: 'Name of the project (e.g., "consilio-s", "odin-s")',
      },
      regenerateClaude: {
        type: 'boolean',
        description: 'Regenerate CLAUDE.md after updating context (default: true)',
        default: true,
      },
    },
    required: ['projectName'],
  },
  handler: async (params, context: ProjectContext) => {
    const { projectName, regenerateClaude = true } = params;

    try {
      const projectPath = join('/home/samuel/sv', projectName);

      // Verify project exists
      if (!existsSync(projectPath)) {
        return {
          success: false,
          error: `Project directory (PD) not found: ${projectPath}`,
        };
      }

      console.log(`[Context Refresh] Analyzing ${projectName}...`);

      // Analyze the project
      const analysis = await analyzeProject(projectName, projectPath);

      // Generate rich context document
      const contextDoc = generateContextDocument(analysis);

      // Write to .supervisor-specific/
      const supervisorSpecificDir = join(projectPath, '.supervisor-specific');
      await mkdir(supervisorSpecificDir, { recursive: true });

      const contextFile = join(supervisorSpecificDir, '01-project.md');
      await writeFile(contextFile, contextDoc, 'utf-8');

      console.log(`[Context Refresh] Updated ${contextFile}`);

      let regenerated = false;
      if (regenerateClaude) {
        const claudeMdPath = join(projectPath, 'CLAUDE.md');
        const assembler = new InstructionAssembler(projectPath);
        await assembler.assembleAndWrite(claudeMdPath, {
          preserveProjectSpecific: true,
          includeMetadata: true,
        });
        regenerated = true;
        console.log(`[Context Refresh] Regenerated CLAUDE.md`);
      }

      return {
        success: true,
        projectName,
        projectPath,
        contextFile,
        analysis: {
          epics: analysis.epicStatus,
          techStack: analysis.techStack,
          recentActivity: analysis.recentActivity,
        },
        regenerated,
        message: `Project context refreshed for ${projectName}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Refresh all projects' context
 */
export const refreshAllProjectsContextTool: ToolDefinition = {
  name: 'mcp__meta__refresh_all_projects_context',
  description: 'Refresh context for all projects in the SV system',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  handler: async (params, context: ProjectContext) => {
    const svRoot = '/home/samuel/sv';
    const excludedDirs = [
      'supervisor-service',
      '.claude',
      'templates',
      'docs',
      '.bmad',
      'node_modules',
      '.git',
      'mcp-configs',
      'scripts',
    ];

    try {
      const entries = await readdir(svRoot);
      const results: Array<{
        project: string;
        success: boolean;
        message?: string;
      }> = [];

      for (const entry of entries) {
        if (excludedDirs.includes(entry)) continue;

        const fullPath = join(svRoot, entry);
        const stats = await stat(fullPath);
        if (!stats.isDirectory()) continue;

        // Check if it has CLAUDE.md (is a project)
        if (!existsSync(join(fullPath, 'CLAUDE.md'))) {
          results.push({
            project: entry,
            success: false,
            message: 'No CLAUDE.md found, skipped',
          });
          continue;
        }

        try {
          const analysis = await analyzeProject(entry, fullPath);
          const contextDoc = generateContextDocument(analysis);

          const supervisorSpecificDir = join(fullPath, '.supervisor-specific');
          await mkdir(supervisorSpecificDir, { recursive: true });

          const contextFile = join(supervisorSpecificDir, '01-project.md');
          await writeFile(contextFile, contextDoc, 'utf-8');

          // Regenerate CLAUDE.md
          const claudeMdPath = join(fullPath, 'CLAUDE.md');
          const assembler = new InstructionAssembler(fullPath);
          await assembler.assembleAndWrite(claudeMdPath, {
            preserveProjectSpecific: true,
            includeMetadata: true,
          });

          results.push({
            project: entry,
            success: true,
            message: 'Context refreshed and CLAUDE.md regenerated',
          });
        } catch (error) {
          results.push({
            project: entry,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      return {
        success: true,
        totalProjects: results.length,
        successCount,
        failCount,
        results,
        message: `Refreshed context for ${successCount} projects (${failCount} failed/skipped)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
};

/**
 * Analyze a project and extract context
 */
async function analyzeProject(
  projectName: string,
  projectPath: string
): Promise<ProjectAnalysis> {
  const analysis: ProjectAnalysis = {
    projectName,
    projectPath,
    techStack: {
      languages: [],
      frameworks: [],
      databases: [],
      deployment: [],
    },
    epicStatus: {
      total: 0,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      epics: [],
    },
    recentActivity: {
      lastCommit: '',
      lastCommitDate: '',
      recentCommits: [],
    },
    structure: {
      hasBackend: false,
      hasFrontend: false,
      hasTests: false,
      hasDocs: false,
    },
    dependencies: {
      runtime: [],
      dev: [],
    },
    currentState: {
      deploymentStatus: 'unknown',
      knownIssues: [],
      nextPriorities: [],
    },
  };

  // Analyze tech stack
  await analyzeTechStack(projectPath, analysis);

  // Analyze epics
  await analyzeEpics(projectPath, analysis);

  // Analyze git activity
  await analyzeGitActivity(projectPath, analysis);

  // Analyze structure
  await analyzeStructure(projectPath, analysis);

  // Analyze workflow status
  await analyzeWorkflowStatus(projectPath, analysis);

  return analysis;
}

/**
 * Analyze tech stack from package.json, requirements.txt, etc.
 */
async function analyzeTechStack(
  projectPath: string,
  analysis: ProjectAnalysis
): Promise<void> {
  // Check for Node.js project
  const packageJsonPath = join(projectPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    analysis.techStack.languages.push('TypeScript', 'JavaScript');

    // Extract frameworks
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['next']) analysis.techStack.frameworks.push('Next.js');
    if (deps['react']) analysis.techStack.frameworks.push('React');
    if (deps['express']) analysis.techStack.frameworks.push('Express');
    if (deps['fastify']) analysis.techStack.frameworks.push('Fastify');
    if (deps['vue']) analysis.techStack.frameworks.push('Vue');

    // Extract databases
    if (deps['pg'] || deps['postgres']) analysis.techStack.databases.push('PostgreSQL');
    if (deps['mysql'] || deps['mysql2']) analysis.techStack.databases.push('MySQL');
    if (deps['mongodb']) analysis.techStack.databases.push('MongoDB');
    if (deps['redis']) analysis.techStack.databases.push('Redis');

    // Store dependencies
    if (pkg.dependencies) {
      analysis.dependencies.runtime = Object.keys(pkg.dependencies).slice(0, 10);
    }
    if (pkg.devDependencies) {
      analysis.dependencies.dev = Object.keys(pkg.devDependencies).slice(0, 10);
    }
  }

  // Check for Python project
  const requirementsPath = join(projectPath, 'requirements.txt');
  if (existsSync(requirementsPath)) {
    const content = await readFile(requirementsPath, 'utf-8');
    analysis.techStack.languages.push('Python');

    if (content.includes('fastapi')) analysis.techStack.frameworks.push('FastAPI');
    if (content.includes('flask')) analysis.techStack.frameworks.push('Flask');
    if (content.includes('django')) analysis.techStack.frameworks.push('Django');
    if (content.includes('sqlalchemy')) analysis.techStack.databases.push('PostgreSQL (SQLAlchemy)');
    if (content.includes('telegram')) analysis.techStack.frameworks.push('python-telegram-bot');

    // Store top dependencies
    const deps = content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .map(line => line.split('==')[0].trim())
      .slice(0, 10);
    analysis.dependencies.runtime = deps;
  }

  // Check for deployment configs
  if (existsSync(join(projectPath, 'Dockerfile'))) {
    analysis.techStack.deployment.push('Docker');
  }
  if (existsSync(join(projectPath, 'docker-compose.yml'))) {
    analysis.techStack.deployment.push('Docker Compose');
  }
  if (existsSync(join(projectPath, 'cloudbuild.yaml'))) {
    analysis.techStack.deployment.push('Google Cloud Build');
  }
}

/**
 * Analyze epics from .bmad/epics/
 */
async function analyzeEpics(projectPath: string, analysis: ProjectAnalysis): Promise<void> {
  const epicsDir = join(projectPath, '.bmad', 'epics');
  if (!existsSync(epicsDir)) return;

  const files = await readdir(epicsDir);
  const epicFiles = files.filter(f => f.startsWith('epic-') && f.endsWith('.md'));

  for (const file of epicFiles) {
    const content = await readFile(join(epicsDir, file), 'utf-8');
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1] : file;

    // Determine status (rough heuristic)
    let status: 'completed' | 'in-progress' | 'not-started' = 'not-started';
    if (content.includes('COMPLETE') || content.includes('✅')) {
      status = 'completed';
    } else if (content.includes('IN PROGRESS') || content.includes('🚧')) {
      status = 'in-progress';
    }

    analysis.epicStatus.epics.push({
      id: file.replace('.md', ''),
      title,
      status,
    });

    if (status === 'completed') analysis.epicStatus.completed++;
    else if (status === 'in-progress') analysis.epicStatus.inProgress++;
    else analysis.epicStatus.notStarted++;
  }

  analysis.epicStatus.total = epicFiles.length;
}

/**
 * Analyze git activity
 */
async function analyzeGitActivity(
  projectPath: string,
  analysis: ProjectAnalysis
): Promise<void> {
  try {
    // Get last commit
    const { stdout: lastCommit } = await execAsync(
      'git log -1 --pretty=format:"%s (%ar)"',
      { cwd: projectPath }
    );
    analysis.recentActivity.lastCommit = lastCommit.trim();

    // Get last commit date
    const { stdout: lastDate } = await execAsync('git log -1 --pretty=format:"%ai"', {
      cwd: projectPath,
    });
    analysis.recentActivity.lastCommitDate = lastDate.trim();

    // Get recent commits (last 5)
    const { stdout: recentCommits } = await execAsync(
      'git log -5 --pretty=format:"%s (%ar)"',
      { cwd: projectPath }
    );
    analysis.recentActivity.recentCommits = recentCommits.split('\n').filter(Boolean);
  } catch (error) {
    // Not a git repo or no commits
    analysis.recentActivity.lastCommit = 'No git history';
  }
}

/**
 * Analyze project structure
 */
async function analyzeStructure(
  projectPath: string,
  analysis: ProjectAnalysis
): Promise<void> {
  analysis.structure.hasBackend =
    existsSync(join(projectPath, 'backend')) ||
    existsSync(join(projectPath, 'src')) ||
    existsSync(join(projectPath, 'server'));

  analysis.structure.hasFrontend =
    existsSync(join(projectPath, 'frontend')) ||
    existsSync(join(projectPath, 'app')) ||
    existsSync(join(projectPath, 'pages'));

  analysis.structure.hasTests =
    existsSync(join(projectPath, 'tests')) ||
    existsSync(join(projectPath, 'test')) ||
    existsSync(join(projectPath, '__tests__'));

  analysis.structure.hasDocs =
    existsSync(join(projectPath, 'docs')) || existsSync(join(projectPath, 'documentation'));
}

/**
 * Analyze workflow status
 */
async function analyzeWorkflowStatus(
  projectPath: string,
  analysis: ProjectAnalysis
): Promise<void> {
  const workflowPath = join(projectPath, '.bmad', 'workflow-status.yaml');
  if (!existsSync(workflowPath)) return;

  try {
    const content = await readFile(workflowPath, 'utf-8');

    // Extract priorities (simple parsing)
    const prioritiesMatch = content.match(/priorities:\s*\n((?:\s+-\s+.+\n?)+)/);
    if (prioritiesMatch) {
      const priorities = prioritiesMatch[1]
        .split('\n')
        .filter(Boolean)
        .map(line => line.replace(/^\s*-\s*/, '').trim());
      analysis.currentState.nextPriorities = priorities.slice(0, 5);
    }

    // Extract deployment status
    if (content.includes('deployed: true') || content.includes('status: deployed')) {
      analysis.currentState.deploymentStatus = 'deployed';
    } else if (content.includes('status: development')) {
      analysis.currentState.deploymentStatus = 'in development';
    }
  } catch (error) {
    // Ignore parsing errors
  }
}

/**
 * Generate rich context document
 */
function generateContextDocument(analysis: ProjectAnalysis): string {
  const { projectName, techStack, epicStatus, recentActivity, structure, currentState } =
    analysis;

  return `# Project-Specific Context

**Project**: ${projectName}
**Last Updated**: ${new Date().toISOString().split('T')[0]}

---

## Current Status

**Deployment**: ${currentState.deploymentStatus}

**Epic Progress**:
- Total Epics: ${epicStatus.total}
- Completed: ${epicStatus.completed}
- In Progress: ${epicStatus.inProgress}
- Not Started: ${epicStatus.notStarted}

${epicStatus.epics.length > 0 ? `**Recent Epics**:\n${epicStatus.epics.slice(0, 5).map(epic => `- ${epic.status === 'completed' ? '✅' : epic.status === 'in-progress' ? '🚧' : '📋'} ${epic.id}: ${epic.title}`).join('\n')}` : ''}

---

## Technology Stack

**Languages**: ${techStack.languages.join(', ') || 'Not detected'}

**Frameworks**: ${techStack.frameworks.join(', ') || 'None detected'}

**Databases**: ${techStack.databases.join(', ') || 'None detected'}

**Deployment**: ${techStack.deployment.join(', ') || 'Not configured'}

---

## Project Structure

${structure.hasBackend ? '✅ Backend: Present' : '❌ Backend: Not found'}
${structure.hasFrontend ? '✅ Frontend: Present' : '❌ Frontend: Not found'}
${structure.hasTests ? '✅ Tests: Present' : '❌ Tests: Not found'}
${structure.hasDocs ? '✅ Documentation: Present' : '❌ Documentation: Not found'}

---

## Recent Activity

**Last Commit**: ${recentActivity.lastCommit}
**Date**: ${recentActivity.lastCommitDate}

${recentActivity.recentCommits.length > 0 ? `**Recent Commits**:\n${recentActivity.recentCommits.map(c => `- ${c}`).join('\n')}` : ''}

---

## Next Priorities

${currentState.nextPriorities.length > 0 ? currentState.nextPriorities.map((p, i) => `${i + 1}. ${p}`).join('\n') : 'No priorities defined in workflow-status.yaml'}

---

## Working with This Project

### Project Directory (PD)
\`\`\`
${analysis.projectPath}
\`\`\`

### Planning Artifacts
- Epics: \`.bmad/epics/\`
- ADRs: \`.bmad/adr/\`
- Architecture: \`.bmad/architecture/\`

### Key Commands
${techStack.languages.includes('TypeScript') || techStack.languages.includes('JavaScript') ? `\`\`\`bash
npm install              # Install dependencies
npm run dev              # Development server
npm test                 # Run tests
npm run build            # Production build
\`\`\`` : ''}
${techStack.languages.includes('Python') ? `\`\`\`bash
pip install -r requirements.txt    # Install dependencies
pytest                             # Run tests
\`\`\`` : ''}

---

## Supervisor Notes

This project is supervised by the **project-supervisor (PS)** for ${projectName}.

When working in a **supervisor session in browser (SSB)** or **supervisor session in CLI (SSC)**:
- Use \`mcp__meta__start_piv_loop\` to implement epics autonomously
- Check epic status before starting new work
- Update workflow-status.yaml after completing epics
- Run \`mcp__meta__refresh_project_context\` after major updates

---

**Auto-generated by meta-supervisor (MS)**
**Refresh with**: \`mcp__meta__refresh_project_context\`
`;
}

/**
 * Get all project context tools
 */
export function getProjectContextTools(): ToolDefinition[] {
  return [refreshProjectContextTool, refreshAllProjectsContextTool];
}
