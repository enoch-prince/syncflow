# @syncflow-db/core

> Local-first database with event sourcing and vector clock synchronization

[![npm version](https://img.shields.io/npm/v/@syncflow-db/core.svg)](https://www.npmjs.com/package/@syncflow-db/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A lightweight, type-safe client library for building offline-first applications with automatic synchronization. @syncflow-db/core provides event sourcing, vector clock conflict detection, and seamless cloud sync.

## Features

✨ **Event Sourcing** - Every database change is captured as an operation with full history  
🔄 **Vector Clocks** - Sophisticated causal consistency tracking across multiple devices  
📱 **Offline-First** - Works completely offline with automatic sync when reconnected  
🔁 **Auto-Sync** - Optional continuous bidirectional synchronization  
🚀 **Type-Safe** - Full TypeScript support with exported types  
⚡ **Lightweight** - Minimal dependencies (only `uuid`)  
🗄️ **Flexible Storage** - SQLite backend (wa-sqlite) with fallback to memory  

## Installation

```bash
npm install @syncflow-db/core wa-sqlite
```

Or with pnpm:

```bash
pnpm add @syncflow-db/core wa-sqlite
```

`wa-sqlite` is optional—@syncflow-db/core will fall back to in-memory storage if not installed.

## Quick Start

### Basic Usage

```typescript
import { createDatabase } from '@syncflow-db/core';

// Initialize a local database
const { db } = await createDatabase({
  name: 'my-app',
});

// Insert a document
await db.insert('todos', {
  title: 'Build offline-first app',
  completed: false,
});

// Query documents
const todos = await db.find('todos');
console.log(todos);

// Update a document
await db.update('todos', 'doc-id', {
  completed: true,
});

// Delete a document
await db.delete('todos', 'doc-id');
```

### With Server Sync

```typescript
import { createDatabase } from '@syncflow-db/core';

const { db, sync } = await createDatabase({
  name: 'my-app',
  serverUrl: 'https://api.example.com',
  syncInterval: 5000, // Auto-sync every 5 seconds
});

// Manual sync on demand
const result = await sync?.sync();
console.log(`Synced: ${result?.pushed} pushed, ${result?.pulled} pulled`);

// Handle sync progress
sync?.onProgress((progress) => {
  console.log(`${progress.phase}: ${progress.current}/${progress.total}`);
});

// Handle sync errors
sync?.onError((error) => {
  console.error('Sync failed:', error);
});
```

## API Reference

### `createDatabase(options)`

Initialize a new local-first database instance.

**Options:**
```typescript
{
  name: string;              // Unique database name
  serverUrl?: string;        // Optional server URL for sync
  syncInterval?: number;     // Auto-sync interval in ms (requires serverUrl)
}
```

**Returns:**
```typescript
{
  db: LocalFirstDB;          // Database instance
  sync?: SyncEngine;         // Sync engine (if serverUrl provided)
}
```

### `LocalFirstDB` Class

#### Methods

**`insert(collection: string, data: any): Promise<Document>`**

Insert a new document into a collection.

```typescript
const doc = await db.insert('users', {
  name: 'Alice',
  email: 'alice@example.com',
});
// { _id: 'uuid', _rev: 1, name: 'Alice', email: 'alice@example.com' }
```

**`find(collection: string): Promise<Document[]>`**

Retrieve all documents from a collection (non-deleted only).

```typescript
const users = await db.find('users');
```

**`findById(collection: string, id: string): Promise<Document | null>`**

Retrieve a single document by ID.

```typescript
const user = await db.findById('users', 'user-123');
```

**`update(collection: string, id: string, data: any): Promise<Document>`**

Update an existing document. Increments the revision number.

```typescript
const updated = await db.update('users', 'user-123', {
  email: 'newemail@example.com',
});
```

**`delete(collection: string, id: string): Promise<void>`**

Soft-delete a document (marks `_deleted: true`, preserves history).

```typescript
await db.delete('users', 'user-123');
```

**`batch(operations: Operation[]): Promise<void>`**

Perform multiple operations atomically (tracked as single batch op).

```typescript
await db.batch([
  { type: 'insert', collection: 'users', data: { name: 'Bob' } },
  { type: 'update', collection: 'users', id: 'user-123', data: { role: 'admin' } },
]);
```

### `SyncEngine` Class

#### Methods

**`sync(): Promise<SyncResult>`**

Perform a single bidirectional sync cycle.

```typescript
const result = await sync?.sync();
// { success: true, pushed: 5, pulled: 3, conflicts: 0, errors: [] }
```

**`startContinuousSync(intervalMs: number): void`**

Start automatic sync on an interval.

```typescript
sync?.startContinuousSync(5000); // Sync every 5 seconds
```

**`stopContinuousSync(): void`**

Stop automatic sync.

```typescript
sync?.stopContinuousSync();
```

**`onProgress(callback: (progress: SyncProgress) => void): void`**

Listen to sync progress updates.

```typescript
sync?.onProgress((progress) => {
  console.log(`${progress.phase}: ${progress.current}/${progress.total}`);
  // phase: 'pull' | 'push' | 'idle'
  // total, current: operation counts
  // errors: error count
});
```

**`onError(callback: (error: Error) => void): void`**

Listen to sync errors.

```typescript
sync?.onError((error) => {
  console.error('Sync error:', error.message);
});
```

### Exported Types

```typescript
import type {
  Document,           // Database document with _id, _rev, _deleted?
  Operation,          // Event sourced operation
  OperationType,      // 'insert' | 'update' | 'delete' | 'batch'
  VectorClock,        // Client causality tracking
  SyncOptions,        // Sync configuration
  SyncProgress,       // Sync progress info
  SyncResult,         // Sync completion result
  ClockRelation,      // Vector clock comparison result
} from '@syncflow-db/core';
```

### Vector Clock Comparison

```typescript
import { compareVectorClocks } from '@syncflow-db/core';

const result = compareVectorClocks(clock1, clock2);
// 'happens-before' | 'happens-after' | 'concurrent'
```

## Event Sourcing

All database operations are captured as events with full metadata:

```typescript
interface Operation {
  id: string;                    // Unique operation ID
  type: 'insert' | 'update' | 'delete' | 'batch';
  collection: string;            // Collection name
  docId: string;                 // Document ID
  data?: any;                    // Operation data
  timestamp: number;             // Unix timestamp
  clientId: string;              // Source client ID
  synced: boolean;               // Sync status
  vectorClock: Record<string, number>; // Causal metadata
}
```

This enables:
- Complete audit trails
- Conflict detection via vector clocks
- Reliable synchronization
- Time-travel debugging

## Offline Support

@syncflow-db/core works entirely offline:

1. **Local Persistence** - All data stored locally via SQLite (wa-sqlite)
2. **Operation Buffering** - Changes queued automatically for sync
3. **Auto-Reconnection** - Resumes sync when connection restored
4. **Conflict Resolution** - Vector clocks detect and resolve conflicts

```typescript
// Works offline
await db.insert('todos', { title: 'Offline entry' });

// Auto-syncs when network returns
```

## Examples

### React Integration

```typescript
import { useEffect, useState } from 'react';
import { createDatabase } from '@syncflow-db/core';
import type { Document } from '@syncflow-db/core';

export function useSyncFlow(dbName: string) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let db: any;

    (async () => {
      const { db: instance, sync } = await createDatabase({
        name: dbName,
        serverUrl: process.env.REACT_APP_SERVER_URL,
        syncInterval: 5000,
      });

      db = instance;

      sync?.onProgress(() => setSyncing(true));
      sync?.onProgress(() => setSyncing(false));
    })();

    return () => {
      // Cleanup
    };
  }, [dbName]);

  const insert = async (collection: string, data: any) => {
    await db.insert(collection, data);
    const updated = await db.find(collection);
    setDocs(updated);
  };

  return { docs, syncing, insert };
}
```

### Batch Operations

```typescript
// Efficient multi-document operations
await db.batch([
  {
    type: 'insert',
    collection: 'users',
    data: { name: 'Alice', role: 'admin' },
  },
  {
    type: 'insert',
    collection: 'users',
    data: { name: 'Bob', role: 'user' },
  },
]);
```

## Server Implementation

@syncflow-db/core is designed to work with @syncflow-db/server. See the [main repository](https://github.com/enoch-prince/syncflow) for server setup and integration examples.

## Performance

- **Local Queries**: <1ms for in-memory, <10ms for SQLite
- **Sync**: ~10-100x less bandwidth than traditional sync approaches
- **Vector Clocks**: O(n) space and O(n) time for n clients
- **Batch Operations**: Grouped as single event for efficiency

## Limitations

- **Vector Clock Comparison**: Basic implementation; full partial-order semantics in v0.4.0+
- **Encryption**: No built-in encryption at rest (planned for v0.4.0+)
- **Batch Atomicity**: Operations are sequential, not atomic
- **Conflict Resolution**: Last-write-wins by default; custom resolvers in v0.4.0+

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires `wa-sqlite` for persistent storage; falls back to memory-only mode if unavailable.

## Contributing

Contributions welcome! Please see the [main repository](https://github.com/enoch-prince/syncflow) for guidelines.

## License

MIT © SyncFlow

## Support

- 📖 [Full Documentation](https://syncflow.dev)
- 💬 [GitHub Discussions](https://github.com/enoch-prince/syncflow/discussions)
- 🐛 [Report Issues](https://github.com/enoch-prince/syncflow/issues)
