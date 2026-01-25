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

**When to commit**: After completing feature, updating docs, regenerating CLAUDE.md, config changes

**Commit format**: `type: description` (feat/fix/docs/chore)

**When to push**: Immediately after commit (unless on feature branch)

**When to create PR**: New features (>50 lines), breaking changes, major refactors

**When to direct commit**: Docs, CLAUDE.md, config tweaks, minor fixes (<10 lines)

**Auto-merge**: If user says "continue building", merge PRs automatically after tests pass

**Full workflow guide**: `/home/samuel/sv/docs/guides/ps-workflows.md`

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
