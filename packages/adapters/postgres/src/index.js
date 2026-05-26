"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresSyncAdapter = void 0;
const pg_1 = require("pg");
const core_1 = require("@syncflow/core");
class PostgresSyncAdapter {
    constructor(options) {
        this.schema = options.schema || 'public';
        this.pool = new pg_1.Pool({
            connectionString: options.connectionString,
        });
    }
    async initialize() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.operations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          collection TEXT NOT NULL,
          doc_id TEXT NOT NULL,
          data JSONB,
          timestamp BIGINT NOT NULL,
          client_id TEXT NOT NULL,
          synced BOOLEAN DEFAULT FALSE,
          vector_clock JSONB NOT NULL,
          received_at TIMESTAMP DEFAULT NOW()
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.schema}.documents (
          id TEXT NOT NULL,
          collection TEXT NOT NULL,
          data JSONB NOT NULL,
          rev INTEGER DEFAULT 1,
          deleted BOOLEAN DEFAULT FALSE,
          vector_clock JSONB NOT NULL,
          updated_at BIGINT NOT NULL,
          PRIMARY KEY (collection, id)
        );
      `);
            await client.query(`
        CREATE INDEX IF NOT EXISTS idx_ops_timestamp 
        ON ${this.schema}.operations(timestamp, synced);
        
        CREATE INDEX IF NOT EXISTS idx_ops_client 
        ON ${this.schema}.operations(client_id, timestamp);
        
        CREATE INDEX IF NOT EXISTS idx_docs_collection 
        ON ${this.schema}.documents(collection);
        
        CREATE INDEX IF NOT EXISTS idx_docs_updated 
        ON ${this.schema}.documents(updated_at);
      `);
            await client.query(`
        CREATE SEQUENCE IF NOT EXISTS ${this.schema}.operation_seq;
      `);
            await client.query('COMMIT');
            console.log('✓ PostgreSQL schema initialized');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async disconnect() {
        await this.pool.end();
        console.log('✓ Disconnected from PostgreSQL');
    }
    async getChanges(since, limit = 100) {
        const result = await this.pool.query(`
      SELECT * FROM ${this.schema}.operations
      WHERE timestamp > $1
      ORDER BY timestamp ASC
      LIMIT $2
      `, [since, limit]);
        return {
            operations: result.rows.map(this.mapFromPostgres),
            conflicts: [],
        };
    }
    async acceptOperations(operations, clientId) {
        const accepted = [];
        const conflicts = [];
        for (const op of operations) {
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                const existing = await client.query(`SELECT id FROM ${this.schema}.operations WHERE id = $1`, [op.id]);
                if (existing.rows.length > 0) {
                    accepted.push(op);
                    await client.query('COMMIT');
                    continue;
                }
                const docState = await client.query(`
          SELECT data, vector_clock, rev 
          FROM ${this.schema}.documents 
          WHERE collection = $1 AND id = $2
          FOR UPDATE
          `, [op.collection, op.docId]);
                if (docState.rows.length > 0) {
                    const relation = (0, core_1.compareVectorClocks)(op.vectorClock, docState.rows[0].vector_clock);
                    if (relation === 'before' || relation === 'concurrent') {
                        conflicts.push({
                            ...op,
                            data: docState.rows[0].data,
                            vectorClock: docState.rows[0].vector_clock,
                        });
                        await client.query('ROLLBACK');
                        continue;
                    }
                }
                await client.query(`
          INSERT INTO ${this.schema}.operations (
            id, type, collection, doc_id, data, 
            timestamp, client_id, synced, vector_clock
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
                    op.id,
                    op.type,
                    op.collection,
                    op.docId,
                    op.data ? JSON.stringify(op.data) : null,
                    op.timestamp,
                    op.clientId,
                    false,
                    JSON.stringify(op.vectorClock),
                ]);
                await this.applyOperation(client, op);
                await client.query('COMMIT');
                accepted.push(op);
            }
            catch (error) {
                await client.query('ROLLBACK');
                console.error(`Error processing operation ${op.id}:`, error);
            }
            finally {
                client.release();
            }
        }
        return { accepted, conflicts };
    }
    async applyOperation(client, op) {
        const existing = await client.query(`SELECT data, rev FROM ${this.schema}.documents 
       WHERE collection = $1 AND id = $2`, [op.collection, op.docId]);
        let newData;
        let newRev = 1;
        if (existing.rows.length > 0) {
            newRev = existing.rows[0].rev + 1;
            if (op.type === 'delete') {
                await client.query(`UPDATE ${this.schema}.documents 
           SET deleted = TRUE, vector_clock = $1, updated_at = $2
           WHERE collection = $3 AND id = $4`, [JSON.stringify(op.vectorClock), op.timestamp, op.collection, op.docId]);
                return;
            }
            if (op.type === 'update') {
                newData = { ...existing.rows[0].data, ...op.data };
            }
            else {
                newData = op.data;
            }
        }
        else {
            newData = op.data;
        }
        await client.query(`
      INSERT INTO ${this.schema}.documents (
        id, collection, data, rev, deleted, vector_clock, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (collection, id) DO UPDATE SET
        data = $3,
        rev = $4,
        deleted = $5,
        vector_clock = $6,
        updated_at = $7
      `, [
            op.docId,
            op.collection,
            JSON.stringify(newData),
            newRev,
            op.type === 'delete',
            JSON.stringify(op.vectorClock),
            op.timestamp,
        ]);
    }
    async getDocument(collection, docId) {
        const result = await this.pool.query(`
      SELECT data, rev FROM ${this.schema}.documents
      WHERE collection = $1 AND id = $2 AND deleted = FALSE
      `, [collection, docId]);
        if (result.rows.length === 0)
            return null;
        return {
            _id: docId,
            _rev: result.rows[0].rev,
            ...result.rows[0].data,
        };
    }
    async queryDocuments(collection, filter) {
        let query = `
      SELECT id, data, rev FROM ${this.schema}.documents
      WHERE collection = $1 AND deleted = FALSE
    `;
        const params = [collection];
        if (filter) {
            let paramIndex = 2;
            Object.keys(filter).forEach((key) => {
                query += ` AND data->>'${key}' = $${paramIndex}`;
                params.push(filter[key]);
                paramIndex++;
            });
        }
        query += ' ORDER BY updated_at DESC';
        const result = await this.pool.query(query, params);
        return result.rows.map((row) => ({
            _id: row.id,
            _rev: row.rev,
            ...row.data,
        }));
    }
    async listenForChanges(callback) {
        const client = await this.pool.connect();
        await client.query(`
      CREATE OR REPLACE FUNCTION ${this.schema}.notify_operation_insert()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify(
          'operation_inserted',
          json_build_object(
            'id', NEW.id,
            'type', NEW.type,
            'collection', NEW.collection,
            'doc_id', NEW.doc_id
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        await client.query(`
      DROP TRIGGER IF EXISTS operation_insert_trigger 
      ON ${this.schema}.operations;
      
      CREATE TRIGGER operation_insert_trigger
      AFTER INSERT ON ${this.schema}.operations
      FOR EACH ROW
      EXECUTE FUNCTION ${this.schema}.notify_operation_insert();
    `);
        client.on('notification', async (msg) => {
            if (msg.channel === 'operation_inserted') {
                const data = JSON.parse(msg.payload || '{}');
                const result = await client.query(`SELECT * FROM ${this.schema}.operations WHERE id = $1`, [data.id]);
                if (result.rows.length > 0) {
                    callback(this.mapFromPostgres(result.rows[0]));
                }
            }
        });
        await client.query('LISTEN operation_inserted');
        console.log('✓ Listening for PostgreSQL changes...');
    }
    mapFromPostgres(row) {
        return {
            id: row.id,
            type: row.type,
            collection: row.collection,
            docId: row.doc_id,
            data: row.data,
            timestamp: parseInt(row.timestamp, 10),
            clientId: row.client_id,
            synced: row.synced,
            vectorClock: row.vector_clock,
        };
    }
    async getStats() {
        const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ${this.schema}.operations) as total_ops,
        (SELECT COUNT(*) FROM ${this.schema}.documents WHERE deleted = FALSE) as total_docs,
        (SELECT COUNT(*) FROM ${this.schema}.operations WHERE synced = FALSE) as unsynced
    `);
        return {
            totalOperations: parseInt(result.rows[0].total_ops, 10),
            totalDocuments: parseInt(result.rows[0].total_docs, 10),
            unsyncedOperations: parseInt(result.rows[0].unsynced, 10),
        };
    }
    async compact(olderThanDays = 30) {
        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        const result = await this.pool.query(`
      DELETE FROM ${this.schema}.operations
      WHERE timestamp < $1
      `, [cutoff]);
        console.log(`✓ Compacted ${result.rowCount} old operations`);
        return result.rowCount || 0;
    }
}
exports.PostgresSyncAdapter = PostgresSyncAdapter;
//# sourceMappingURL=index.js.map