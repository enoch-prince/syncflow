# SyncFlow

> Flow seamlessly between local and cloud

**SyncFlow** is a local-first database with event sourcing and vector clock synchronization. Build offline-first applications that sync reliably across devices.

[![npm version](https://img.shields.io/npm/v/@syncflow/core.svg)](https://www.npmjs.com/package/@syncflow/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔄 **Event Sourcing** - Every change captured as an operation
- ⏱️ **Vector Clocks** - Sophisticated conflict detection
- 📱 **Offline-First** - Works without internet
- 🔁 **Auto-Sync** - Automatic bidirectional synchronization  
- 🗄️ **Multi-Backend** - MongoDB, PostgreSQL, or any database
- 🚀 **Efficient** - 10-100x less bandwidth than traditional sync

## 🚀 Quick Start

```bash
npm install @syncflow/core wa-sqlite
```

```typescript
import { createDatabase } from '@syncflow/core';

const { db } = await createDatabase({
  name: 'my-app',
  serverUrl: 'http://localhost:3000'
});

await db.insert('todos', { title: 'Hello SyncFlow!' });
const todos = await db.find('todos');
```

See full documentation at [syncflow.dev](https://syncflow.dev)

## 📦 Packages

- `@syncflow/core` - Main client library
- `@syncflow/server` - Sync server
- `@syncflow/mongodb` - MongoDB adapter
- `@syncflow/postgres` - PostgreSQL adapter

## License

MIT © SyncFlow
