# Epic: Mock Data System

**Epic ID:** 026
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 2
**Feature:** UI-First Development Workflow

## Business Context

Enable interactive UI mockups to work WITHOUT backend by providing realistic mock data. Users can test complete workflows (login, CRUD operations, navigation) before backend exists.

## Requirements

**MUST HAVE:**
- [ ] Hardcoded mock data templates (users, products, orders)
- [ ] Faker.js integration for realistic random data
- [ ] Mock data generators per entity type
- [ ] Local state management (useState, context)
- [ ] JSONB spec in ui_mockups.mock_data_spec

**SHOULD HAVE:**
- [ ] Mock Service Worker (MSW) for API mocking
- [ ] CRUD operations on mock data (add/edit/delete)
- [ ] Data persistence in localStorage

**COULD HAVE:**
- [ ] Mock data from existing database (copy production data sanitized)
- [ ] GraphQL mock resolvers

## Architecture

**Layered Approach:**
1. **Simple**: Hardcoded arrays (`const users = [{ id: 1, name: "Alice" }]`)
2. **Realistic**: Faker.js (`faker.person.fullName()`)
3. **Advanced**: MSW for API responses

**Storage:** ui_mockups.mock_data_spec stores JSON schema of mock data

## Implementation Tasks

- [ ] Create templates/mock-data/ with entity templates
- [ ] Integrate Faker.js for data generation
- [ ] MockDataGenerator.generate(entity, count)
- [ ] MSW setup for /api/\* endpoints (optional)
- [ ] Store mock_data_spec in ui_mockups

**Estimated Effort:** 10 hours (1.25 days)

## Acceptance Criteria

- [ ] Hardcoded mock data templates exist for common entities
- [ ] Faker.js generates realistic data (names, emails, dates)
- [ ] Mock data injected into React components
- [ ] UI mockup fully interactive without backend
- [ ] Mock data spec stored in database

## Dependencies

**Blocked By:** None
**Blocks:** Epic 027 (Interactive Mockup Deployment needs mock data)
