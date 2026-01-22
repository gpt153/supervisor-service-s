# ADR 009: Mock Data Strategy

**Status:** Accepted
**Date:** 2026-01-22
**Context:** UI-First Development Workflow
**Related Epic:** 026 (Mock Data System)

## Context

Interactive UI mockups need realistic data WITHOUT backend. Three approaches:
1. **Hardcoded**: Arrays of static data
2. **Faker.js**: Generated realistic data
3. **MSW (Mock Service Worker)**: API mocking with fetch/axios

## Decision

**Layered Approach: Hardcoded → Faker.js → MSW**

Use simplest solution first, escalate complexity when needed.

## Rationale

**Hardcoded (Simple):**
- ✅ Fast to implement
- ✅ Deterministic (same data every time)
- ✅ Good for simple forms, displays
- ❌ Unrealistic data
- ❌ Limited quantity

**Faker.js (Realistic):**
- ✅ Realistic names, emails, dates
- ✅ Generate hundreds of items
- ✅ Easy to use: `faker.person.fullName()`
- ❌ Still static arrays (not API calls)

**MSW (Advanced):**
- ✅ Real API calls work (fetch, axios)
- ✅ Complete workflow testing
- ✅ Easy migration to real backend (same API)
- ❌ Complex setup
- ❌ Overkill for simple UIs

**Decision Matrix:**
- **Simple forms**: Hardcoded
- **Lists, tables**: Faker.js
- **Complex workflows (login, CRUD)**: MSW

## Implementation

**Hardcoded:**
```typescript
const users = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" }
];
```

**Faker.js:**
```typescript
import { faker } from '@faker-js/faker';

const users = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: faker.person.fullName(),
  email: faker.internet.email()
}));
```

**MSW:**
```typescript
import { setupWorker, rest } from 'msw';

const worker = setupWorker(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json(generateUsers(50)));
  })
);
```

## Consequences

**Positive:**
- Flexibility to choose complexity level
- Easy to migrate upward (hardcoded → Faker → MSW)
- Most cases handled by simpler solutions

**Negative:**
- Multiple patterns to maintain
- Developer must choose appropriate level

**Guidelines:**
- Start with hardcoded
- Use Faker for lists > 5 items
- Use MSW only when testing API interactions critical
