export { LocalFirstDB } from './database.js';
export type { Document, Operation, OperationType, VectorClock, } from './database.js';
export { SyncEngine } from './sync-engine.js';
export { compareVectorClocks } from './vector-clock.js';
import type { SyncEngine as SyncEngineType } from './sync-engine.js';
export type { SyncOptions, SyncProgress, SyncResult, } from './sync-engine.js';
export type { ClockRelation } from './vector-clock.js';
export { VERSION } from './version.js';
export declare function createDatabase(options: {
    name: string;
    serverUrl?: string;
    syncInterval?: number;
}): Promise<{
    db: import("./database.js").LocalFirstDB;
    sync: SyncEngineType | undefined;
}>;
//# sourceMappingURL=index.d.ts.map