/**
 * Server-side exports for local-first-db
 * 
 * Import from '@yourname/local-first-db/server'
 * 
 * @packageDocumentation
 */

export { SyncServer } from './index';
export type { ServerConfig } from './index';

export { MongoSyncAdapter } from './mongo-adapter';
export type { MongoSyncAdapterOptions } from './mongo-adapter';

export { PostgresSyncAdapter } from './postgres-adapter';
export type { PostgresSyncAdapterOptions } from './postgres-adapter';

/**
 * Quick start server creation
 * 
 * @example
 * ```typescript
 * import { createServer } from '@yourname/local-first-db/server';
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
