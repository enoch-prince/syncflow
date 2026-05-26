import { LocalFirstDB } from './database.js';
export interface SyncOptions {
    serverUrl: string;
    batchSize?: number;
    retryAttempts?: number;
    retryDelay?: number;
    onProgress?: (progress: SyncProgress) => void;
    onError?: (error: Error) => void;
}
export interface SyncProgress {
    phase: 'pull' | 'push' | 'idle';
    total: number;
    current: number;
    errors: number;
}
export interface SyncResult {
    success: boolean;
    pulled: number;
    pushed: number;
    conflicts: number;
    errors: string[];
}
export declare class SyncEngine {
    private db;
    private options;
    private isOnline;
    private isSyncing;
    private syncInterval?;
    private retryCount;
    constructor(db: LocalFirstDB, options: SyncOptions);
    startContinuousSync(intervalMs?: number): void;
    stopContinuousSync(): void;
    sync(): Promise<SyncResult>;
    private pull;
    private push;
    private handleSyncError;
    private setupNetworkListeners;
    private chunkArray;
    forceSyncNow(): Promise<SyncResult>;
    getSyncStatus(): {
        isOnline: boolean;
        isSyncing: boolean;
        retryCount: number;
    };
}
//# sourceMappingURL=sync-engine.d.ts.map