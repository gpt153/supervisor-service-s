# Meta Service Patterns

## Code Organization

**Module Structure**: Export classes/functions, dependency injection, structured returns (`{ success, data/error }`)

**Error Handling**: Try/catch async operations, log errors, return structured responses

**Database Queries**: Import from `../db/client.js`, parameterized queries, return `result.rows`

---

## Naming Conventions

- **Classes**: PascalCase (`InstructionAssembler.ts`)
- **Utilities**: kebab-case (`string-utils.ts`)
- **Types**: kebab-case + suffix (`instruction-types.ts`)
- **Tests**: Same as file + `.test.ts`

---

## Imports

**CRITICAL**: Always use `.js` extension for local imports (TypeScript ESM requirement)

```typescript
import { Something } from './module.js';  // ✓
import { Something } from './module';     // ✗
```

---

## Documentation

**JSDoc for all public APIs**: Description, `@param`, `@returns`, `@throws`

---

## Testing

**Locations**: Unit (`tests/unit/`), Integration (`tests/integration/`)
**Practice**: Separate test database, mock external dependencies

---

## References

**Guide**: `/home/samuel/sv/docs/guides/meta-service-patterns-guide.md` (complete examples, templates, patterns)
