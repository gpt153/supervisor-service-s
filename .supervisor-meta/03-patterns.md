# Meta Service Patterns

## Code Organization

### Module Structure
```typescript
// Each module exports a class or functions
export class ServiceName {
  constructor(dependencies) {
    // Dependency injection
  }

  async methodName(): Promise<Result> {
    // Implementation
  }
}
```

### Error Handling
```typescript
try {
  const result = await operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Operation failed:', error);
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

### Database Queries
```typescript
import { pool } from '../db/client.js';

export async function queryName(params: Params): Promise<Result[]> {
  const query = `
    SELECT * FROM table_name
    WHERE condition = $1
  `;

  const result = await pool.query(query, [params.value]);
  return result.rows;
}
```

## File Naming

- Classes: PascalCase (e.g., `InstructionAssembler.ts`)
- Utilities: kebab-case (e.g., `string-utils.ts`)
- Types: kebab-case with suffix (e.g., `instruction-types.ts`)
- Tests: Same as file + `.test.ts` (e.g., `InstructionAssembler.test.ts`)

## Import Conventions

Always use `.js` extension for local imports (TypeScript ESM requirement):

```typescript
import { Something } from './module.js';  // ✓ Correct
import { Something } from './module';     // ✗ Wrong
```

## Documentation

Use JSDoc for all public APIs:

```typescript
/**
 * Brief description of what this does
 *
 * @param paramName - Description of parameter
 * @returns Description of return value
 * @throws {ErrorType} When this error occurs
 */
export async function functionName(paramName: string): Promise<Result> {
  // Implementation
}
```

## Testing

- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Test database separate from production
- Mock external dependencies
