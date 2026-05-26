/**
 * Local-First Database with Event Sourcing
 * 
 * Core database class that manages local storage using SQLite (wa-sqlite)
 * and implements event sourcing for reliable sync.
 */

import { v4 as uuidv4 } from 'uuid';

// Operation types
export type OperationType = 'insert' | 'update' | 'delete' | 'batch';

export interface Operation {
  id: string;
  type: OperationType;
  collection: string;
  docId: string;
  data?: any;
  timestamp: number;
  clientId: string;
  synced: boolean;
  vectorClock: Record<string, number>;
}

export interface Document {
  _id: string;
  _rev: number;
  _deleted?: boolean;
  [key: string]: any;
}

export interface VectorClock {
  [clientId: string]: number;
}

/**
 * Main Database class
 */
export class LocalFirstDB {
  private db: any; // SQLite database instance
  private clientId: string;
  private vectorClock: VectorClock;
  private operationHandlers: Map<string, (op: Operation) => void>;

  constructor(dbName: string) {
    this.clientId = this.getOrCreateClientId();
    this.vectorClock = { [this.clientId]: 0 };
    this.operationHandlers = new Map();
  }

  /**
   * Initialize the database and create tables
   */
  async init(sqliteModule: any): Promise<void> {
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

      -- Materialized view of current document state
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        data TEXT NOT NULL, -- JSON stringified
        rev INTEGER DEFAULT 1,
        deleted INTEGER DEFAULT 0,
        vector_clock TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_docs_collection ON documents(collection);

      -- Sync metadata
      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    console.log('✓ Database initialized');
  }

  /**
   * Insert a document
   */
  async insert(collection: string, doc: any): Promise<Document> {
    const docId = doc._id || uuidv4();
    const operation: Operation = {
      id: uuidv4(),
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

  /**
   * Update a document
   */
  async update(collection: string, docId: string, updates: any): Promise<Document> {
    const existing = await this.get(collection, docId);
    if (!existing || existing._deleted) {
      throw new Error(`Document ${docId} not found`);
    }

    const operation: Operation = {
      id: uuidv4(),
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

  /**
   * Delete a document (soft delete)
   */
  async delete(collection: string, docId: string): Promise<void> {
    const operation: Operation = {
      id: uuidv4(),
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

  /**
   * Get a document by ID
   */
  async get(collection: string, docId: string): Promise<Document | null> {
    const result = await this.db.exec(`
      SELECT data, rev, deleted, vector_clock 
      FROM documents 
      WHERE id = ? AND collection = ?
    `, [docId, collection]);

    if (result.length === 0) return null;

    const row = result[0];
    if (row.deleted) return null;

    return {
      _id: docId,
      _rev: row.rev,
      ...JSON.parse(row.data),
    };
  }

  /**
   * Query documents in a collection
   */
  async find(collection: string, filter?: any): Promise<Document[]> {
    const result = await this.db.exec(`
      SELECT id, data, rev, deleted 
      FROM documents 
      WHERE collection = ? AND deleted = 0
      ORDER BY updated_at DESC
    `, [collection]);

    let documents = result.map((row: any) => ({
      _id: row.id,
      _rev: row.rev,
      ...JSON.parse(row.data),
    }));

    // Simple in-memory filtering if filter provided
    if (filter) {
      documents = documents.filter((doc: any) => {
        return Object.keys(filter).every(key => doc[key] === filter[key]);
      });
    }

    return documents;
  }

  /**
   * Get unsynced operations for pushing to server
   */
  async getUnsyncedOperations(limit: number = 100): Promise<Operation[]> {
    const result = await this.db.exec(`
      SELECT * FROM operations 
      WHERE synced = 0 
      ORDER BY timestamp ASC 
      LIMIT ?
    `, [limit]);

    return result.map((row: any) => ({
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

  /**
   * Apply remote operations from server
   */
  async applyRemoteOperations(operations: Operation[]): Promise<void> {
    for (const op of operations) {
      // Check if we've already applied this operation
      const existing = await this.db.exec(
        'SELECT id FROM operations WHERE id = ?',
        [op.id]
      );

      if (existing.length > 0) {
        continue; // Already applied
      }

      // Merge vector clocks
      this.mergeVectorClock(op.vectorClock);

      // Record and apply the operation
      await this.recordOperation(op);
      await this.applyOperation(op);
      this.notifyHandlers(op);
    }
  }

  /**
   * Mark operations as synced
   */
  async markSynced(operationIds: string[]): Promise<void> {
    const placeholders = operationIds.map(() => '?').join(',');
    await this.db.exec(`
      UPDATE operations 
      SET synced = 1 
      WHERE id IN (${placeholders})
    `, operationIds);
  }

  /**
   * Subscribe to changes
   */
  onChange(handler: (op: Operation) => void): () => void {
    const id = uuidv4();
    this.operationHandlers.set(id, handler);
    return () => this.operationHandlers.delete(id);
  }

  /**
   * Get current vector clock
   */
  getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  /**
   * Get sync state
   */
  async getSyncState(key: string): Promise<string | null> {
    const result = await this.db.exec(
      'SELECT value FROM sync_state WHERE key = ?',
      [key]
    );
    return result.length > 0 ? result[0].value : null;
  }

  /**
   * Set sync state
   */
  async setSyncState(key: string, value: string): Promise<void> {
    await this.db.exec(`
      INSERT INTO sync_state (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `, [key, value, value]);
  }

  // Private methods

  private async recordOperation(op: Operation): Promise<void> {
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

  private async applyOperation(op: Operation): Promise<Document> {
    const existing = await this.db.exec(
      'SELECT data, rev, vector_clock FROM documents WHERE id = ? AND collection = ?',
      [op.docId, op.collection]
    );

    let newData: any;
    let newRev: number;

    if (existing.length === 0) {
      // New document
      newData = op.data || {};
      newRev = 1;
    } else {
      const current = JSON.parse(existing[0].data);
      const currentClock = JSON.parse(existing[0].vector_clock);
      
      // Check for conflicts using vector clocks
      if (this.hasConcurrentChange(currentClock, op.vectorClock)) {
        // Conflict! Use last-write-wins based on timestamp
        console.warn(`Conflict detected for ${op.docId}, using last-write-wins`);
      }

      newRev = existing[0].rev + 1;

      if (op.type === 'delete') {
        newData = current;
      } else if (op.type === 'update') {
        newData = { ...current, ...op.data };
      } else {
        newData = op.data;
      }
    }

    await this.db.exec(`
      INSERT INTO documents (id, collection, data, rev, deleted, vector_clock, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = ?,
        rev = ?,
        deleted = ?,
        vector_clock = ?,
        updated_at = ?
    `, [
      op.docId,
      op.collection,
      JSON.stringify(newData),
      newRev,
      op.type === 'delete' ? 1 : 0,
      JSON.stringify(op.vectorClock),
      op.timestamp,
      JSON.stringify(newData),
      newRev,
      op.type === 'delete' ? 1 : 0,
      JSON.stringify(op.vectorClock),
      op.timestamp,
    ]);

    return {
      _id: op.docId,
      _rev: newRev,
      _deleted: op.type === 'delete',
      ...newData,
    };
  }

  private incrementClock(): VectorClock {
    this.vectorClock[this.clientId] = (this.vectorClock[this.clientId] || 0) + 1;
    return { ...this.vectorClock };
  }

  private mergeVectorClock(remoteClock: VectorClock): void {
    for (const [clientId, count] of Object.entries(remoteClock)) {
      this.vectorClock[clientId] = Math.max(
        this.vectorClock[clientId] || 0,
        count
      );
    }
  }

  private hasConcurrentChange(clock1: VectorClock, clock2: VectorClock): boolean {
    const keys = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);
    let clock1Greater = false;
    let clock2Greater = false;

    for (const key of keys) {
      const val1 = clock1[key] || 0;
      const val2 = clock2[key] || 0;

      if (val1 > val2) clock1Greater = true;
      if (val2 > val1) clock2Greater = true;
    }

    return clock1Greater && clock2Greater;
  }

  private getOrCreateClientId(): string {
    let clientId = localStorage.getItem('local-first-db-client-id');
    if (!clientId) {
      clientId = uuidv4();
      localStorage.setItem('local-first-db-client-id', clientId);
    }
    return clientId;
  }

  private notifyHandlers(op: Operation): void {
    this.operationHandlers.forEach(handler => {
      try {
        handler(op);
      } catch (err) {
        console.error('Error in change handler:', err);
      }
    });
  }
}
