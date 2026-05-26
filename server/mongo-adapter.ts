/**
 * MongoDB Adapter
 * 
 * Server-side adapter for syncing with MongoDB using Change Streams
 * and maintaining operation logs for event sourcing.
 */

import { MongoClient, Db, Collection, ChangeStream } from 'mongodb';
import { Operation } from '../src/database';
import { compareVectorClocks } from '../src/vector-clock';

export interface MongoSyncAdapterOptions {
  uri: string;
  dbName: string;
  operationsCollection?: string;
  documentsCollection?: string;
}

export class MongoSyncAdapter {
  private client: MongoClient;
  private db!: Db;
  private operations!: Collection;
  private documents!: Collection;
  private changeStream?: ChangeStream;
  private options: Required<MongoSyncAdapterOptions>;

  constructor(options: MongoSyncAdapterOptions) {
    this.options = {
      operationsCollection: 'operations',
      documentsCollection: 'documents',
      ...options,
    };
    this.client = new MongoClient(this.options.uri);
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.options.dbName);
    this.operations = this.db.collection(this.options.operationsCollection);
    this.documents = this.db.collection(this.options.documentsCollection);

    // Create indexes
    await this.operations.createIndex({ timestamp: 1, synced: 1 });
    await this.operations.createIndex({ id: 1 }, { unique: true });
    await this.operations.createIndex({ clientId: 1, timestamp: 1 });
    await this.documents.createIndex({ collection: 1, id: 1 }, { unique: true });

    console.log('✓ Connected to MongoDB');
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.changeStream) {
      await this.changeStream.close();
    }
    await this.client.close();
    console.log('✓ Disconnected from MongoDB');
  }

  /**
   * Get changes since a timestamp
   */
  async getChanges(since: number, limit: number = 100): Promise<{
    operations: Operation[];
    conflicts: Operation[];
  }> {
    const operations = await this.operations
      .find({
        timestamp: { $gt: since },
      })
      .sort({ timestamp: 1 })
      .limit(limit)
      .toArray();

    return {
      operations: operations.map(this.mapFromMongo),
      conflicts: [], // We'll detect conflicts on the client
    };
  }

  /**
   * Accept operations from client
   */
  async acceptOperations(
    operations: Operation[],
    clientId: string
  ): Promise<{
    accepted: Operation[];
    conflicts: Operation[];
  }> {
    const accepted: Operation[] = [];
    const conflicts: Operation[] = [];

    for (const op of operations) {
      try {
        // Check if operation already exists (idempotency)
        const existing = await this.operations.findOne({ id: op.id });
        if (existing) {
          accepted.push(op);
          continue;
        }

        // Compare vector clocks against server's current document state
        const docState = await this.documents.findOne({
          collection: op.collection,
          id: op.docId,
        });

        if (docState) {
          const relation = compareVectorClocks(
            op.vectorClock,
            docState.vectorClock || {}
          );
          // 'before'     → op is older than server state (stale write)
          // 'concurrent' → real conflict; both sides have unique changes
          // Either way: reject and return server's version so the client can
          // update its local state and clock.
          if (relation === 'before' || relation === 'concurrent') {
            conflicts.push({
              ...op,
              data: docState.data,
              vectorClock: docState.vectorClock,
            });
            continue;
          }
          // 'after' or 'equal' → op is causally newer (or identical); accept.
        }

        // Store operation
        await this.operations.insertOne({
          ...op,
          _id: op.id as any,
          receivedAt: Date.now(),
        });

        // Apply operation to document state
        await this.applyOperation(op);

        accepted.push(op);
      } catch (error) {
        console.error(`Error processing operation ${op.id}:`, error);
      }
    }

    return { accepted, conflicts };
  }

  /**
   * Apply operation to document materialized view
   */
  private async applyOperation(op: Operation): Promise<void> {
    const docQuery = {
      collection: op.collection,
      id: op.docId,
    };

    const existing = await this.documents.findOne(docQuery);

    if (op.type === 'delete') {
      if (existing) {
        await this.documents.updateOne(docQuery, {
          $set: {
            deleted: true,
            vectorClock: op.vectorClock,
            updatedAt: op.timestamp,
          },
        });
      }
      return;
    }

    let newData: any;
    let newRev = 1;

    if (existing) {
      newRev = (existing.rev || 0) + 1;
      if (op.type === 'update') {
        newData = { ...existing.data, ...op.data };
      } else {
        newData = op.data;
      }
    } else {
      newData = op.data;
    }

    await this.documents.updateOne(
      docQuery,
      {
        $set: {
          data: newData,
          rev: newRev,
          deleted: false,
          vectorClock: op.vectorClock,
          updatedAt: op.timestamp,
        },
      },
      { upsert: true }
    );
  }

  /**
   * Watch for changes in real-time (for live sync)
   */
  watchChanges(callback: (op: Operation) => void): void {
    this.changeStream = this.operations.watch([], {
      fullDocument: 'updateLookup',
    });

    this.changeStream.on('change', (change) => {
      if (change.operationType === 'insert') {
        const op = this.mapFromMongo(change.fullDocument);
        callback(op);
      }
    });

    console.log('✓ Watching for changes...');
  }

  /**
   * Get document by ID
   */
  async getDocument(collection: string, docId: string): Promise<any | null> {
    const doc = await this.documents.findOne({
      collection,
      id: docId,
      deleted: { $ne: true },
    });

    return doc ? doc.data : null;
  }

  /**
   * Query documents
   */
  async queryDocuments(collection: string, filter?: any): Promise<any[]> {
    const query: any = {
      collection,
      deleted: { $ne: true },
    };

    if (filter) {
      // Simple filter support - can be extended
      Object.keys(filter).forEach((key) => {
        query[`data.${key}`] = filter[key];
      });
    }

    const docs = await this.documents.find(query).toArray();
    return docs.map((doc) => ({
      _id: doc.id,
      _rev: doc.rev,
      ...doc.data,
    }));
  }

  /**
   * Map MongoDB document to Operation
   */
  private mapFromMongo(doc: any): Operation {
    return {
      id: doc.id || doc._id,
      type: doc.type,
      collection: doc.collection,
      docId: doc.docId,
      data: doc.data,
      timestamp: doc.timestamp,
      clientId: doc.clientId,
      synced: doc.synced || false,
      vectorClock: doc.vectorClock || {},
    };
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    totalOperations: number;
    totalDocuments: number;
    unsyncedOperations: number;
  }> {
    const [totalOps, totalDocs, unsynced] = await Promise.all([
      this.operations.countDocuments(),
      this.documents.countDocuments({ deleted: { $ne: true } }),
      this.operations.countDocuments({ synced: false }),
    ]);

    return {
      totalOperations: totalOps,
      totalDocuments: totalDocs,
      unsyncedOperations: unsynced,
    };
  }

  /**
   * Compact operations (remove old synced operations)
   */
  async compact(olderThanDays: number = 30): Promise<number> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    
    const result = await this.operations.deleteMany({
      timestamp: { $lt: cutoff },
      synced: true,
    });

    console.log(`✓ Compacted ${result.deletedCount} old operations`);
    return result.deletedCount;
  }
}
