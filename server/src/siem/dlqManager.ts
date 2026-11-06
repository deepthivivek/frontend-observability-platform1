/**
 * Dead-Letter Queue (DLQ) Manager (Day 14)
 * Persists undeliverable webhook dispatches to a SQLite ledger with error codes
 * and failure timestamps, supporting batch redrive operations.
 */

import Database from 'better-sqlite3';
import { DeadLetterQueueItem } from '../../../src/types/compliance';

export class DLQManager {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dlq_ledger (
        id TEXT PRIMARY KEY,
        webhookId TEXT NOT NULL,
        destinationUrl TEXT NOT NULL,
        payload TEXT NOT NULL,
        errorCode TEXT NOT NULL,
        errorMessage TEXT NOT NULL,
        attemptCount INTEGER NOT NULL,
        failedAt INTEGER NOT NULL,
        status TEXT NOT NULL
      );
    `);
  }

  public recordFailure(item: Omit<DeadLetterQueueItem, 'id' | 'failedAt' | 'status'>): DeadLetterQueueItem {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const failedAt = Date.now();
    const status = 'PENDING_REDRIVE' as const;

    const record: DeadLetterQueueItem = {
      ...item,
      id,
      failedAt,
      status,
    };

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dlq_ledger (id, webhookId, destinationUrl, payload, errorCode, errorMessage, attemptCount, failedAt, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      record.id,
      record.webhookId,
      record.destinationUrl,
      JSON.stringify(record.payload),
      record.errorCode,
      record.errorMessage,
      record.attemptCount,
      record.failedAt,
      record.status
    );

    return record;
  }

  public getItems(statusFilter?: string): DeadLetterQueueItem[] {
    const stmt = statusFilter
      ? this.db.prepare('SELECT * FROM dlq_ledger WHERE status = ? ORDER BY failedAt DESC')
      : this.db.prepare('SELECT * FROM dlq_ledger ORDER BY failedAt DESC');

    const rows = statusFilter ? stmt.all(statusFilter) : stmt.all();

    return rows.map((r: any) => ({
      ...r,
      payload: JSON.parse(r.payload),
    }));
  }

  public markRedrived(id: string, success: boolean): void {
    const newStatus = success ? 'REDRIVED_SUCCESS' : 'PENDING_REDRIVE';
    const stmt = this.db.prepare('UPDATE dlq_ledger SET status = ? WHERE id = ?');
    stmt.run(newStatus, id);
  }

  public clearResolved(): void {
    this.db.prepare("DELETE FROM dlq_ledger WHERE status = 'REDRIVED_SUCCESS'").run();
  }
}

export const globalDLQManager = new DLQManager(':memory:');
