# @syncflow-db/postgres

> PostgreSQL adapter for SyncFlow server synchronization

[![npm version](https://img.shields.io/npm/v/@syncflow-db/postgres.svg)](https://www.npmjs.com/package/@syncflow-db/postgres)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A PostgreSQL adapter for @syncflow-db/server that handles operation persistence, conflict detection via vector clocks, and real-time change tracking using PostgreSQL triggers and NOTIFY/LISTEN.

## Features

💾 **PostgreSQL Native** - Uses `pg` driver with connection pooling  
🔄 **Vector Clocks** - Automatic conflict detection using vector clock comparison  
⚡ **NOTIFY/LISTEN** - Real-time notifications via PostgreSQL triggers  
📊 **Materialized View** - Efficient document state queries via `documents` table  
🗂️ **Automatic Schema** - Tables, indexes, and sequences auto-created on init  
✅ **Idempotent Operations** - Duplicate operations safely ignored  
🔒 **ACID Transactions** - Row-level locking and transaction safety  
🧹 **Compaction** - Remove old operations to manage database growth  
📝 **TypeScript** - Full type definitions and IDE support  

## Installation

```bash
npm install @syncflow-db/postgres
```

Or with pnpm:
```bash
pnpm add @syncflow-db/postgres
```

## Quick Start

### Basic Setup

```typescript
import { PostgresSyncAdapter } from '@syncflow-db/postgres';

const adapter = new PostgresSyncAdapter({
  connectionString: 'postgresql://user:password@localhost:5432/syncflow',
});

// Initialize database schema
await adapter.initialize();

// Use with @syncflow-db/server
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({
  port: 3000,
  adapter: 'postgres',
  postgresConnectionString: 'postgresql://user:password@localhost:5432/syncflow',
});

await server.start();
```

### With Custom Schema

```typescript
const adapter = new PostgresSyncAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/db',
  schema: 'myapp',  // Use custom schema instead of 'public'
});

await adapter.initialize();
```

## API Reference

### PostgresSyncAdapter

#### Constructor

```typescript
new PostgresSyncAdapter(options: PostgresSyncAdapterOptions)
```

**Options:**
```typescript
{
  connectionString: string;  // PostgreSQL connection string (required)
  schema?: string;           // Schema name (default: 'public')
}
```

#### Methods

**`async initialize(): Promise<void>`**

Create database schema, tables, indexes, and sequences.

```typescript
await adapter.initialize();
// Creates operations, documents tables with indexes
```

**`async disconnect(): Promise<void>`**

Close all database connections.

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

**`async listenForChanges(callback: (op: Operation) => void): Promise<void>`**

Watch for real-time changes via NOTIFY/LISTEN.

```typescript
await adapter.listenForChanges((op) => {
  console.log('New operation:', op);
});
```

## Database Schema

### `operations` Table

Stores all operations for event sourcing and sync history.

```sql
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- 'insert' | 'update' | 'delete' | 'batch'
  collection TEXT NOT NULL,        -- Target collection name
  doc_id TEXT NOT NULL,            -- Document ID
  data JSONB,                      -- Operation payload
  timestamp BIGINT NOT NULL,       -- Unix timestamp
  client_id TEXT NOT NULL,         -- Source client ID
  synced BOOLEAN DEFAULT FALSE,    -- Sync status
  vector_clock JSONB NOT NULL,     -- { clientId: version, ... }
  received_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_ops_timestamp` - `(timestamp, synced)` - Efficient change queries
- `idx_ops_client` - `(client_id, timestamp)` - Per-client operation tracking

### `documents` Table

Materialized view of current document state for efficient queries.

```sql
CREATE TABLE documents (
  id TEXT NOT NULL,                -- Document ID
  collection TEXT NOT NULL,        -- Collection name
  data JSONB NOT NULL,             -- Document content
  rev INTEGER DEFAULT 1,           -- Revision counter
  deleted BOOLEAN DEFAULT FALSE,   -- Soft-delete flag
  vector_clock JSONB NOT NULL,     -- Last-update vector clock
  updated_at BIGINT NOT NULL,      -- Last update timestamp
  PRIMARY KEY (collection, id)
);
```

**Indexes:**
- `idx_docs_collection` - `(collection)` - Collection queries
- `idx_docs_updated` - `(updated_at)` - Time-based queries

## Conflict Resolution

The adapter detects conflicts using vector clock comparison:

1. **Duplicate Detection** - If operation ID already exists, it's idempotent-accepted
2. **Vector Clock Comparison** - Compares client operation's vector clock against server state
   - **`happens-before`** → Operation is stale, rejected
   - **`concurrent`** → Real conflict (both sides changed), rejected
   - **`happens-after`/`equal`** → Operation is newer, accepted
3. **Row Locking** - Uses `FOR UPDATE` to ensure consistent conflict detection
4. **Conflict Return** - Server version returned for client resolution

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

Enable real-time change propagation using PostgreSQL NOTIFY/LISTEN:

```typescript
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({ /* config */ });

// Get adapter instance
const adapter = server['adapter'];

// Listen for changes
await adapter.listenForChanges((op) => {
  console.log('Operation from database:', op);
  // Broadcast to connected WebSocket clients if needed
});

await server.start();
```

**How it works:**
1. Trigger fires on `operations` table INSERT
2. Trigger calls `pg_notify()` with operation metadata
3. Listener receives notification and fetches full operation
4. Callback invoked with complete operation

## Performance Tuning

### Connection Pooling

Configure pool size via connection string:

```typescript
const adapter = new PostgresSyncAdapter({
  connectionString: 'postgresql://user:pass@localhost:5432/db?max=50',
});
```

Or via environment variable:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
# Pool size controlled by pg driver defaults
```

### Index Optimization

Indexes are auto-created on initialization. For large datasets, analyze query plans:

```bash
EXPLAIN ANALYZE
SELECT * FROM operations
WHERE timestamp > 1234567890
ORDER BY timestamp ASC
LIMIT 100;

# Ensure index_ops_timestamp is used
```

### JSONB Query Performance

Add GIN index for complex JSONB queries:

```sql
CREATE INDEX idx_documents_data_gin ON documents USING GIN (data);
```

### Compaction Strategy

Regular compaction keeps the operations table manageable:

```bash
# Compact weekly (remove ops older than 90 days)
0 2 * * 0 curl -X POST http://localhost:3000/compact -d '{"olderThanDays":90}'
```

### Maintenance

Regular PostgreSQL maintenance optimizes performance:

```sql
-- Run periodically
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
FROM pg_tables 
WHERE schemaname = 'public';
```

## Connection String Examples

```bash
# Local development
postgresql://localhost/syncflow

# With credentials
postgresql://user:password@localhost:5432/syncflow

# Production with pool sizing
postgresql://user:password@db.example.com:5432/syncflow?max=50&sslmode=require

# Unix socket
postgresql:///syncflow?host=/var/run/postgresql

# Heroku PostgreSQL
postgres://user:password@host.com:5432/dbname
```

## Error Handling

The adapter throws errors for common issues:

```typescript
try {
  await adapter.initialize();
} catch (error) {
  console.error('Schema creation failed:', error.message);
  // Handle schema initialization errors
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
ENV DATABASE_URL=postgresql://user:pass@postgres:5432/syncflow
CMD ["node", "dist/index.js"]
```

### Docker Compose Example

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://syncflow:password@postgres:5432/syncflow
    depends_on:
      - postgres
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: syncflow
      POSTGRES_PASSWORD: password
      POSTGRES_DB: syncflow
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:
```

### Backup Strategy

```bash
# Backup operations and documents tables
pg_dump -h localhost -U user -d syncflow \
  --table=operations --table=documents \
  -F custom -f backup.dump

# Restore
pg_restore -h localhost -U user -d syncflow backup.dump
```

## Limitations

- NOTIFY messages can be lost if PostgreSQL restarts (mitigated by polling)
- Simple filtering only (no complex aggregation pipeline support)
- Vector clock comparison is basic (v0.4.0+ will support partial-order semantics)
- LISTEN requires a persistent connection (not suitable for stateless functions)

## License

MIT © SyncFlow

## Support

- 📖 [Full Documentation](https://syncflow.dev)
- 💬 [GitHub Discussions](https://github.com/enoch-prince/syncflow/discussions)
- 🐛 [Report Issues](https://github.com/enoch-prince/syncflow/issues)
