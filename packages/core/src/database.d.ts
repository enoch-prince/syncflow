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
export declare class LocalFirstDB {
    private db;
    private clientId;
    private vectorClock;
    private operationHandlers;
    constructor(dbName: string);
    init(sqliteModule: any): Promise<void>;
    insert(collection: string, doc: any): Promise<Document>;
    update(collection: string, docId: string, updates: any): Promise<Document>;
    delete(collection: string, docId: string): Promise<void>;
    get(collection: string, docId: string): Promise<Document | null>;
    find(collection: string, filter?: any): Promise<Document[]>;
    getUnsyncedOperations(limit?: number): Promise<Operation[]>;
    applyRemoteOperations(operations: Operation[]): Promise<void>;
    markSynced(operationIds: string[]): Promise<void>;
    onChange(handler: (op: Operation) => void): () => void;
    getVectorClock(): VectorClock;
    getSyncState(key: string): Promise<string | null>;
    setSyncState(key: string, value: string): Promise<void>;
    private recordOperation;
    private applyOperation;
    private incrementClock;
    private mergeVectorClock;
    private getOrCreateClientId;
    private notifyHandlers;
}
//# sourceMappingURL=database.d.ts.map