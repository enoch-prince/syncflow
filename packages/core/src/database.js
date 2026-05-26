"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalFirstDB = void 0;
const uuid_1 = require("uuid");
const vector_clock_js_1 = require("./vector-clock.js");
class LocalFirstDB {
    constructor(dbName) {
        this.clientId = this.getOrCreateClientId();
        this.vectorClock = { [this.clientId]: 0 };
        this.operationHandlers = new Map();
    }
    async init(sqliteModule) {
        this.db = sqliteModule;
        await this.db.exec(`
      -- Operations log (event sourcing)
      CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        collection TEXT NOT NULL,
        doc_id TEXT NOT NULL,
        data TEXT, -- JSON stringified
        timestamp INTEGER NOT NULL,
        client_id TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        vector_clock TEXT NOT NULL -- JSON stringified
      );

      -- Index for efficient querying
      CREATE INDEX IF NOT EXISTS idx_ops_synced ON operations(synced, timestamp);
      CREATE INDEX IF NOT EXISTS idx_ops_collection ON operations(collection, doc_id);

      -- Materialized view of current document state.
      -- last_writer_id records the clientId of the op that last won LWW
      -- for this row; used as a deterministic tiebreaker on timestamp ties.
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON stringified
        rev INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0,
        vector_clock TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        last_writer_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_docs_collection ON documents(collection);

      -- Sync metadata
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
        try {
            await this.db.exec('ALTER TABLE documents ADD COLUMN last_writer_id TEXT');
        }
        catch {
        }
        console.log('✓ Database initialized');
    }
    async insert(collection, doc) {
        const docId = doc._id || (0, uuid_1.v4)();
        const operation = {
            id: (0, uuid_1.v4)(),
            type: 'insert',
            collection,
            docId,
            data: doc,
            timestamp: Date.now(),
            clientId: this.clientId,
            synced: false,
            vectorClock: this.incrementClock(),
        };
        await this.recordOperation(operation);
        const result = await this.applyOperation(operation);
        this.notifyHandlers(operation);
        return result;
    }
    async update(collection, docId, updates) {
        const existing = await this.get(collection, docId);
        if (!existing || existing._deleted) {
            throw new Error(`Document ${docId} not found`);
        }
        const operation = {
            id: (0, uuid_1.v4)(),
            type: 'update',
            collection,
            docId,
            data: updates,
            timestamp: Date.now(),
            clientId: this.clientId,
            synced: false,
            vectorClock: this.incrementClock(),
        };
        await this.recordOperation(operation);
        const result = await this.applyOperation(operation);
        this.notifyHandlers(operation);
        return result;
    }
    async delete(collection, docId) {
        const operation = {
            id: (0, uuid_1.v4)(),
            type: 'delete',
            collection,
            docId,
            timestamp: Date.now(),
            clientId: this.clientId,
            synced: false,
            vectorClock: this.incrementClock(),
        };
        await this.recordOperation(operation);
        await this.applyOperation(operation);
        this.notifyHandlers(operation);
    }
    async get(collection, docId) {
        const result = await this.db.exec(`
      SELECT data, rev, deleted, vector_clock 
      FROM documents 
      WHERE id = ? AND collection = ?
    `, [docId, collection]);
        if (result.length === 0)
            return null;
        const row = result[0];
        if (row.deleted)
            return null;
        return {
            _id: docId,
            _rev: row.rev,
            ...JSON.parse(row.data),
        };
    }
    async find(collection, filter) {
        const result = await this.db.exec(`
      SELECT id, data, rev, deleted 
      FROM documents 
      WHERE collection = ? AND deleted = 0
      ORDER BY updated_at DESC
    `, [collection]);
        let documents = result.map((row) => ({
            _id: row.id,
            _rev: row.rev,
            ...JSON.parse(row.data),
        }));
        if (filter) {
            documents = documents.filter((doc) => {
                return Object.keys(filter).every(key => doc[key] === filter[key]);
            });
        }
        return documents;
    }
    async getUnsyncedOperations(limit = 100) {
        const result = await this.db.exec(`
      SELECT * FROM operations 
      WHERE synced = 0 
      ORDER BY timestamp ASC 
      LIMIT ?
    `, [limit]);
        return result.map((row) => ({
            id: row.id,
            type: row.type,
            collection: row.collection,
            docId: row.doc_id,
            data: row.data ? JSON.parse(row.data) : undefined,
            timestamp: row.timestamp,
            clientId: row.client_id,
            synced: Boolean(row.synced),
            vectorClock: JSON.parse(row.vector_clock),
        }));
    }
    async applyRemoteOperations(operations) {
        for (const op of operations) {
            const existing = await this.db.exec('SELECT id FROM operations WHERE id = ?', [op.id]);
            if (existing.length > 0) {
                continue;
            }
            this.mergeVectorClock(op.vectorClock);
            await this.recordOperation(op);
            await this.applyOperation(op);
            this.notifyHandlers(op);
        }
    }
    async markSynced(operationIds) {
        const placeholders = operationIds.map(() => '?').join(',');
        await this.db.exec(`
      UPDATE operations 
      SET synced = 1 
      WHERE id IN (${placeholders})
    `, operationIds);
    }
    onChange(handler) {
        const id = (0, uuid_1.v4)();
        this.operationHandlers.set(id, handler);
        return () => this.operationHandlers.delete(id);
    }
    getVectorClock() {
        return { ...this.vectorClock };
    }
    async getSyncState(key) {
        const result = await this.db.exec('SELECT value FROM sync_state WHERE key = ?', [key]);
        return result.length > 0 ? result[0].value : null;
    }
    async setSyncState(key, value) {
        await this.db.exec(`
      INSERT INTO sync_state (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `, [key, value, value]);
    }
    async recordOperation(op) {
        await this.db.exec(`
      INSERT INTO operations (
        id, type, collection, doc_id, data, 
        timestamp, client_id, synced, vector_clock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            op.id,
            op.type,
            op.collection,
            op.docId,
            op.data ? JSON.stringify(op.data) : null,
            op.timestamp,
            op.clientId,
            op.synced ? 1 : 0,
            JSON.stringify(op.vectorClock),
        ]);
    }
    async applyOperation(op) {
        const existing = await this.db.exec('SELECT data, rev, deleted, vector_clock, updated_at, last_writer_id FROM documents WHERE id = ? AND collection = ?', [op.docId, op.collection]);
        let newData;
        let newRev;
        if (existing.length === 0) {
            newData = op.data || {};
            newRev = 1;
        }
        else {
            const current = JSON.parse(existing[0].data);
            const currentClock = JSON.parse(existing[0].vector_clock);
            const currentTimestamp = existing[0].updated_at;
            const currentWriterId = existing[0].last_writer_id || '';
            const relation = (0, vector_clock_js_1.compareVectorClocks)(op.vectorClock, currentClock);
            let opWins;
            if (relation === 'before') {
                opWins = false;
            }
            else if (relation === 'concurrent') {
                opWins =
                    op.timestamp > currentTimestamp ||
                        (op.timestamp === currentTimestamp && op.clientId > currentWriterId);
                console.warn(`LWW for ${op.docId}: op ${op.id} (${op.clientId}@${op.timestamp}) vs ` +
                    `existing (${currentWriterId}@${currentTimestamp}) → ` +
                    (opWins ? 'op wins' : 'existing wins'));
            }
            else {
                opWins = true;
            }
            if (!opWins) {
                return {
                    _id: op.docId,
                    _rev: existing[0].rev,
                    _deleted: Boolean(existing[0].deleted),
                    ...current,
                };
            }
            newRev = existing[0].rev + 1;
            if (op.type === 'delete') {
                newData = current;
            }
            else if (op.type === 'update') {
                newData = { ...current, ...op.data };
            }
            else {
                newData = op.data;
            }
        }
        await this.db.exec(`
      INSERT INTO documents (id, collection, data, rev, deleted, vector_clock, updated_at, last_writer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = ?,
        rev = ?,
        deleted = ?,
        vector_clock = ?,
        updated_at = ?,
        last_writer_id = ?
    `, [
            op.docId,
            op.collection,
            JSON.stringify(newData),
            newRev,
            op.type === 'delete' ? 1 : 0,
            JSON.stringify(op.vectorClock),
            op.timestamp,
            op.clientId,
            JSON.stringify(newData),
            newRev,
            op.type === 'delete' ? 1 : 0,
            JSON.stringify(op.vectorClock),
            op.timestamp,
            op.clientId,
        ]);
        return {
            _id: op.docId,
            _rev: newRev,
            _deleted: op.type === 'delete',
            ...newData,
        };
    }
    incrementClock() {
        this.vectorClock[this.clientId] = (this.vectorClock[this.clientId] || 0) + 1;
        return { ...this.vectorClock };
    }
    mergeVectorClock(remoteClock) {
        for (const [clientId, count] of Object.entries(remoteClock)) {
            this.vectorClock[clientId] = Math.max(this.vectorClock[clientId] || 0, count);
        }
    }
    getOrCreateClientId() {
        let clientId = localStorage.getItem('local-first-db-client-id');
        if (!clientId) {
            clientId = (0, uuid_1.v4)();
            localStorage.setItem('local-first-db-client-id', clientId);
        }
        return clientId;
    }
    notifyHandlers(op) {
        this.operationHandlers.forEach(handler => {
            try {
                handler(op);
            }
            catch (err) {
                console.error('Error in change handler:', err);
            }
        });
    }
}
exports.LocalFirstDB = LocalFirstDB;
//# sourceMappingURL=database.js.map