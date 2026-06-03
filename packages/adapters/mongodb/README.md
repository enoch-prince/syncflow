# @syncflow-db/mongodb

> MongoDB adapter for SyncFlow server synchronization

[![npm version](https://img.shields.io/npm/v/@syncflow-db/mongodb.svg)](https://www.npmjs.com/package/@syncflow-db/mongodb)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A MongoDB adapter for @syncflow-db/server that handles operation persistence, conflict detection via vector clocks, and real-time change tracking using MongoDB Change Streams.

## Features

💾 **MongoDB Native** - Uses official MongoDB driver with full type support  
🔄 **Vector Clocks** - Automatic conflict detection using vector clock comparison  
⚡ **Change Streams** - Real-time change notifications via MongoDB Change Streams  
📊 **Materialized View** - Efficient document state queries via `documents` collection  
🗂️ **Automatic Indexes** - Optimized indexes created on connection  
✅ **Idempotent Operations** - Duplicate operations safely ignored  
🧹 **Compaction** - Remove old operations to manage database growth  
📝 **TypeScript** - Full type definitions and IDE support  

## Installation

```bash
npm install @syncflow-db/mongodb
```

Or with pnpm:
```bash
pnpm add @syncflow-db/mongodb
```

## Quick Start

### Basic Setup

```typescript
import { MongoSyncAdapter } from '@syncflow-db/mongodb';

const adapter = new MongoSyncAdapter({
  uri: 'mongodb://localhost:27017',
  dbName: 'syncflow',
});

// Connect and initialize
await adapter.connect();

// Use with @syncflow-db/server
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({
  port: 3000,
  adapter: 'mongodb',
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'syncflow',
});

await server.start();
```

### With Connection String

```typescript
const adapter = new MongoSyncAdapter({
  uri: 'mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true',
  dbName: 'production_db',
  operationsCollection: 'ops',      // Optional: defaults to 'operations'
  documentsCollection: 'docs',      // Optional: defaults to 'documents'
});

await adapter.connect();
```

## API Reference

### MongoSyncAdapter

#### Constructor

```typescript
new MongoSyncAdapter(options: MongoSyncAdapterOptions)
```

**Options:**
```typescript
{
  uri: string;                      // MongoDB connection string (required)
  dbName: string;                   // Database name (required)
  operationsCollection?: string;    // Operations collection (default: 'operations')
  documentsCollection?: string;     // Documents collection (default: 'documents')
}
```

#### Methods

**`async connect(): Promise<void>`**

Connect to MongoDB and create indexes.

```typescript
await adapter.connect();
// Creates indexes on operations and documents collections
```

**`async disconnect(): Promise<void>`**

Close MongoDB connection and change streams.

```typescript
await adapter.disconnect();
```

**`async getChanges(since: number, limit?: number): Promise<{ operations, conflicts }>`**

Retrieve operations since a given timestamp.

```typescript
const result = await adapter.getChanges(1234567890, 100);
// { operations: [op1, op2, ...], conflicts: [] }
```

**`async acceptOperations(operations: Operation[], clientId: string): Promise<{ accepted, conflicts }>`**

Store client operations and detect conflicts.

```typescript
const result = await adapter.acceptOperations([op1, op2], 'client-123');
// Returns accepted operations and any conflicts
```

**`async getDocument(collection: string, docId: string): Promise<any | null>`**

Retrieve a document by collection and ID.

```typescript
const doc = await adapter.getDocument('todos', 'doc-1');
// { _id: 'doc-1', _rev: 2, title: 'Buy milk', completed: true }
```

**`async queryDocuments(collection: string, filter?: any): Promise<any[]>`**

Query documents in a collection with optional filters.

```typescript
const docs = await adapter.queryDocuments('todos', { completed: false });
// Returns documents matching the filter
```

**`async getStats(): Promise<{ totalOperations, totalDocuments, unsyncedOperations }>`**

Get statistics on operations and documents.

```typescript
const stats = await adapter.getStats();
// { totalOperations: 1523, totalDocuments: 342, unsyncedOperations: 12 }
```

**`async compact(olderThanDays?: number): Promise<number>`**

Remove operations older than the cutoff to reclaim storage.

```typescript
const deleted = await adapter.compact(30);  // Remove ops older than 30 days
// Returns count of deleted operations
```

**`watchChanges(callback: (op: Operation) => void): void`**

Watch for real-time changes via Change Streams.

```typescript
adapter.watchChanges((op) => {
  console.log('New operation:', op);
});
```

## Database Schema

### `operations` Collection

Stores all operations for event sourcing and sync history.

```typescript
{
  _id: string,              // Operation UUID
  id: string,               // Operation ID
  type: string,             // 'insert' | 'update' | 'delete' | 'batch'
  collection: string,       // Target collection name
  docId: string,            // Document ID
  data?: any,               // Operation payload
  timestamp: number,        // Unix timestamp
  clientId: string,         // Source client ID
  synced: boolean,          // Sync status
  vectorClock: object,      // { clientId: version, ... }
  receivedAt: Date,         // Server receive time
}
```

**Indexes:**
- `{ timestamp: 1, synced: 1 }` - Efficient change queries
- `{ id: 1 }` - Unique operation identification
- `{ clientId: 1, timestamp: 1 }` - Per-client operation tracking

### `documents` Collection

Materialized view of current document state for efficient queries.

```typescript
{
  _id: ObjectId,
  id: string,               // Document ID
  collection: string,       // Collection name
  data: object,             // Document content
  rev: number,              // Revision counter
  deleted: boolean,         // Soft-delete flag
  vectorClock: object,      // Last-update vector clock
  updatedAt: number,        // Last update timestamp
}
```

**Indexes:**
- `{ collection: 1, id: 1 }` - Unique document lookup
- Default index on `_id`

## Conflict Resolution

The adapter detects conflicts using vector clock comparison:

1. **Duplicate Detection** - If operation ID already exists, it's idempotent-accepted
2. **Vector Clock Comparison** - Compares client operation's vector clock against server state
   - **`happens-before`** → Operation is stale, rejected
   - **`concurrent`** → Real conflict (both sides changed), rejected
   - **`happens-after`/`equal`** → Operation is newer, accepted
3. **Conflict Return** - Server version returned for client resolution

```typescript
// Client sends update for doc-1
const op = {
  id: 'op-123',
  type: 'update',
  collection: 'todos',
  docId: 'doc-1',
  data: { title: 'Updated' },
  vectorClock: { 'client-1': 1, 'client-2': 0 },
};

const result = await adapter.acceptOperations([op], 'client-1');

// If conflict:
// result.conflicts[0].data = { /* server's version */ }
// result.conflicts[0].vectorClock = { /* server's vector clock */ }
```

## Real-Time Sync

Enable real-time change propagation using MongoDB Change Streams:

```typescript
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({ /* config */ });

// Get adapter instance
const adapter = server['adapter']; // Access via server

// Watch for changes
adapter.watchChanges((op) => {
  console.log('Operation received on server:', op);
  // Broadcast to connected WebSocket clients if needed
});

await server.start();
```

**Requirements:**
- MongoDB must run on a replica set (Change Streams don't work on standalone)
- Read preference can be set to `secondary` for replicas

## Performance Tuning

### Connection Pooling

The adapter uses MongoDB driver defaults:
- Default pool size: 10 connections
- Can be configured via connection string: `maxPoolSize=50`

```typescript
const adapter = new MongoSyncAdapter({
  uri: 'mongodb://localhost:27017?maxPoolSize=50',
  dbName: 'syncflow',
});
```

### Index Optimization

Indexes are auto-created on first connect. For large datasets:

```typescript
// Create compound index for faster queries
db.operations.createIndex({
  clientId: 1,
  timestamp: 1,
  synced: 1
});

// Use hint in queries
const result = await adapter.operations.find({ clientId }).hint({
  clientId: 1,
  timestamp: 1
});
```

### Compaction Strategy

Regular compaction keeps the operations collection manageable:

```bash
# Compact weekly via cron job
0 2 * * 0 curl -X POST http://localhost:3000/compact -d '{"olderThanDays":90}'
```

### Monitoring

Check stats regularly to monitor growth:

```bash
# Monitor via HTTP
curl http://localhost:3000/stats

# Or directly
const stats = await adapter.getStats();
console.log(`Operations: ${stats.totalOperations}, Documents: ${stats.totalDocuments}`);
```

## Error Handling

The adapter throws errors for common issues:

```typescript
try {
  await adapter.connect();
} catch (error) {
  console.error('Connection failed:', error.message);
  // Handle MongoDB connection errors
}

try {
  await adapter.acceptOperations(ops, 'client-1');
} catch (error) {
  console.error('Operation failed:', error.message);
  // Handle operation processing errors
}
```

## Deployment

### Docker Example

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
ENV MONGO_URI=mongodb://mongo:27017
ENV MONGO_DB_NAME=syncflow
CMD ["node", "dist/index.js"]
```

### Connection String Best Practices

```bash
# Development (local)
MONGO_URI=mongodb://localhost:27017

# Production (Atlas)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority

# Production (with pool sizing)
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?maxPoolSize=50&retryWrites=true
```

## Limitations

- Change Streams require a replica set (not supported on standalone MongoDB)
- Simple filtering only (no aggregation pipeline support in adapter)
- Vector clock comparison is basic (v0.4.0+ will support partial-order semantics)

## License

MIT © SyncFlow

## Support

- 📖 [Full Documentation](https://syncflow.dev)
- 💬 [GitHub Discussions](https://github.com/enoch-prince/syncflow/discussions)
- 🐛 [Report Issues](https://github.com/enoch-prince/syncflow/issues)
