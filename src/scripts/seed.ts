#!/usr/bin/env tsx
/**
 * Seed script for development database
 * Populates database with sample data for testing
 */

import { pool, testConnection } from '../db/client.js';
import {
  createProject,
  createEpic,
  createIssue,
  createTask,
} from '../db/queries.js';

async function seedProjects() {
  console.log('Seeding projects...');

  const projects = [
    {
      name: 'consilio',
      path: '/home/samuel/sv/consilio',
      description: 'AI-powered consulting assistant',
      status: 'active' as const,
    },
    {
      name: 'odin',
      path: '/home/samuel/sv/odin',
      description: 'System monitoring and observability platform',
      status: 'active' as const,
    },
    {
      name: 'openhorizon',
      path: '/home/samuel/sv/openhorizon',
      description: 'Open source horizon scanning tool',
      status: 'active' as const,
    },
    {
      name: 'health-agent',
      path: '/home/samuel/sv/health-agent',
      description: 'Personal health tracking and analytics',
      status: 'active' as const,
    },
  ];

  const createdProjects = [];
  for (const project of projects) {
    try {
      const created = await createProject(project);
      console.log(`  ✓ Created project: ${created.name}`);
      createdProjects.push(created);
    } catch (error) {
      console.error(`  ✗ Failed to create project ${project.name}:`, error);
    }
  }

  return createdProjects;
}

async function seedPortRanges() {
  console.log('Seeding port ranges...');

  // Project-specific port ranges (100 ports each)
  const ranges = [
    {
      range_name: 'meta-supervisor',
      start_port: 3000,
      end_port: 3099,
      description: 'Meta-supervisor infrastructure services',
    },
    {
      range_name: 'consilio',
      start_port: 3100,
      end_port: 3199,
      description: 'Consilio project services',
    },
    {
      range_name: 'openhorizon',
      start_port: 3200,
      end_port: 3299,
      description: 'OpenHorizon project services',
    },
    {
      range_name: 'odin',
      start_port: 3300,
      end_port: 3399,
      description: 'Odin project services',
    },
    {
      range_name: 'health-agent',
      start_port: 3400,
      end_port: 3499,
      description: 'Health-Agent project services',
    },
    {
      range_name: 'quiculum-monitor',
      start_port: 3500,
      end_port: 3599,
      description: 'Quiculum Monitor project services',
    },
    {
      range_name: 'shared-services',
      start_port: 9000,
      end_port: 9999,
      description: 'Shared services (Penpot, Storybook, etc.)',
    },
  ];

  for (const range of ranges) {
    try {
      await pool.query(
        `INSERT INTO port_ranges (range_name, start_port, end_port, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (range_name) DO NOTHING`,
        [range.range_name, range.start_port, range.end_port, range.description]
      );
      console.log(`  ✓ Created port range: ${range.range_name} (${range.start_port}-${range.end_port})`);
    } catch (error) {
      console.error(`  ✗ Failed to create port range ${range.range_name}:`, error);
    }
  }
}

async function seedEpics(projectId: string) {
  console.log('Seeding epics...');

  const epics = [
    {
      project_id: projectId,
      epic_id: 'EPIC-001',
      title: 'Database Foundation',
      description: 'Set up PostgreSQL database schema for all supervisor-service features',
      status: 'completed' as const,
      priority: 'high' as const,
      estimated_hours: 4,
      complexity: 'simple' as const,
    },
    {
      project_id: projectId,
      epic_id: 'EPIC-002',
      title: 'MCP Server Implementation',
      description: 'Implement core MCP server with tool endpoints',
      status: 'in_progress' as const,
      priority: 'high' as const,
      estimated_hours: 8,
      complexity: 'moderate' as const,
      dependencies: ['EPIC-001'],
    },
    {
      project_id: projectId,
      epic_id: 'EPIC-003',
      title: 'Secrets Management',
      description: 'Encrypted secrets storage and rotation system',
      status: 'planned' as const,
      priority: 'high' as const,
      estimated_hours: 6,
      complexity: 'moderate' as const,
      dependencies: ['EPIC-001'],
    },
  ];

  const createdEpics = [];
  for (const epic of epics) {
    try {
      const created = await createEpic(epic);
      console.log(`  ✓ Created epic: ${created.epic_id}`);
      createdEpics.push(created);
    } catch (error) {
      console.error(`  ✗ Failed to create epic ${epic.epic_id}:`, error);
    }
  }

  return createdEpics;
}

async function seedIssues(projectId: string, epicId: string) {
  console.log('Seeding issues...');

  const issues = [
    {
      project_id: projectId,
      epic_id: epicId,
      title: 'Set up PostgreSQL database',
      description: 'Install and configure PostgreSQL with required extensions',
      status: 'closed' as const,
      priority: 'high' as const,
      labels: ['database', 'infrastructure'],
    },
    {
      project_id: projectId,
      epic_id: epicId,
      title: 'Create migration system',
      description: 'Configure node-pg-migrate and create initial migrations',
      status: 'closed' as const,
      priority: 'high' as const,
      labels: ['database', 'migrations'],
    },
    {
      project_id: projectId,
      epic_id: epicId,
      title: 'Implement database client',
      description: 'Create TypeScript database client with connection pooling',
      status: 'in_progress' as const,
      priority: 'medium' as const,
      labels: ['database', 'typescript'],
    },
  ];

  const createdIssues = [];
  for (const issue of issues) {
    try {
      const created = await createIssue(issue);
      console.log(`  ✓ Created issue #${created.issue_number}: ${created.title}`);
      createdIssues.push(created);
    } catch (error) {
      console.error(`  ✗ Failed to create issue:`, error);
    }
  }

  return createdIssues;
}

async function seedTasks(projectId: string, issueId: string) {
  console.log('Seeding tasks...');

  const tasks = [
    {
      project_id: projectId,
      issue_id: issueId,
      title: 'Create database client class',
      description: 'Implement database client with connection pooling',
      status: 'completed' as const,
      order_index: 1,
      estimated_minutes: 30,
      actual_minutes: 25,
    },
    {
      project_id: projectId,
      issue_id: issueId,
      title: 'Add query helper functions',
      description: 'Create common query functions for CRUD operations',
      status: 'in_progress' as const,
      order_index: 2,
      estimated_minutes: 45,
    },
    {
      project_id: projectId,
      issue_id: issueId,
      title: 'Write unit tests',
      description: 'Add tests for database client and queries',
      status: 'pending' as const,
      order_index: 3,
      estimated_minutes: 60,
    },
  ];

  for (const task of tasks) {
    try {
      const created = await createTask(task);
      console.log(`  ✓ Created task: ${created.title}`);
    } catch (error) {
      console.error(`  ✗ Failed to create task:`, error);
    }
  }
}

async function seedEstimationFactors() {
  console.log('Seeding estimation factors...');

  const factors = [
    {
      factor_name: 'new_technology',
      description: 'Working with unfamiliar technology or framework',
      impact_type: 'multiplier',
      average_impact: 1.5,
    },
    {
      factor_name: 'technical_debt',
      description: 'Dealing with existing technical debt',
      impact_type: 'multiplier',
      average_impact: 1.3,
    },
    {
      factor_name: 'dependencies',
      description: 'Number of external dependencies',
      impact_type: 'additive',
      average_impact: 15,
    },
    {
      factor_name: 'team_size',
      description: 'Size of the team working on the task',
      impact_type: 'percentage',
      average_impact: -10,
    },
  ];

  for (const factor of factors) {
    try {
      await pool.query(
        `INSERT INTO estimation_factors (factor_name, description, impact_type, average_impact)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (factor_name) DO NOTHING`,
        [factor.factor_name, factor.description, factor.impact_type, factor.average_impact]
      );
      console.log(`  ✓ Created estimation factor: ${factor.factor_name}`);
    } catch (error) {
      console.error(`  ✗ Failed to create factor ${factor.factor_name}:`, error);
    }
  }
}

async function seedSecretTemplates() {
  console.log('Seeding secret templates...');

  const templates = [
    {
      template_name: 'github_token',
      secret_type: 'token',
      description: 'GitHub personal access token',
      validation_pattern: '^ghp_[a-zA-Z0-9]{36}$',
      rotation_interval_days: 90,
    },
    {
      template_name: 'api_key',
      secret_type: 'api_key',
      description: 'Generic API key',
      validation_pattern: '^[a-zA-Z0-9_-]{32,}$',
      rotation_interval_days: 180,
    },
    {
      template_name: 'database_password',
      secret_type: 'password',
      description: 'Database password',
      validation_pattern: null,
      rotation_interval_days: 30,
    },
  ];

  for (const template of templates) {
    try {
      await pool.query(
        `INSERT INTO secret_templates (template_name, secret_type, description, validation_pattern, rotation_interval_days)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (template_name) DO NOTHING`,
        [
          template.template_name,
          template.secret_type,
          template.description,
          template.validation_pattern,
          template.rotation_interval_days,
        ]
      );
      console.log(`  ✓ Created secret template: ${template.template_name}`);
    } catch (error) {
      console.error(`  ✗ Failed to create template ${template.template_name}:`, error);
    }
  }
}

async function main() {
  console.log('🌱 Starting database seed...\n');

  try {
    // Test connection
    await testConnection();
    console.log();

    // Seed data
    const projects = await seedProjects();
    console.log();

    await seedPortRanges();
    console.log();

    await seedEstimationFactors();
    console.log();

    await seedSecretTemplates();
    console.log();

    // Seed epics, issues, and tasks for first project if available
    if (projects.length > 0) {
      const project = projects[0];
      const epics = await seedEpics(project.id);
      console.log();

      if (epics.length > 0) {
        const epic = epics[0];
        const issues = await seedIssues(project.id, epic.id);
        console.log();

        if (issues.length > 0) {
          const issue = issues[0];
          await seedTasks(project.id, issue.id);
          console.log();
        }
      }
    }

    console.log('✅ Database seeding completed successfully!\n');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
