# Epic: Mock Data Generation System

**Epic ID:** UI-005
**Created:** 2026-01-22
**Status:** ✅ COMPLETE
**Completed:** 2026-01-23
**Complexity Level:** 2
**Feature:** UI-First Development Workflow
**PRD:** `/home/samuel/sv/supervisor-service-s/.bmad/prd/ui-first-workflow.md`

## Summary

Create realistic fake data generation system for UI mockups. Support hardcoded arrays, Faker.js for realistic data, and domain-specific templates (users, products, orders). Store mock data specs in database for reuse.

## Key Features

**MUST HAVE:**
- [x] Generate mock data from UI requirements (data_requirements field) ✅
- [x] Support Faker.js for realistic data (names, emails, dates, etc.) ✅
- [x] Domain templates: users, products, orders, transactions ✅
- [x] MCP tool: `ui_generate_mock_data({ epicId, count })` ✅
- [x] Store mock data specs in `ui_mockups` table ✅

**SHOULD HAVE:**
- [ ] Custom data generators per project
- [ ] Relationship support (users → orders)
- [ ] Mock data preview before use

## Architecture

```sql
ALTER TABLE ui_mockups
  ADD COLUMN mock_data_spec JSONB, -- { entities, fields, generator }
  ADD COLUMN mock_data_sample JSONB; -- Sample data for preview
```

## Estimated Effort
12 hours (1.5 days)

## Dependencies
- Epic UI-001: Requirements Analysis (need data_requirements)

## Testing
- Generate mock users (20 records)
- Generate mock products with relationships
- Verify Faker.js generates realistic data
- Test with various domains
