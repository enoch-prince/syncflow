import type { Operation } from '@syncflow/core';
export interface MongoSyncAdapterOptions {
    uri: string;
    dbName: string;
    operationsCollection?: string;
    documentsCollection?: string;
}
export declare class MongoSyncAdapter {
    private client;
    private db;
    private operations;
    private documents;
    private changeStream?;
    private options;
    constructor(options: MongoSyncAdapterOptions);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getChanges(since: number, limit?: number): Promise<{
        operations: Operation[];
        conflicts: Operation[];
    }>;
    acceptOperations(operations: Operation[], clientId: string): Promise<{
        accepted: Operation[];
        conflicts: Operation[];
    }>;
    private applyOperation;
    watchChanges(callback: (op: Operation) => void): void;
    getDocument(collection: string, docId: string): Promise<any | null>;
    queryDocuments(collection: string, filter?: any): Promise<any[]>;
    private mapFromMongo;
    getStats(): Promise<{
        totalOperations: number;
        totalDocuments: number;
        unsyncedOperations: number;
    }>;
    compact(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=index.d.ts.map