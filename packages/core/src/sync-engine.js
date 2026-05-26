"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncEngine = void 0;
class SyncEngine {
    constructor(db, options) {
        this.isOnline = navigator.onLine;
        this.isSyncing = false;
        this.retryCount = 0;
        this.db = db;
        this.options = {
            batchSize: 100,
            retryAttempts: 3,
            retryDelay: 1000,
            onProgress: () => { },
            onError: () => { },
            ...options,
        };
        this.setupNetworkListeners();
    }
    startContinuousSync(intervalMs = 30000) {
        this.stopContinuousSync();
        this.sync();
        this.syncInterval = setInterval(() => {
            if (this.isOnline && !this.isSyncing) {
                this.sync();
            }
        }, intervalMs);
        console.log(`✓ Continuous sync started (interval: ${intervalMs}ms)`);
    }
    stopContinuousSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = undefined;
            console.log('✓ Continuous sync stopped');
        }
    }
    async sync() {
        if (this.isSyncing) {
            console.log('Sync already in progress, skipping...');
            return {
                success: false,
                pulled: 0,
                pushed: 0,
                conflicts: 0,
                errors: ['Sync already in progress'],
            };
        }
        if (!this.isOnline) {
            console.log('Offline, queueing sync for when online...');
            return {
                success: false,
                pulled: 0,
                pushed: 0,
                conflicts: 0,
                errors: ['Device is offline'],
            };
        }
        this.isSyncing = true;
        const result = {
            success: true,
            pulled: 0,
            pushed: 0,
            conflicts: 0,
            errors: [],
        };
        try {
            console.log('🔄 Starting sync...');
            console.log('📥 Pulling from server...');
            const pullResult = await this.pull();
            result.pulled = pullResult.applied;
            result.conflicts += pullResult.conflicts;
            console.log('📤 Pushing to server...');
            const pushResult = await this.push();
            result.pushed = pushResult.sent;
            result.conflicts += pushResult.conflicts;
            console.log('✅ Sync completed:', result);
            this.retryCount = 0;
        }
        catch (error) {
            result.success = false;
            result.errors.push(error.message);
            console.error('❌ Sync failed:', error);
            this.options.onError(error);
            await this.handleSyncError(error);
        }
        finally {
            this.isSyncing = false;
        }
        return result;
    }
    async pull() {
        let applied = 0;
        let conflicts = 0;
        try {
            const lastSync = await this.db.getSyncState('last_pull_timestamp');
            const since = lastSync ? parseInt(lastSync, 10) : 0;
            const response = await fetch(`${this.options.serverUrl}/changes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    since,
                    limit: this.options.batchSize,
                    clientId: this.db['clientId'],
                    vectorClock: this.db.getVectorClock(),
                }),
            });
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const { operations, conflicts: serverConflicts } = data;
            this.options.onProgress({
                phase: 'pull',
                total: operations.length,
                current: 0,
                errors: 0,
            });
            if (operations.length > 0) {
                await this.db.applyRemoteOperations(operations);
                applied = operations.length;
                conflicts = serverConflicts || 0;
                const latestTimestamp = Math.max(...operations.map((op) => op.timestamp));
                await this.db.setSyncState('last_pull_timestamp', latestTimestamp.toString());
            }
            console.log(`✓ Pulled ${applied} operations (${conflicts} conflicts)`);
        }
        catch (error) {
            console.error('Pull error:', error);
            throw error;
        }
        return { applied, conflicts };
    }
    async push() {
        let sent = 0;
        let conflicts = 0;
        try {
            const operations = await this.db.getUnsyncedOperations(this.options.batchSize);
            if (operations.length === 0) {
                console.log('✓ No local changes to push');
                return { sent: 0, conflicts: 0 };
            }
            this.options.onProgress({
                phase: 'push',
                total: operations.length,
                current: 0,
                errors: 0,
            });
            const batches = this.chunkArray(operations, 50);
            for (const batch of batches) {
                const response = await fetch(`${this.options.serverUrl}/operations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operations: batch,
                        clientId: this.db['clientId'],
                    }),
                });
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                const result = await response.json();
                const { accepted, conflicts: batchConflicts } = result;
                const acceptedIds = accepted.map((op) => op.id);
                await this.db.markSynced(acceptedIds);
                sent += acceptedIds.length;
                conflicts += batchConflicts?.length || 0;
                if (batchConflicts && batchConflicts.length > 0) {
                    console.warn(`⚠️  ${batchConflicts.length} conflicts detected`);
                    await this.db.applyRemoteOperations(batchConflicts);
                }
            }
            console.log(`✓ Pushed ${sent} operations (${conflicts} conflicts)`);
        }
        catch (error) {
            console.error('Push error:', error);
            throw error;
        }
        return { sent, conflicts };
    }
    async handleSyncError(error) {
        this.retryCount++;
        if (this.retryCount <= this.options.retryAttempts) {
            const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1);
            console.log(`Retrying in ${delay}ms (attempt ${this.retryCount}/${this.options.retryAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            if (this.isOnline) {
                await this.sync();
            }
        }
        else {
            console.error(`Max retry attempts (${this.options.retryAttempts}) reached`);
            this.retryCount = 0;
        }
    }
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('🌐 Back online, syncing...');
            this.isOnline = true;
            this.sync();
        });
        window.addEventListener('offline', () => {
            console.log('📴 Gone offline');
            this.isOnline = false;
        });
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    async forceSyncNow() {
        return await this.sync();
    }
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            retryCount: this.retryCount,
        };
    }
}
exports.SyncEngine = SyncEngine;
//# sourceMappingURL=sync-engine.js.map