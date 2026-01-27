import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

/**
 * PostgreSQL connection pool configuration
 */
const poolConfig: pg.PoolConfig = {
  user: process.env.PGUSER || 'supervisor',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'supervisor_service',
  password: process.env.PGPASSWORD || 'supervisor',
  port: parseInt(process.env.PGPORT || '5432', 10),
  max: 20, // Maximum number of clients in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
};

/**
 * Global database connection pool
 * Singleton pattern ensures only one pool is created
 */
export const pool = new Pool(poolConfig);

/**
 * Handle pool errors
 */
pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Test database connection
 * @returns Promise that resolves when connection is successful
 * @throws Error if connection fails
 */
export async function testConnection(): Promise<void> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected successfully at:', result.rows[0].now);
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

/**
 * Close all database connections
 * Should be called when shutting down the application
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}

/**
 * Execute a query with automatic error handling
 * @param query - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function query<T extends pg.QueryResultRow = any>(
  query: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(query, params);
    const duration = Date.now() - start;
    console.log('Executed query', { query: query.substring(0, 50), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Query error:', { query, error });
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 * @param callback - Function that executes queries within the transaction
 * @returns Result from callback
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
