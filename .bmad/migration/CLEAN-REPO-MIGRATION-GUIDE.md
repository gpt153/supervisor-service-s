# Clean Supervised Repository Migration Guide

**Purpose**: Create clean implementation-only repositories from SV projects, separating code from planning artifacts.

**Generated**: 2026-01-18

---

## Overview

This guide documents the process of creating "supervised" versions of all SV projects that contain only implementation code, tests, configuration, and documentation—without any planning artifacts.

### Goals

1. **Separation of Concerns**: Keep implementation code separate from planning documents
2. **Clean GitHub Repos**: Push production-ready code to GitHub
3. **Maintainability**: Easier for contributors to understand project structure
4. **Supervisor Integration**: Each clean repo has its own CLAUDE.md for supervisor support

### Architecture

```
/home/samuel/sv/
├── consilio/                 # Original (code + planning)
├── consilio-s/              # Clean supervised version (code only)
├── odin/                    # Original (code + planning)
├── odin-s/                  # Clean supervised version (code only)
├── openhorizon/             # Original (code + planning)
├── openhorizon-s/           # Clean supervised version (code only)
├── health-agent/            # Original (code + planning)
├── health-agent-s/          # Clean supervised version (code only)
└── scripts/
    ├── create-clean-repos.sh      # Migration script
    ├── validate-clean-repos.sh    # Validation script
    └── README.md                  # Scripts documentation
```

---

## Quick Start

### 1. Dry Run (Recommended First)

See what would be copied without making changes:

```bash
cd /home/samuel/sv
./scripts/create-clean-repos.sh --dry-run
```

Review the output to understand what will be included/excluded.

### 2. Run Migration

Process all projects:

```bash
./scripts/create-clean-repos.sh
```

Or process a single project:

```bash
./scripts/create-clean-repos.sh --project consilio
```

### 3. Validate Results

Check that clean repositories are valid:

```bash
./scripts/validate-clean-repos.sh
```

### 4. Review Migration Report

```bash
cat scripts/migration-report-*.md
```

### 5. Push to GitHub

For each project:

```bash
cd /home/samuel/sv/consilio-s
gh repo create consilio-s --public --source=. --remote=origin
git push -u origin main
```

---

## What Gets Migrated

### ✅ Included (Implementation)

**Source Code:**
- `src/`, `app/`, `lib/`
- `frontend/`, `backend/`
- `landing/`, `project-pipeline/`

**Tests:**
- `tests/`, `test/`, `__tests__/`
- `load_tests/`

**Configuration:**
- `package.json`, `package-lock.json`
- `tsconfig.json`
- `pyproject.toml`, `requirements.txt`, `uv.lock`
- `pytest.ini`
- `.eslintrc.json`
- `.coveragerc`

**Infrastructure:**
- `.github/workflows/` (CI/CD)
- `Dockerfile`, `Dockerfile.test`
- `docker-compose.yml`, `docker-compose.*.yml`
- `cloudbuild*.yaml`
- `env-*.yaml`

**Database:**
- `migrations/`
- `alembic/`
- `setup.sql`
- `alembic.ini`

**Documentation:**
- `README.md`
- `CHANGELOG.md`
- `DEPLOYMENT.md`
- `DOCUMENTATION.md`
- `ARCHITECTURE.md`
- `QUICKSTART.md`
- `docs/` (project documentation)

**Environment:**
- `.env.example`
- `.env.production.example`
- `.env.test.example`

**Scripts:**
- `scripts/` (utility scripts)
- `*.sh` files (shell scripts)

**Other:**
- `.gitignore`
- `.dockerignore`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `next.config.ts`
- `playwright.config.ts`
- `public/` (static assets)
- `examples/`
- `observability/`

### ❌ Excluded (Planning Artifacts)

**Planning Directories:**
- `.bmad/` - BMAD planning system
- `.agents/` - Agent artifacts
- `.claude/` - Command templates
- `.scar/` - SCAR artifacts
- `.plans/` - Planning documents
- `.archive/` - Archived content
- `.auth/` - Auth artifacts
- `.docs/` - Meta documentation
- `.playwright-mcp/` - MCP artifacts
- `.supervisor-specific/` - Regenerated per project

**Planning Documents:**
- `*_PLAN.md`
- `*_IMPLEMENTATION_*.md`
- `PLAN.md`, `PLAN_*.md`
- `IMPLEMENTATION_*.md`
- `*_SUMMARY.md`
- `*_REPORT.md`
- `HANDOFF*.md`
- `PRD.md`, `PRD_*.md`
- `RCA_*.md`, `RCA-*.md`
- `VERIFICATION_CHECKLIST.md`
- `SESSION_*.md`
- `PROGRESS.md`
- `ERROR_ANALYSIS.md`

**Epic/Issue Documents:**
- `EPIC_*.md`, `EPIC-*.md`
- `ISSUE_*.md`, `ISSUE-*.md`
- `PHASE*_*.md`
- `SPRINT_*.md`

**Research Documents:**
- `*-research.md`
- `*-analysis.md`
- `*-design.md`
- `*-plan.md`
- `*-implementation-plan.md`
- `*-feasibility-analysis.md`

**Other Planning:**
- `VISION_*.md`
- `WORK_SUMMARY.md`
- `COMPLETE*.md`
- `STATUS_*.md`
- `SMOKE_TEST_*.md`
- `VISUAL_SUMMARY.md`
- `SECURITY_AUDIT*.md`
- `BACKUP_RECOVERY_PLAN.md`
- `INDEX.md`
- `START-HERE.md`
- Various implementation/monitoring plans

**Logs and Temporary:**
- `*.log`
- `bot.log`, `bot_debug.log`
- `deployment-test-results.txt`

**Build Artifacts:**
- `.git/` (not copied)
- `node_modules/`
- `__pycache__/`
- `*.pyc`
- `.pytest_cache/`
- `dist/`, `build/`
- `.next/`
- `coverage/`

---

## Generated CLAUDE.md

Each clean repository gets a new `CLAUDE.md` file that provides supervisor context.

### Structure

The CLAUDE.md is assembled from:

1. **Core Instructions** (from `supervisor-service/.supervisor-core/`)
   - `01-identity.md` - Supervisor identity and role
   - `02-workflow.md` - Standard operating procedures
   - `03-structure.md` - Directory organization
   - `04-tools.md` - Available tools and commands

2. **Project-Specific Instructions** (generated in `.supervisor-specific/`)
   - `01-project.md` - Project-specific context
     - Technology stack
     - Key directories
     - Development commands
     - Important notes

### Example CLAUDE.md Structure

```markdown
<!-- AUTO-GENERATED CLAUDE.md -->
<!-- Sources listed here -->
<!-- Generated: 2026-01-18T... -->

# Supervisor Identity

You are a **Project Supervisor** in the SV supervisor system.

## Your Role
[Core supervisor role description]

# Supervisor Workflow

## Standard Operating Procedure
[Workflow guidelines]

# Project Structure

## Directory Organization
[Project-specific structure]

# Project-Specific Instructions

## Project: consilio

This is a **clean supervised repository** containing only implementation code.

### Technology Stack
- Frontend: Next.js, React, TypeScript
- Backend: Node.js, Express, PostgreSQL
- Testing: Jest, Playwright

### Key Directories
[Project directories]

### Development Commands
[Dev commands]
```

---

## Migration Script Details

### Script: `create-clean-repos.sh`

**Features:**
- ✅ Dry run mode for safe testing
- ✅ Single project or all projects
- ✅ Detailed migration report
- ✅ Auto-generated CLAUDE.md
- ✅ Git repository initialization
- ✅ Color-coded output
- ✅ Error handling

**Process:**

1. **Analysis Phase**
   - Scans each project directory
   - Calculates sizes and file counts
   - Identifies planning artifacts

2. **Migration Phase**
   - Uses `rsync` with exclude patterns
   - Copies only implementation files
   - Preserves directory structure

3. **CLAUDE.md Generation**
   - Creates `.supervisor-specific/` directory
   - Generates project-specific instructions
   - Calls InstructionAssembler (with fallback)

4. **Git Initialization**
   - Initializes git repository
   - Creates initial commit
   - Provides push instructions

5. **Report Generation**
   - Creates detailed markdown report
   - Includes statistics and next steps
   - Git commands for GitHub push

### Script: `validate-clean-repos.sh`

**Validation Checks:**
- ✅ No planning artifact directories (`.bmad/`, `.agents/`, etc.)
- ✅ No planning markdown files (`*_PLAN.md`, etc.)
- ✅ CLAUDE.md exists and is auto-generated
- ✅ `.supervisor-specific/` directory exists
- ✅ Git repository initialized
- ✅ Required files present (README.md, etc.)

**Usage:**

```bash
# Validate all projects
./scripts/validate-clean-repos.sh

# Validate single project
./scripts/validate-clean-repos.sh --project consilio-s
```

---

## Migration Report

After running the migration, a detailed report is generated at:

```
/home/samuel/sv/scripts/migration-report-YYYYMMDD-HHMMSS.md
```

### Report Contents

1. **Executive Summary**
   - Purpose and goals
   - Date and projects processed

2. **Analysis Phase**
   - Per-project statistics:
     - Total size
     - Total files
     - Implementation files
     - Planning files

3. **Migration Phase**
   - Per-project migration results:
     - Files copied
     - Target directory size
     - Status (completed/dry-run)

4. **Git Instructions**
   - Per-project commands to:
     - Create GitHub repository
     - Add remote
     - Push to GitHub

5. **Summary**
   - Next steps
   - Validation checklist

---

## Post-Migration Steps

### 1. Verify Clean Repositories

```bash
# List all clean repos
ls -la /home/samuel/sv/*-s/

# Check sizes
du -sh /home/samuel/sv/*-s/

# Verify no planning artifacts
./scripts/validate-clean-repos.sh
```

### 2. Review CLAUDE.md Files

```bash
# Check each CLAUDE.md
cat /home/samuel/sv/consilio-s/CLAUDE.md
cat /home/samuel/sv/odin-s/CLAUDE.md
cat /home/samuel/sv/openhorizon-s/CLAUDE.md
cat /home/samuel/sv/health-agent-s/CLAUDE.md
```

### 3. Test Local Development

For each project, verify it works:

**Consilio:**
```bash
cd /home/samuel/sv/consilio-s
npm install
docker-compose up -d
npm run dev
npm test
```

**Odin:**
```bash
cd /home/samuel/sv/odin-s
pip install -r requirements.txt
alembic upgrade head
pytest
```

**OpenHorizon:**
```bash
cd /home/samuel/sv/openhorizon-s
npm install
npm run build
npm test
```

**Health Agent:**
```bash
cd /home/samuel/sv/health-agent-s
pip install -r requirements.txt
./run_migrations.sh
pytest
```

### 4. Create GitHub Repositories

For each project:

```bash
# Using gh CLI (recommended)
cd /home/samuel/sv/consilio-s
gh repo create consilio-s --public --source=. --remote=origin
git push -u origin main

# Or manually via GitHub web interface, then:
git remote add origin git@github.com:YOUR_USERNAME/consilio-s.git
git branch -M main
git push -u origin main
```

### 5. Configure GitHub Settings

For each repository:

1. **Add Description and Topics**
   - Consilio: "Case management system for konsulenter"
   - Odin: "Anthropic MCP server for Obsidian"
   - OpenHorizon: "Multi-agent LLM project pipeline system"
   - Health Agent: "Telegram health coaching bot"

2. **Set Up Branch Protection** (optional)
   - Require PR reviews
   - Require status checks
   - Protect main branch

3. **Configure Secrets** (if using CI/CD)
   - Database credentials
   - API keys
   - Deployment tokens

4. **Enable Issues/Projects** (optional)

### 6. Update Documentation

In each repository:

1. **Update README.md**
   - Add GitHub repository link
   - Update any references to old paths
   - Verify setup instructions work

2. **Create CONTRIBUTING.md** (optional)
   - Development workflow
   - Code standards
   - PR process

3. **Add LICENSE** (if not present)

### 7. Set Up CI/CD

Review and update `.github/workflows/` if present:

- Update secrets references
- Verify deployment targets
- Test workflow execution

---

## Troubleshooting

### CLAUDE.md Generation Fails

**Symptom**: Script can't generate CLAUDE.md via InstructionAssembler

**Solution**:
```bash
# Ensure supervisor-service is built
cd /home/samuel/sv/supervisor-service
npm install
npm run build

# Verify Node.js version
node --version  # Should be v20+

# Script falls back to basic CLAUDE.md automatically
```

### Missing Files in Clean Repo

**Symptom**: Expected files are missing from clean repository

**Solution**:
1. Check exclude patterns in `create-clean-repos.sh`
2. Review migration report for details
3. Use `--dry-run` to preview before copying
4. Manually copy specific files if needed

### Permission Errors

**Symptom**: Permission denied errors during migration

**Solution**:
```bash
# Ensure script is executable
chmod +x /home/samuel/sv/scripts/create-clean-repos.sh

# Check directory permissions
ls -la /home/samuel/sv/

# Ensure you own the directories
sudo chown -R $USER:$USER /home/samuel/sv/
```

### Git Push Fails

**Symptom**: Cannot push to GitHub

**Solution**:
```bash
# Check git configuration
git config --global user.name
git config --global user.email

# Set up SSH key if needed
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub  # Add to GitHub

# Or use HTTPS with token
gh auth login
```

### Validation Fails

**Symptom**: `validate-clean-repos.sh` reports errors

**Solution**:
1. Review validation output
2. Check for remaining planning artifacts
3. Verify CLAUDE.md was generated
4. Re-run migration for specific project:
   ```bash
   ./scripts/create-clean-repos.sh --project consilio
   ```

---

## Maintenance

### Updating Core Instructions

When core instructions change in `supervisor-service/.supervisor-core/`:

1. **Rebuild supervisor-service**:
   ```bash
   cd /home/samuel/sv/supervisor-service
   npm run build
   ```

2. **Regenerate CLAUDE.md files**:
   ```bash
   cd /home/samuel/sv/consilio-s
   node -e "
   import { InstructionAssembler } from '../supervisor-service/dist/instructions/InstructionAssembler.js';
   const assembler = new InstructionAssembler(process.cwd());
   await assembler.assembleAndWrite('./CLAUDE.md', {
     preserveProjectSpecific: true,
     includeMetadata: true
   });
   "
   ```

3. **Commit and push changes**:
   ```bash
   git add CLAUDE.md
   git commit -m "Update CLAUDE.md with latest core instructions"
   git push
   ```

### Syncing Implementation Changes

To sync new implementation code from original to clean repo:

```bash
# Example: Consilio
cd /home/samuel/sv
./scripts/create-clean-repos.sh --project consilio

# Review changes
cd consilio-s
git status
git diff

# Commit and push
git add .
git commit -m "Sync implementation changes from consilio"
git push
```

### Periodic Validation

Regularly validate clean repositories:

```bash
# Weekly validation
./scripts/validate-clean-repos.sh > validation-report-$(date +%Y%m%d).txt
```

---

## Best Practices

### 1. Keep Original and Clean Repos Separate

- **Original** (`consilio/`, `odin/`, etc.): Work here for development
- **Clean** (`consilio-s/`, `odin-s/`, etc.): Read-only, sync from original

### 2. Sync Regularly

Sync clean repos from originals at regular intervals:
- After major features
- Before releases
- Weekly (if active development)

### 3. Document Changes

Always document why implementation code changed:
- Clear commit messages
- Update CHANGELOG.md
- Reference issues/PRs

### 4. Validate Before Push

Always validate before pushing to GitHub:
```bash
./scripts/validate-clean-repos.sh --project consilio-s
```

### 5. Use Branches for Updates

When syncing from original:
```bash
cd /home/samuel/sv/consilio-s
git checkout -b sync-$(date +%Y%m%d)
# Sync changes
git push -u origin sync-$(date +%Y%m%d)
# Create PR on GitHub
```

---

## FAQ

### Q: Why separate repositories?

**A**: Clean repositories are easier for contributors to understand and maintain. Planning artifacts are kept separate in the SV system.

### Q: Can I develop in the clean repos?

**A**: It's recommended to develop in the original repos and sync to clean repos. This keeps planning and implementation together during development.

### Q: How often should I sync?

**A**: Sync after major changes, before releases, or weekly if actively developing.

### Q: What if I need to update CLAUDE.md?

**A**: Update `.supervisor-specific/*.md` files, then regenerate CLAUDE.md using InstructionAssembler.

### Q: Can I customize exclude patterns?

**A**: Yes, edit the `get_exclude_patterns()` function in `create-clean-repos.sh`.

### Q: What about the .git directory?

**A**: Each clean repo gets its own fresh git repository with a new history.

---

## References

- **Script Documentation**: `/home/samuel/sv/scripts/README.md`
- **InstructionAssembler**: `/home/samuel/sv/supervisor-service/src/instructions/InstructionAssembler.ts`
- **Core Instructions**: `/home/samuel/sv/supervisor-service/.supervisor-core/`
- **Migration Reports**: `/home/samuel/sv/scripts/migration-report-*.md`

---

## Summary

This migration creates clean, production-ready repositories from SV projects:

1. **Run migration script**: `./scripts/create-clean-repos.sh`
2. **Validate results**: `./scripts/validate-clean-repos.sh`
3. **Review report**: `cat scripts/migration-report-*.md`
4. **Push to GitHub**: Use provided git commands
5. **Maintain**: Sync regularly from original repos

The clean repositories are ready to be shared, collaborated on, and deployed without any planning artifacts cluttering the codebase.
