/**
 * Server-side exports for local-first-db
 * 
 * Import from '@syncflow/server'
 * 
 * @packageDocumentation
 */

export { SyncServer } from './index';
export type { ServerConfig } from './index';

/**
 * Quick start server creation
 * 
 * @example
 * ```typescript
 * import { createServer } from '@syncflow/server';
 * 
 * const server = await createServer({
 *   port: 3000,
 *   adapter: 'mongodb',
 *   mongoUri: 'mongodb://localhost:27017',
 *   mongoDbName: 'myapp'
 * });
 * 
 * await server.start();
 * ```
 */
export async function createServer(config: {
  port: number;
  adapter: 'mongodb' | 'postgres';
  mongoUri?: string;
  mongoDbName?: string;
  postgresConnectionString?: string;
}) {
  const { SyncServer } = await import('./index');
  const server = new SyncServer(config as any);
  return server;
}
