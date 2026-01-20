# Supervisor Workflow

## Standard Operating Procedure

### When Starting Work

1. **Check Context**: Understand what service/component is being modified
2. **Review State**: Check database, running services, recent changes
3. **Plan Changes**: Outline steps before implementing
4. **Document**: Update relevant documentation

### When Making Changes

1. **Test Locally**: Verify changes work before committing
2. **Update Schema**: If database changes, create migrations
3. **Version Bump**: Update package.json if API changes
4. **Documentation**: Update README, API docs, or ADRs as needed

### When Completing Work

1. **Verify**: Run tests, check services still work
2. **Commit & Push**: Clear commit messages, push to remote
3. **Update Status**: Mark tasks/issues complete
4. **Handoff**: Document any pending work or blockers

## Git Workflow (PS Responsibility)

**YOU are responsible for all git operations. This is NOT the user's job.**

### When to Commit

**Commit immediately after:**
- Completing a feature or bug fix
- Updating documentation (deployment configs, README, etc.)
- Regenerating CLAUDE.md files
- Creating or updating epics
- Configuration changes (ports, tunnels, environment)

### Commit Message Format

```bash
# Good commit messages
git commit -m "feat: add JWT authentication to API"
git commit -m "docs: update deployment config with tunnel consilio.153.se"
git commit -m "fix: resolve port conflict on backend service"
git commit -m "chore: regenerate CLAUDE.md with tunnel info"
```

### When to Push

**Push immediately after committing** (unless working on feature branch):
```bash
git add .
git commit -m "descriptive message"
git push origin main  # or current branch
```

### Branch Strategy

**Main branch (simple projects):**
- Commit directly to main for documentation updates
- Push immediately

**Feature branches (complex work):**
- Create branch: `git checkout -b feature/authentication`
- Commit frequently
- Push branch: `git push origin feature/authentication`
- Create PR when complete
- Merge after review (or auto-merge if user approves)

### When to Create PRs

**Always create PR for:**
- New features (>50 lines changed)
- Breaking changes
- Major refactors
- Multi-file changes affecting core logic

**Direct commit to main for:**
- Documentation updates
- CLAUDE.md regeneration
- Config file tweaks
- Minor fixes (<10 lines)

### Auto-Merge Strategy

**If user says "continue building" or "keep going autonomously":**
- You have permission to merge PRs automatically
- Verify tests pass first
- Use `gh pr merge --auto --squash` (or --merge)
- Continue to next task

**If user says "create PR":**
- Create PR and wait for manual review
- Do NOT merge automatically

## Common Operations

### Database Migrations

```bash
npm run migrate:create <migration-name>
# Edit migration in migrations/
npm run migrate:up
```

### Service Management

```bash
npm run dev      # Development with hot reload
npm run build    # Production build
npm run start    # Run production build
```

### Testing

```bash
npm test         # Run test suite
npm run lint     # Check code quality
```

## Decision Framework

**When Uncertain**:
1. Check existing patterns in codebase
2. Review relevant ADRs in /home/samuel/sv/docs/adr/
3. Consult epic specifications in /home/samuel/sv/.bmad/epics/
4. Ask user for clarification if still unclear
