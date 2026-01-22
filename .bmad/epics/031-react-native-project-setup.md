# Epic: React Native Project Setup

**Epic ID:** 031
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** Mobile App Development Platform

## Business Context

Foundation for mobile projects - enable PSs to scaffold React Native or Flutter projects with .bmad structure, proper dependencies, and database tracking.

## Requirements

**MUST HAVE:**
- [ ] MCP tool: mobile_create_project({ project_name, framework: "react-native" | "flutter" })
- [ ] Scaffold React Native project with Expo or React Native CLI
- [ ] Create .bmad/ structure (epics, adr, workflow-status.yaml)
- [ ] Port allocation (mobile projects get own range)
- [ ] Database table: mobile_projects (track framework, bundle IDs, status)
- [ ] Generate CLAUDE.md for mobile PS
- [ ] Initialize git repository

**SHOULD HAVE:**
- [ ] TypeScript configuration
- [ ] ESLint + Prettier setup
- [ ] Basic navigation structure (React Navigation)
- [ ] Folder structure (src/components, src/screens, src/services)

## Database Schema

```sql
CREATE TABLE mobile_projects (
  id SERIAL PRIMARY KEY,
  project_name TEXT NOT NULL UNIQUE,
  framework TEXT NOT NULL, -- 'react-native' | 'flutter'
  android_package_id TEXT, -- com.company.app
  ios_bundle_id TEXT, -- com.company.app
  created_at TIMESTAMP DEFAULT NOW(),
  last_build TIMESTAMP,
  status TEXT DEFAULT 'active' -- 'active' | 'archived'
);
```

## Implementation Tasks

- [ ] Create templates/mobile/react-native/ scaffold
- [ ] Create templates/mobile/flutter/ scaffold
- [ ] MobileProjectManager.createProject()
- [ ] Database migration: 031-create-mobile-projects.sql
- [ ] MCP tool: mobile_create_project
- [ ] Git init + initial commit

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] mobile_create_project scaffolds React Native project
- [ ] .bmad/ structure created with standard files
- [ ] mobile_projects table tracks project
- [ ] Bundle IDs generated (com.[company].[project])
- [ ] CLAUDE.md generated for mobile PS
- [ ] Git repository initialized

## Dependencies

**Blocked By:** None (foundational)
**Blocks:** All other mobile epics (032-039)
