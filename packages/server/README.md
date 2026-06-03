# @syncflow-db/server

> Express server for SyncFlow with pluggable database adapters

[![npm version](https://img.shields.io/npm/v/@syncflow-db/server.svg)](https://www.npmjs.com/package/@syncflow-db/server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A lightweight, production-ready HTTP server for synchronizing @syncflow-db/core clients with server-side databases. Handles conflict detection, operation persistence, and change propagation using vector clocks.

## Features

🚀 **Express-based** - Built on Express for easy deployment and customization  
💾 **Multi-Adapter** - Pluggable database backends (MongoDB, PostgreSQL)  
🔄 **Vector Clocks** - Automatic conflict detection via vector clock comparison  
⚡ **Operation Persistence** - Complete event sourcing with audit trails  
📊 **Statistics** - Real-time sync metrics and operation counts  
🧹 **Automatic Compaction** - Clean up old operations to manage database size  
🔀 **Idempotent Operations** - Duplicate operations are safely ignored  
📝 **TypeScript** - Full type safety and IDE support  

## Installation

```bash
npm install @syncflow-db/server
```

With MongoDB:
```bash
npm install @syncflow-db/server @syncflow-db/mongodb
```

With PostgreSQL:
```bash
npm install @syncflow-db/server @syncflow-db/postgres
```

Or with pnpm:
```bash
pnpm add @syncflow-db/server
```

## Quick Start

### MongoDB Backend

```typescript
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({
  port: 3000,
  adapter: 'mongodb',
  mongoUri: 'mongodb://localhost:27017',
  mongoDbName: 'syncflow',
});

await server.start();
```

### PostgreSQL Backend

```typescript
import { SyncServer } from '@syncflow-db/server';

const server = new SyncServer({
  port: 3000,
  adapter: 'postgres',
  postgresConnectionString: 'postgresql://user:pass@localhost:5432/syncflow',
});

await server.start();
```

### Environment Variables

```bash
PORT=3000
ADAPTER=mongodb  # or 'postgres'

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=syncflow

# PostgreSQL
POSTGRES_CONNECTION_STRING=postgresql://user:pass@localhost:5432/syncflow
```

Run as CLI:
```bash
node -r ts-node/register server.ts
```

## API Reference

### Health Check

**GET** `/health`

Check server and adapter status.

```bash
curl http://localhost:3000/health
# { "status": "ok", "adapter": "mongodb" }
```

### Pull Changes

**POST** `/changes`

Retrieve changes from the server since a given timestamp.

**Request:**
```json
{
  "since": 1234567890,
  "limit": 100,
  "clientId": "client-123",
  "vectorClock": { "client-1": 5, "client-2": 3 }
}
```

**Response:**
```json
{
  "operations": [
    {
      "id": "op-uuid",
      "type": "insert",
      "collection": "todos",
      "docId": "doc-1",
      "data": { "title": "Buy milk" },
      "timestamp": 1234567890,
      "clientId": "client-1",
      "synced": false,
      "vectorClock": { "client-1": 1, "client-2": 0 }
    }
  ],
  "conflicts": []
}
```

### Push Operations

**POST** `/operations`

Submit operations from a client to the server.

**Request:**
```json
{
  "clientId": "client-123",
  "operations": [
    {
      "id": "op-uuid",
      "type": "insert",
      "collection": "todos",
      "docId": "doc-1",
      "data": { "title": "Buy milk", "completed": false },
      "timestamp": 1234567890,
      "clientId": "client-123",
      "synced": false,
      "vectorClock": { "client-123": 1 }
    }
  ]
}
```

**Response:**
```json
{
  "accepted": [
    { "id": "op-uuid", "type": "insert", ... }
  ],
  "conflicts": []
}
```

### Get Document

**GET** `/documents/:collection/:id`

Retrieve a single document by ID.

```bash
curl http://localhost:3000/documents/todos/doc-1
# { "_id": "doc-1", "_rev": 1, "title": "Buy milk", "completed": false }
```

### Query Documents

**POST** `/documents/:collection/query`

Query documents in a collection with filters.

**Request:**
```json
{
  "filter": { "completed": false }
}
```

**Response:**
```json
{
  "documents": [
    { "_id": "doc-1", "_rev": 1, "title": "Buy milk", "completed": false }
  ],
  "count": 1
}
```

### Get Statistics

**GET** `/stats`

Get server-side statistics on operations and documents.

**Response:**
```json
{
  "totalOperations": 1523,
  "totalDocuments": 342,
  "unsyncedOperations": 12
}
```

### Compact Operations

**POST** `/compact`

Remove old operations to reclaim storage space.

**Request:**
```json
{
  "olderThanDays": 30
}
```

**Response:**
```json
{
  "message": "Compaction completed",
  "deletedCount": 245
}
```

## Adapter Selection

The server uses a **pluggable adapter system** to support multiple databases:

- **MongoDB**: Change Streams for real-time updates, JSONB for flexible schemas
- **PostgreSQL**: Triggers for real-time updates, native JSON type for schemas

Both adapters implement the same interface:
- `getChanges(since, limit)` - Retrieve operations
- `acceptOperations(operations, clientId)` - Store and apply operations
- `getDocument(collection, id)` - Retrieve a document
- `queryDocuments(collection, filter)` - Query documents
- `getStats()` - Retrieve statistics
- `compact(olderThanDays)` - Clean up old operations

## Conflict Resolution

The server uses vector clocks to detect conflicts:

- **`happens-before`**: Operation is causally older than server state → rejected, server version returned
- **`concurrent`**: Operation and server state have diverged → rejected, server version returned (real conflict)
- **`happens-after` or `equal`**: Operation is causally newer → accepted

Clients must implement conflict resolution UI/logic when receiving conflicts.

## Performance Tuning

### MongoDB

- Create indexes on `timestamp`, `clientId`, and `collection` fields
- Use change streams for real-time sync (scale horizontally with replica sets)
- Monitor `operations` collection size; compact old entries regularly

### PostgreSQL

- Connection pooling is built-in (default pool size: 10 clients)
- Indexes on `timestamp`, `client_id`, and `collection` are created automatically
- JSONB queries benefit from GIN indexes (auto-created)
- Use `VACUUM ANALYZE` for query optimization

### Both

- Batch large operations: group 10-100 operations per `/operations` request
- Use `/compact` endpoint on a schedule (e.g., weekly) to archive old operations
- Monitor `/stats` endpoint for growth patterns

## Error Handling

All endpoints return JSON error responses:

```json
{
  "error": "Document not found",
  "message": "No document with ID 'doc-1' in collection 'todos'"
}
```

Errors follow standard HTTP status codes:
- `400` - Bad request (invalid JSON, missing fields)
- `404` - Not found (collection, document, or endpoint)
- `500` - Server error (database connection, adapter failure)

## Deployment

### Docker Example

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY dist ./dist
ENV PORT=3000
ENV ADAPTER=mongodb
ENV MONGO_URI=mongodb://mongo:27017
ENV MONGO_DB_NAME=syncflow
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Environment Setup

```bash
# .env
PORT=3000
ADAPTER=mongodb
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=syncflow
NODE_ENV=production
```

### Process Management

Use `pm2` or similar for process management:

```bash
pm2 start dist/index.js --name syncflow-server
pm2 logs syncflow-server
pm2 restart syncflow-server
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Get stats
curl http://localhost:3000/stats

# Insert via client and pull
curl -X POST http://localhost:3000/changes \
  -H "Content-Type: application/json" \
  -d '{ "since": 0, "limit": 100, "clientId": "test" }'
```

## Client Integration

See @syncflow-db/core for client-side integration:

```typescript
import { createDatabase } from '@syncflow-db/core';

const { db, sync } = await createDatabase({
  name: 'my-app',
  serverUrl: 'http://localhost:3000',
  syncInterval: 5000,
});
```

## License

MIT © SyncFlow

## Support

- 📖 [Full Documentation](https://syncflow.dev)
- 💬 [GitHub Discussions](https://github.com/enoch-prince/syncflow/discussions)
- 🐛 [Report Issues](https://github.com/enoch-prince/syncflow/issues)
