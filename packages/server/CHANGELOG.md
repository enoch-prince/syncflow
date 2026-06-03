# Changelog

All notable changes to @syncflow-db/server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2025-06-02

### Fixed
- Fixed adapter workspace discovery for monorepo structure
- Corrected adapter tsconfig paths in build configuration

## [0.3.0] - 2025-05-15

### Changed
- **BREAKING**: Migrated to pnpm workspace structure
- Split server into separate package at `packages/server`
- Updated build system to support ESM and CommonJS outputs

### Added
- ESM module output with tree-shaking support
- Dual export format (CommonJS and ES modules)
- TypeScript declaration files for better IDE support
- Database adapter abstraction for MongoDB and PostgreSQL

## [0.2.0] - 2025-04-01

### Added
- **SyncServer**: Express-based server for handling client sync requests
- **Adapter System**: Abstract adapter interface for multiple database backends
- **Operation Endpoints**: `/operations` POST endpoint for accepting client operations
- **Change Endpoints**: `/changes` POST endpoint for pulling server changes
- **Document Queries**: `/documents/:collection/query` for querying documents
- **Statistics Endpoint**: `/stats` for monitoring sync operations
- **Compaction Endpoint**: `/compact` for cleaning up old operations

### Features
- Vector clock-based conflict detection
- Operation idempotency (duplicate operation handling)
- Graceful server startup/shutdown
- CORS support for cross-origin requests
- Request logging middleware
- Error handling middleware
- JSON body parsing with 10MB limit

## [0.1.0] - 2025-02-15

### Added
- Initial release of @syncflow-db/server
- **SyncServer Class**: Core server implementation
- **Express Integration**: HTTP API for sync protocol
- **MongoDB Adapter**: Support for MongoDB backend
- **PostgreSQL Adapter**: Support for PostgreSQL backend
- **TypeScript Support**: Full type definitions

---

## Upgrade Guide

### From 0.1.x to 0.2.x

Server configuration remains compatible. No breaking changes at the API level.

### From 0.2.x to 0.3.x

No breaking changes. Workspace migration is transparent to consumers. Build outputs remain compatible.

---

## Known Limitations

- Adapter selection is fixed at server startup (no dynamic adapter switching)
- Query filters are simple key-value matching; complex queries not yet supported
- No built-in authentication or authorization layer
- Compaction only filters by age; no compression of operation history

---

## Roadmap

### 0.4.0 (Planned)
- Authentication middleware (JWT/API keys)
- Advanced query filters and aggregations
- Real-time WebSocket support for live sync
- Server-side conflict resolution strategies

### 0.5.0 (Planned)
- Multi-adapter routing (route collections to different databases)
- Operation filtering and transformation middleware
- Rate limiting and backpressure handling
- Metrics and observability (Prometheus integration)
