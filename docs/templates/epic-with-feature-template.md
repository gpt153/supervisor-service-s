---
parent_feature: {feature-slug}
epic_id: {NNN}
status: planning
created: {YYYY-MM-DD}
---

# Epic {NNN}: {Epic Title}

**Feature**: {Human-readable feature name}
**Epic ID**: {NNN}
**Status**: {planning|in-progress|complete}
**Created**: {YYYY-MM-DD}

---

## Quick Reference

**For migration tool:**
- `parent_feature: {feature-slug}` in frontmatter ensures correct feature grouping
- Use kebab-case slug (e.g., `user-authentication`, `gdpr-compliance`)
- Epic will be placed in `.bmad/features/{feature-slug}/epics/`

---

## Project Context

- **Project**: {project-name}
- **Repository**: {repo-url}
- **Tech Stack**: {technologies}
- **Related Epics**: {epic-NNN, epic-MMM}
- **Parent Feature**: {feature-slug}

---

## Business Context

### Problem Statement

{Describe the problem this epic solves}

### User Value

{Explain what value this delivers to users}

### Success Metrics

- {Metric 1}
- {Metric 2}
- {Metric 3}

---

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] Requirement 1
- [ ] Requirement 2

**SHOULD HAVE:**
- [ ] Requirement 3

**COULD HAVE:**
- [ ] Requirement 4

**WON'T HAVE (this iteration):**
- Requirement 5

### Non-Functional Requirements

**Performance:**
- {Performance requirements}

**Security:**
- {Security requirements}

**Maintainability:**
- {Maintainability requirements}

---

## Architecture

### Technical Approach

{Describe the technical solution}

### Integration Points

- {Integration 1}
- {Integration 2}

### Key Technical Decisions

See ADRs:
- [ADR-NNN: {Title}](./adr/ADR-NNN-{slug}.md)

---

## Implementation Notes

### Task Breakdown

1. **Task 1**: {Description}
   - Subtask 1.1
   - Subtask 1.2

2. **Task 2**: {Description}
   - Subtask 2.1
   - Subtask 2.2

3. **Task 3**: {Description}
   - Subtask 3.1

### Estimated Effort

- Task 1: {hours} hours
- Task 2: {hours} hours
- Task 3: {hours} hours
- **Total**: {total} hours

---

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Code Quality:**
- [ ] All tests pass
- [ ] Code review approved
- [ ] Documentation updated

**Documentation:**
- [ ] API documentation complete
- [ ] User guide updated
- [ ] ADRs written

---

## Dependencies

**Blocked By:**
- {Epic/Issue that must complete first}

**Blocks:**
- {Epic/Issue that depends on this}

**External Dependencies:**
- {Third-party services, APIs, etc.}

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| {Risk 1} | {High/Med/Low} | {High/Med/Low} | {How to mitigate} |
| {Risk 2} | {High/Med/Low} | {High/Med/Low} | {How to mitigate} |

---

## Testing Strategy

### Unit Tests
- {Test scenario 1}
- {Test scenario 2}

### Integration Tests
- {Integration test 1}
- {Integration test 2}

### Manual Testing Checklist
- [ ] {Manual test 1}
- [ ] {Manual test 2}

---

## Related Artifacts

**Feature Request**: [feature-request.md](./feature-request.md)

**PRD**: [prd.md](./prd.md)

**ADRs**:
- [ADR-NNN: {Title}](./adr/ADR-NNN-{slug}.md)

**Related Epics**:
- [Epic {NNN}: {Title}](../other-feature/epics/epic-{NNN}.md)

---

## Notes

### Design Decisions

**Why {decision}?**
- Reason 1
- Reason 2

### Known Limitations

- Limitation 1
- Limitation 2

### Future Enhancements

- Enhancement 1
- Enhancement 2

---

## Migration Notes

**For BMAD migration tool:**

1. **Feature Slug**: Defined in frontmatter as `parent_feature`
2. **Epic Filename**: Keep as `epic-{NNN}-{slug}.md`
3. **Target Path**: `.bmad/features/{parent_feature}/epics/epic-{NNN}-{slug}.md`
4. **Related Artifacts**: Use relative paths within feature directory

**Feature slug guidelines:**
- Use kebab-case (lowercase with hyphens)
- Be descriptive but concise
- Match across all artifacts in the feature
- Examples: `user-authentication`, `gdpr-compliance`, `notification-system`

---

**Template Version**: 1.0
**Last Updated**: 2026-01-25
**Maintained by**: Meta-Supervisor (MS)
