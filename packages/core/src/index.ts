/**
 * @syncflow/core
 * 
 * Local-first database with event sourcing and multi-database sync.
 * 
 * @packageDocumentation
 */

// Core database exports
export { LocalFirstDB } from './database.js';
export type {
  Document,
  Operation,
  OperationType,
  VectorClock,
} from './database.js';

// Sync engine exports
export { SyncEngine } from './sync-engine.js';
export { compareVectorClocks } from './vector-clock.js';
import type { SyncEngine as SyncEngineType } from './sync-engine.js';
export type {
  SyncOptions,
  SyncProgress,
  SyncResult,
} from './sync-engine.js';
export type { ClockRelation } from './vector-clock.js';

// Version (generated from package.json)
export { VERSION } from './version.js';

/**
 * Initialize a new local-first database instance
 * 
 * @example
 * ```typescript
 * import { createDatabase } from '@syncflow/core';
 * 
 * const db = await createDatabase({
 *   name: 'my-app',
 *   serverUrl: 'https://api.example.com'
 * });
 * 
 * await db.insert('todos', { title: 'Hello World' });
 * ```
 */
export async function createDatabase(options: {
  name: string;
  serverUrl?: string;
  syncInterval?: number;
}) {
  const { LocalFirstDB } = await import('./database.js');
  const { SyncEngine } = await import('./sync-engine.js');

  const db = new LocalFirstDB(options.name);
  
  // Initialize with wa-sqlite if available
  try {
    // Dynamic import for optional dependency
    const waModule = await import('wa-sqlite');
    await db.init(waModule);
  } catch (error) {
    console.warn('wa-sqlite not found, using mock storage');
    await db.init({} as any);
  }

  // Setup sync if server URL provided
  let sync: SyncEngineType | undefined;
  if (options.serverUrl) {
    sync = new SyncEngine(db, {
      serverUrl: options.serverUrl,
    });

    if (options.syncInterval) {
      sync?.startContinuousSync(options.syncInterval);
    }
  }

  return { db, sync };
}
