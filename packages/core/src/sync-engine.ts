/**
 * Sync Engine
 * 
 * Handles bidirectional synchronization between local database
 * and remote server with conflict resolution, retry logic, and
 * offline support.
 */

import { LocalFirstDB, Operation } from './database';

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

/**
 * Sync Engine for managing database synchronization
 */
export class SyncEngine {
  private db: LocalFirstDB;
  private options: Required<SyncOptions>;
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private retryCount: number = 0;

  constructor(db: LocalFirstDB, options: SyncOptions) {
    this.db = db;
    this.options = {
      batchSize: 100,
      retryAttempts: 3,
      retryDelay: 1000,
      onProgress: () => {},
      onError: () => {},
      ...options,
    };

    this.setupNetworkListeners();
  }

  /**
   * Start continuous sync
   */
  startContinuousSync(intervalMs: number = 30000): void {
    this.stopContinuousSync();
    
    // Initial sync
    this.sync();

    // Periodic sync
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.sync();
      }
    }, intervalMs);

    console.log(`✓ Continuous sync started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop continuous sync
   */
  stopContinuousSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
      console.log('✓ Continuous sync stopped');
    }
  }

  /**
   * Perform a single sync operation
   */
  async sync(): Promise<SyncResult> {
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
    const result: SyncResult = {
      success: true,
      pulled: 0,
      pushed: 0,
      conflicts: 0,
      errors: [],
    };

    try {
      console.log('🔄 Starting sync...');

      // Phase 1: Pull remote changes
      console.log('📥 Pulling from server...');
      const pullResult = await this.pull();
      result.pulled = pullResult.applied;
      result.conflicts += pullResult.conflicts;

      // Phase 2: Push local changes
      console.log('📤 Pushing to server...');
      const pushResult = await this.push();
      result.pushed = pushResult.sent;
      result.conflicts += pushResult.conflicts;

      console.log('✅ Sync completed:', result);
      this.retryCount = 0;

    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
      console.error('❌ Sync failed:', error);

      this.options.onError(error);
      await this.handleSyncError(error);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  /**
   * Pull changes from server
   */
  private async pull(): Promise<{ applied: number; conflicts: number }> {
    let applied = 0;
    let conflicts = 0;

    try {
      // Get last sync timestamp
      const lastSync = await this.db.getSyncState('last_pull_timestamp');
      const since = lastSync ? parseInt(lastSync, 10) : 0;

      // Fetch changes from server
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

      // Apply remote operations
      if (operations.length > 0) {
        await this.db.applyRemoteOperations(operations);
        applied = operations.length;
        conflicts = serverConflicts || 0;

        // Update last sync timestamp
        const latestTimestamp = Math.max(...operations.map((op: Operation) => op.timestamp));
        await this.db.setSyncState('last_pull_timestamp', latestTimestamp.toString());
      }

      console.log(`✓ Pulled ${applied} operations (${conflicts} conflicts)`);

    } catch (error) {
      console.error('Pull error:', error);
      throw error;
    }

    return { applied, conflicts };
  }

  /**
   * Push local changes to server
   */
  private async push(): Promise<{ sent: number; conflicts: number }> {
    let sent = 0;
    let conflicts = 0;

    try {
      // Get unsynced operations
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

      // Send to server in batches
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

        // Mark accepted operations as synced
        const acceptedIds = accepted.map((op: Operation) => op.id);
        await this.db.markSynced(acceptedIds);

        sent += acceptedIds.length;
        conflicts += batchConflicts?.length || 0;

        // Handle conflicts
        if (batchConflicts && batchConflicts.length > 0) {
          console.warn(`⚠️  ${batchConflicts.length} conflicts detected`);
          // Re-apply conflicting operations from server
          await this.db.applyRemoteOperations(batchConflicts);
        }
      }

      console.log(`✓ Pushed ${sent} operations (${conflicts} conflicts)`);

    } catch (error) {
      console.error('Push error:', error);
      throw error;
    }

    return { sent, conflicts };
  }

  /**
   * Handle sync errors with exponential backoff
   */
  private async handleSyncError(error: Error): Promise<void> {
    this.retryCount++;

    if (this.retryCount <= this.options.retryAttempts) {
      const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1);
      console.log(`Retrying in ${delay}ms (attempt ${this.retryCount}/${this.options.retryAttempts})...`);

      await new Promise(resolve => setTimeout(resolve, delay));
      
      if (this.isOnline) {
        await this.sync();
      }
    } else {
      console.error(`Max retry attempts (${this.options.retryAttempts}) reached`);
      this.retryCount = 0;
    }
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
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

  /**
   * Utility: chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Force immediate sync
   */
  async forceSyncNow(): Promise<SyncResult> {
    return await this.sync();
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    retryCount: number;
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      retryCount: this.retryCount,
    };
  }
}
