# Changelog

All notable changes to @syncflow-db/core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-06-02

### Fixed
- Fixed adapter workspace discovery for monorepo structure
- Corrected adapter tsconfig paths in build configuration
- Removed problematic TypeScript path mappings from shared config

## [0.3.0] - 2025-05-15

### Changed
- **BREAKING**: Migrated to pnpm workspace structure
- Split core library into separate package at `packages/core`
- Updated build system to support ESM and CommonJS outputs

### Added
- ESM module output with tree-shaking support
- Dual export format (CommonJS and ES modules)
- TypeScript declaration files for better IDE support

### Fixed
- Improved type safety across database operations
- Resolved module resolution issues in workspace setup

## [0.2.0] - 2025-04-01

### Added
- **SyncEngine**: Bidirectional synchronization with conflict detection
- **Vector Clocks**: Causal consistency tracking across clients
- **Event Sourcing**: Complete operation history for reliable sync
- **Offline Support**: Full offline functionality with automatic reconnection
- **Progress Tracking**: Real-time sync progress callbacks
- **Retry Logic**: Exponential backoff for failed operations
- Batch operation support for efficient syncing

### Features
- Local-first database with SQLite backend (wa-sqlite)
- Automatic timestamp and client ID tracking
- Operation versioning with vector clock metadata
- Conflict resolution framework
- Event listener system for operation tracking

## [0.1.0] - 2025-02-15

### Added
- Initial release of @syncflow-db/core
- **LocalFirstDB**: Core database class for local data persistence
- **Document Operations**: Insert, update, delete, and batch operations
- **Collection Support**: Organize documents across named collections
- **Vector Clocks**: Basic multi-client causality tracking
- **TypeScript Support**: Full type definitions and exported types
- **wa-sqlite Integration**: Optional SQLite-based storage backend

### Features
- In-memory and persistent storage modes
- Document revision tracking (_rev field)
- Client ID management and persistence
- Basic query support with find operations
- Document soft-delete with _deleted flag
- Version exports for package identification

---

## Upgrade Guide

### From 0.1.x to 0.2.x

Add sync server support:

```typescript
import { createDatabase } from '@syncflow-db/core';

const { db, sync } = await createDatabase({
  name: 'my-app',
  serverUrl: 'https://api.example.com',
  syncInterval: 5000, // Optional: auto-sync every 5 seconds
});

// Manual sync
const result = await sync?.sync();
```

### From 0.2.x to 0.3.x

No breaking changes. Workspace migration is transparent to consumers. Build outputs remain compatible.

---

## Known Limitations

- Vector clock comparison is basic; full partial order semantics coming in 0.4.0
- No built-in encryption; data at rest is unencrypted
- Batch operations are sequential, not atomic
- Sync conflict resolution uses last-write-wins; custom resolvers coming soon

---

## Roadmap

### 0.4.0 (Planned)
- Improved conflict resolution with custom resolvers
- Encryption at rest support
- Query builder for complex filters
- Full-text search support
- Performance optimizations for large datasets

### 0.5.0 (Planned)
- MongoDB adapter integration
- PostgreSQL adapter integration
- Multi-device sync coordination
- Offline queue persistence improvements
