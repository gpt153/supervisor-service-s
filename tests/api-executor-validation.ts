import { Logger } from 'pino';
import { APITestExecutor } from '../src/testing/api/index.js';
import { APITestDefinition } from '../src/types/api-testing.js';

const mockLogger: Logger = {
  debug: () => {},
  info: (obj, msg) => console.log(`[INFO] ${msg}`),
  warn: (obj, msg) => console.log(`[WARN] ${msg}`),
  error: (obj, msg) => console.log(`[ERROR] ${msg}`),
} as any;

async function test() {
  console.log('Starting API Test Executor validation...\n');
  
  const executor = new APITestExecutor(mockLogger, {
    baseUrl: 'https://jsonplaceholder.typicode.com',
    timeout: 10000,
    verbose: true,
  });

  // Test 1: HTTP GET with schema validation
  console.log('Test 1: HTTP GET with Schema Validation');
  const test1: APITestDefinition = {
    id: 'test-001-get',
    epicId: 'epic-006-d',
    name: 'GET /posts/1',
    description: 'Test GET request',
    type: 'http_api',
    httpRequest: {
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/posts/1',
    },
    expectedResponse: {
      status: 200,
      schema: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['id', 'title', 'body'],
      },
    },
  };

  try {
    const result1 = await executor.executeTest(test1);
    console.log(`  Passed: ${result1.passed}`);
    console.log(`  Validations: ${result1.validationResults.length}`);
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  await executor.cleanup();
  console.log('\nValidation complete!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
