# Changelog

All notable changes to @syncflow-db/postgres will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-06-02

### Fixed
- Fixed adapter workspace discovery for monorepo structure
- Corrected adapter tsconfig paths in build configuration

## [0.3.0] - 2025-05-15

### Changed
- **BREAKING**: Migrated to pnpm workspace structure
- Split adapter into separate package at `packages/adapters/postgres`
- Updated build system to support ESM and CommonJS outputs

### Added
- ESM module output with tree-shaking support
- Dual export format (CommonJS and ES modules)
- TypeScript declaration files for better IDE support

## [0.2.0] - 2025-04-01

### Added
- **PostgresSyncAdapter**: Adapter for PostgreSQL operations and document storage
- **Vector Clock Integration**: Automatic conflict detection using compareVectorClocks
- **NOTIFY/LISTEN**: Real-time change tracking via PostgreSQL triggers and notifications
- **Operation Idempotency**: Duplicate operations are safely ignored
- **Materialized View**: `documents` table for efficient document state queries
- **Automatic Schema**: Tables, indexes, and sequences created on initialization
- **Query Support**: JSONB querying and document filtering
- **Statistics**: Operation counts and unsynced operation tracking
- **Compaction**: Remove old operations to manage database size
- **Transaction Support**: ACID-compliant operation processing with `FOR UPDATE` locking

### Features
- Automatic schema initialization with transactions
- JSONB type for flexible document storage
- Trigger-based real-time notifications
- Row-level locking for conflict-free concurrent access
- Connection pooling for scalability
- Soft-delete support (documents marked as deleted)

## [0.1.0] - 2025-02-15

### Added
- Initial release of @syncflow-db/postgres
- **PostgresSyncAdapter Class**: PostgreSQL implementation of sync adapter
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

- LISTEN/NOTIFY can have message loss if server restarts (mitigated by polling)
- Query filtering is simple key-value matching; complex aggregations not yet supported
- Vector clock comparison is basic; full partial-order semantics in v0.4.0+
- Batch operations are sequential, not atomic

---

## Roadmap

### 0.4.0 (Planned)
- Full-text search support using PostgreSQL text search
- Partitioning strategy for large operations tables
- Automatic VACUUM/ANALYZE scheduling
- Query builder for complex filters

### 0.5.0 (Planned)
- JSON schema validation for documents
- Data migration utilities
- Replication support (streaming replication helpers)
- Performance monitoring hooks and query analysis
