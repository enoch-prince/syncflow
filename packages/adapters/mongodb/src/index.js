"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoSyncAdapter = void 0;
const mongodb_1 = require("mongodb");
const core_1 = require("@syncflow/core");
class MongoSyncAdapter {
    constructor(options) {
        this.options = {
            operationsCollection: 'operations',
            documentsCollection: 'documents',
            ...options,
        };
        this.client = new mongodb_1.MongoClient(this.options.uri);
    }
    async connect() {
        await this.client.connect();
        this.db = this.client.db(this.options.dbName);
        this.operations = this.db.collection(this.options.operationsCollection);
        this.documents = this.db.collection(this.options.documentsCollection);
        await this.operations.createIndex({ timestamp: 1, synced: 1 });
        await this.operations.createIndex({ id: 1 }, { unique: true });
        await this.operations.createIndex({ clientId: 1, timestamp: 1 });
        await this.documents.createIndex({ collection: 1, id: 1 }, { unique: true });
        console.log('✓ Connected to MongoDB');
    }
    async disconnect() {
        if (this.changeStream) {
            await this.changeStream.close();
        }
        await this.client.close();
        console.log('✓ Disconnected from MongoDB');
    }
    async getChanges(since, limit = 100) {
        const operations = await this.operations
            .find({
            timestamp: { $gt: since },
        })
            .sort({ timestamp: 1 })
            .limit(limit)
            .toArray();
        return {
            operations: operations.map(this.mapFromMongo),
            conflicts: [],
        };
    }
    async acceptOperations(operations, clientId) {
        const accepted = [];
        const conflicts = [];
        for (const op of operations) {
            try {
                const existing = await this.operations.findOne({ id: op.id });
                if (existing) {
                    accepted.push(op);
                    continue;
                }
                const docState = await this.documents.findOne({
                    collection: op.collection,
                    id: op.docId,
                });
                if (docState) {
                    const relation = (0, core_1.compareVectorClocks)(op.vectorClock, docState.vectorClock || {});
                    if (relation === 'before' || relation === 'concurrent') {
                        conflicts.push({
                            ...op,
                            data: docState.data,
                            vectorClock: docState.vectorClock,
                        });
                        continue;
                    }
                }
                await this.operations.insertOne({
                    ...op,
                    _id: op.id,
                    receivedAt: Date.now(),
                });
                await this.applyOperation(op);
                accepted.push(op);
            }
            catch (error) {
                console.error(`Error processing operation ${op.id}:`, error);
            }
        }
        return { accepted, conflicts };
    }
    async applyOperation(op) {
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
        let newData;
        let newRev = 1;
        if (existing) {
            newRev = (existing.rev || 0) + 1;
            if (op.type === 'update') {
                newData = { ...existing.data, ...op.data };
            }
            else {
                newData = op.data;
            }
        }
        else {
            newData = op.data;
        }
        await this.documents.updateOne(docQuery, {
            $set: {
                data: newData,
                rev: newRev,
                deleted: false,
                vectorClock: op.vectorClock,
                updatedAt: op.timestamp,
            },
        }, { upsert: true });
    }
    watchChanges(callback) {
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
    async getDocument(collection, docId) {
        const doc = await this.documents.findOne({
            collection,
            id: docId,
            deleted: { $ne: true },
        });
        return doc ? doc.data : null;
    }
    async queryDocuments(collection, filter) {
        const query = {
            collection,
            deleted: { $ne: true },
        };
        if (filter) {
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
    mapFromMongo(doc) {
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
    async getStats() {
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
    async compact(olderThanDays = 30) {
        const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
        const result = await this.operations.deleteMany({
            timestamp: { $lt: cutoff },
        });
        console.log(`✓ Compacted ${result.deletedCount} old operations`);
        return result.deletedCount;
    }
}
exports.MongoSyncAdapter = MongoSyncAdapter;
//# sourceMappingURL=index.js.map