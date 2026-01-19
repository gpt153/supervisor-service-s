/**
 * Codebase analysis utilities for Prime phase
 * Detects tech stack, conventions, and patterns
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  CodebaseStructure,
  NamingConventions,
  DependencyInfo,
  IntegrationPoint,
} from '../types/piv.js';

export class CodebaseAnalyzer {
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Analyze the codebase structure
   */
  async analyzeStructure(): Promise<CodebaseStructure> {
    const packageJson = await this.readPackageJson();

    const structure: CodebaseStructure = {
      techStack: [],
      packageManager: await this.detectPackageManager(),
      frameworks: [],
      languages: [],
      testingFramework: undefined,
      buildSystem: undefined,
    };

    // Detect languages
    const hasTypeScript = await this.fileExists('tsconfig.json');
    const hasJavaScript = packageJson !== null;
    if (hasTypeScript) {
      structure.languages.push('TypeScript');
      structure.techStack.push('TypeScript');
    }
    if (hasJavaScript) {
      structure.languages.push('JavaScript');
      if (!hasTypeScript) {
        structure.techStack.push('JavaScript');
      }
    }

    // Detect frameworks
    if (packageJson?.dependencies || packageJson?.devDependencies) {
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Framework detection
      if (allDeps['react']) {
        structure.frameworks.push('React');
        structure.techStack.push('React');
      }
      if (allDeps['vue']) {
        structure.frameworks.push('Vue');
        structure.techStack.push('Vue');
      }
      if (allDeps['express']) {
        structure.frameworks.push('Express');
        structure.techStack.push('Express');
      }
      if (allDeps['next']) {
        structure.frameworks.push('Next.js');
        structure.techStack.push('Next.js');
      }
      if (allDeps['@nestjs/core']) {
        structure.frameworks.push('NestJS');
        structure.techStack.push('NestJS');
      }

      // Testing framework detection
      if (allDeps['jest']) {
        structure.testingFramework = 'Jest';
      } else if (allDeps['vitest']) {
        structure.testingFramework = 'Vitest';
      } else if (allDeps['mocha']) {
        structure.testingFramework = 'Mocha';
      }

      // Build system detection
      if (allDeps['webpack']) {
        structure.buildSystem = 'Webpack';
      } else if (allDeps['vite']) {
        structure.buildSystem = 'Vite';
      } else if (allDeps['rollup']) {
        structure.buildSystem = 'Rollup';
      } else if (allDeps['esbuild']) {
        structure.buildSystem = 'esbuild';
      }
    }

    return structure;
  }

  /**
   * Find naming conventions used in the codebase
   */
  async findConventions(): Promise<NamingConventions> {
    const conventions: NamingConventions = {
      fileNaming: 'unknown',
      classNaming: 'PascalCase',
      functionNaming: 'camelCase',
      constantNaming: 'SCREAMING_SNAKE_CASE',
    };

    try {
      // Sample files from src directory
      const srcPath = path.join(this.workingDirectory, 'src');
      const files = await this.listFiles(srcPath, 10);

      // Analyze file naming patterns
      const kebabCase = files.filter((f) => /^[a-z]+(-[a-z]+)*\.(ts|js|tsx|jsx)$/.test(path.basename(f)));
      const camelCase = files.filter((f) => /^[a-z][a-zA-Z]*\.(ts|js|tsx|jsx)$/.test(path.basename(f)));
      const pascalCase = files.filter((f) => /^[A-Z][a-zA-Z]*\.(ts|js|tsx|jsx)$/.test(path.basename(f)));

      if (kebabCase.length > camelCase.length && kebabCase.length > pascalCase.length) {
        conventions.fileNaming = 'kebab-case';
      } else if (camelCase.length > pascalCase.length) {
        conventions.fileNaming = 'camelCase';
      } else if (pascalCase.length > 0) {
        conventions.fileNaming = 'PascalCase';
      }

      // Check for React component naming
      const hasReactComponents = files.some((f) => f.endsWith('.tsx') || f.endsWith('.jsx'));
      if (hasReactComponents) {
        conventions.componentNaming = 'PascalCase';
      }
    } catch (error) {
      // If src directory doesn't exist or can't be read, use defaults
    }

    return conventions;
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies(): Promise<DependencyInfo[]> {
    const packageJson = await this.readPackageJson();
    if (!packageJson) {
      return [];
    }

    const dependencies: DependencyInfo[] = [];

    // Regular dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'dependency',
          purpose: this.guessDependencyPurpose(name),
        });
      }
    }

    // Dev dependencies
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'devDependency',
          purpose: this.guessDependencyPurpose(name),
        });
      }
    }

    return dependencies;
  }

  /**
   * Find integration points in the codebase
   */
  async findIntegrationPoints(): Promise<IntegrationPoint[]> {
    const integrationPoints: IntegrationPoint[] = [];

    try {
      // Look for API endpoints
      const apiFiles = await this.findFilesByPattern('**/api/**/*.{ts,js}');
      if (apiFiles.length > 0) {
        integrationPoints.push({
          name: 'API Endpoints',
          type: 'api',
          description: 'REST API endpoints for external communication',
          files: apiFiles.slice(0, 5), // Limit to first 5
        });
      }

      // Look for database connections
      const dbFiles = await this.findFilesByPattern('**/{db,database,models}/**/*.{ts,js}');
      if (dbFiles.length > 0) {
        integrationPoints.push({
          name: 'Database Layer',
          type: 'database',
          description: 'Database models and connection management',
          files: dbFiles.slice(0, 5),
        });
      }

      // Look for service integrations
      const serviceFiles = await this.findFilesByPattern('**/services/**/*.{ts,js}');
      if (serviceFiles.length > 0) {
        integrationPoints.push({
          name: 'Service Layer',
          type: 'service',
          description: 'Business logic and service integrations',
          files: serviceFiles.slice(0, 5),
        });
      }
    } catch (error) {
      // If pattern matching fails, return empty array
    }

    return integrationPoints;
  }

  /**
   * Helper: Read package.json
   */
  private async readPackageJson(): Promise<any | null> {
    try {
      const packagePath = path.join(this.workingDirectory, 'package.json');
      const content = await fs.readFile(packagePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.workingDirectory, filepath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Detect package manager
   */
  private async detectPackageManager(): Promise<string> {
    if (await this.fileExists('pnpm-lock.yaml')) return 'pnpm';
    if (await this.fileExists('yarn.lock')) return 'yarn';
    if (await this.fileExists('package-lock.json')) return 'npm';
    return 'npm'; // default
  }

  /**
   * Helper: List files in directory (limited)
   */
  private async listFiles(dir: string, limit: number = 10): Promise<string[]> {
    try {
      const files: string[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= limit) break;

        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.listFiles(fullPath, limit - files.length);
          files.push(...subFiles);
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper: Find files by glob pattern (simplified)
   */
  private async findFilesByPattern(pattern: string): Promise<string[]> {
    // Simplified implementation - in production, use a proper glob library
    // For now, just check common patterns
    const files: string[] = [];

    try {
      const srcPath = path.join(this.workingDirectory, 'src');
      await this.scanDirectory(srcPath, pattern, files);
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return files;
  }

  /**
   * Helper: Recursively scan directory for pattern
   */
  private async scanDirectory(dir: string, pattern: string, results: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, pattern, results);
        } else if (entry.isFile()) {
          // Simple pattern matching - check if path contains pattern keywords
          const patternKeywords = pattern.match(/\{([^}]+)\}/)?.[1]?.split(',') || [];
          const pathSegments = pattern.split('/').filter((s) => s !== '**');

          const matchesPattern =
            pathSegments.some((seg) => fullPath.includes(seg.replace('*', ''))) ||
            patternKeywords.some((ext) => fullPath.endsWith(ext.trim()));

          if (matchesPattern) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  /**
   * Helper: Guess dependency purpose from name
   */
  private guessDependencyPurpose(name: string): string | undefined {
    const purposeMap: Record<string, string> = {
      react: 'UI framework',
      vue: 'UI framework',
      express: 'Web server framework',
      '@nestjs/core': 'Backend framework',
      typescript: 'Type-safe JavaScript',
      jest: 'Testing framework',
      vitest: 'Testing framework',
      eslint: 'Code linting',
      prettier: 'Code formatting',
      pg: 'PostgreSQL client',
      mysql: 'MySQL client',
      mongodb: 'MongoDB client',
      axios: 'HTTP client',
      dotenv: 'Environment configuration',
    };

    return purposeMap[name];
  }
}
