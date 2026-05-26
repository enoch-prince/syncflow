/**
 * Sync Server
 * 
 * Express server that handles sync requests from clients
 * and routes them to appropriate database adapters.
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import type { Operation } from '@syncflow/core';

export interface ServerConfig {
  port: number;
  adapter: 'mongodb' | 'postgres';
  mongoUri?: string;
  mongoDbName?: string;
  postgresConnectionString?: string;
}

export class SyncServer {
  private app: express.Application;
  private adapter: any;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private async initializeAdapter(): Promise<void> {
    if (this.adapter) {
      return;
    }

    if (this.config.adapter === 'mongodb') {
      if (!this.config.mongoUri || !this.config.mongoDbName) {
        throw new Error('MongoDB URI and database name required');
      }

      const { MongoSyncAdapter } = await import('@syncflow/mongodb');
      this.adapter = new MongoSyncAdapter({
        uri: this.config.mongoUri,
        dbName: this.config.mongoDbName,
      });
      return;
    }

    if (!this.config.postgresConnectionString) {
      throw new Error('PostgreSQL connection string required');
    }

    const { PostgresSyncAdapter } = await import('@syncflow/postgres');
    this.adapter = new PostgresSyncAdapter({
      connectionString: this.config.postgresConnectionString,
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      console.error('Server error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', adapter: this.config.adapter });
    });

    // Get changes (pull)
    this.app.post('/changes', async (req, res) => {
      try {
        const { since = 0, limit = 100, clientId, vectorClock } = req.body;

        console.log(`📥 Client ${clientId} pulling changes since ${since}`);

        const result = await this.adapter.getChanges(since, limit);

        res.json(result);
      } catch (error: any) {
        console.error('Error getting changes:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Accept operations (push)
    this.app.post('/operations', async (req, res) => {
      try {
        const { operations, clientId } = req.body;

        if (!Array.isArray(operations) || !clientId) {
          return res.status(400).json({ error: 'Invalid request body' });
        }

        console.log(`📤 Client ${clientId} pushing ${operations.length} operations`);

        const result = await this.adapter.acceptOperations(operations, clientId);

        res.json(result);
      } catch (error: any) {
        console.error('Error accepting operations:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get document by ID
    this.app.get('/documents/:collection/:id', async (req, res) => {
      try {
        const { collection, id } = req.params;

        const doc = await this.adapter.getDocument(collection, id);

        if (!doc) {
          return res.status(404).json({ error: 'Document not found' });
        }

        res.json(doc);
      } catch (error: any) {
        console.error('Error getting document:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Query documents
    this.app.post('/documents/:collection/query', async (req, res) => {
      try {
        const { collection } = req.params;
        const { filter } = req.body;

        const docs = await this.adapter.queryDocuments(collection, filter);

        res.json({ documents: docs, count: docs.length });
      } catch (error: any) {
        console.error('Error querying documents:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get statistics
    this.app.get('/stats', async (req, res) => {
      try {
        const stats = await this.adapter.getStats();
        res.json(stats);
      } catch (error: any) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Compact old operations
    this.app.post('/compact', async (req, res) => {
      try {
        const { olderThanDays = 30 } = req.body;

        const deleted = await this.adapter.compact(olderThanDays);

        res.json({
          message: 'Compaction completed',
          deletedCount: deleted,
        });
      } catch (error: any) {
        console.error('Error compacting:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.initializeAdapter();

      if (typeof this.adapter.connect === 'function') {
        await this.adapter.connect();
      } else if (typeof this.adapter.initialize === 'function') {
        await this.adapter.initialize();
      } else {
        throw new Error('Adapter does not support initialization');
      }

      // Start HTTP server
      this.app.listen(this.config.port, () => {
        console.log(`
╔════════════════════════════════════════════════════╗
║  🚀 Sync Server Started                           ║
║  Port: ${this.config.port}                                       ║
║  Adapter: ${this.config.adapter.toUpperCase().padEnd(37)} ║
╚════════════════════════════════════════════════════╝
        `);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async stop(): Promise<void> {
    console.log('\n🛑 Shutting down...');
    await this.adapter.disconnect();
    process.exit(0);
  }
}

// CLI entry point
if (typeof require !== 'undefined' && (require as any).main === module) {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    adapter: (process.env.ADAPTER as 'mongodb' | 'postgres') || 'mongodb',
    mongoUri: process.env.MONGO_URI,
    mongoDbName: process.env.MONGO_DB_NAME || 'local_first_db',
    postgresConnectionString: process.env.POSTGRES_CONNECTION_STRING,
  };

  const server = new SyncServer(config);

  // Handle shutdown
  process.on('SIGINT', () => server.stop());
  process.on('SIGTERM', () => server.stop());

  server.start();
}

export default SyncServer;
