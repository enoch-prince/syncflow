import type { Operation } from '@syncflow/core';
export interface PostgresSyncAdapterOptions {
    connectionString: string;
    schema?: string;
}
export declare class PostgresSyncAdapter {
    private pool;
    private schema;
    constructor(options: PostgresSyncAdapterOptions);
    initialize(): Promise<void>;
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
    getDocument(collection: string, docId: string): Promise<any | null>;
    queryDocuments(collection: string, filter?: any): Promise<any[]>;
    listenForChanges(callback: (op: Operation) => void): Promise<void>;
    private mapFromPostgres;
    getStats(): Promise<{
        totalOperations: number;
        totalDocuments: number;
        unsyncedOperations: number;
    }>;
    compact(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=index.d.ts.map