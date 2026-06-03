# Changelog

All notable changes to @syncflow-db/mongodb will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-06-02

### Fixed
- Fixed adapter workspace discovery for monorepo structure
- Corrected adapter tsconfig paths in build configuration

## [0.3.0] - 2025-05-15

### Changed
- **BREAKING**: Migrated to pnpm workspace structure
- Split adapter into separate package at `packages/adapters/mongodb`
- Updated build system to support ESM and CommonJS outputs

### Added
- ESM module output with tree-shaking support
- Dual export format (CommonJS and ES modules)
- TypeScript declaration files for better IDE support

## [0.2.0] - 2025-04-01

### Added
- **MongoSyncAdapter**: Adapter for MongoDB operations and document storage
- **Vector Clock Integration**: Automatic conflict detection using compareVectorClocks
- **Change Streams**: Real-time change tracking via MongoDB Change Streams
- **Operation Idempotency**: Duplicate operations are safely ignored
- **Materialized View**: `documents` collection for efficient document state queries
- **Indexes**: Automatic index creation for performance optimization
- **Query Support**: Collection filtering and document retrieval
- **Statistics**: Operation counts and unsynced operation tracking
- **Compaction**: Remove old operations to manage database size

### Features
- Automatic index creation on connection
- Real-time change stream watching for live sync
- JSONB-style document storage
- Conflict detection via vector clocks
- Document revision tracking
- Soft-delete support (documents marked as `deleted` instead of removed)

## [0.1.0] - 2025-02-15

### Added
- Initial release of @syncflow-db/mongodb
- **MongoSyncAdapter Class**: MongoDB implementation of sync adapter
- **Core Methods**: getChanges, acceptOperations, queryDocuments, getStats
- **TypeScript Support**: Full type definitions

---

## Upgrade Guide

### From 0.1.x to 0.2.x

No breaking changes. New features are additive.

### From 0.2.x to 0.3.x

No breaking changes. Workspace migration is transparent to consumers. Build outputs remain compatible.

---

## Known Limitations

- Change Streams require a MongoDB replica set (not available on standalone server)
- Collection filtering is simple key-value matching; complex aggregations not yet supported
- Vector clock comparison is basic; full partial-order semantics in v0.4.0+
- Batch operations are sequential, not atomic

---

## Roadmap

### 0.4.0 (Planned)
- Aggregation pipeline support for complex queries
- Automatic backup and export functionality
- Connection pooling optimization
- Change stream resumption after disconnection

### 0.5.0 (Planned)
- Full-text search support
- Custom index management
- Data migration utilities
- Performance monitoring hooks
