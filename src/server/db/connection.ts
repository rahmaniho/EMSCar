import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export class AppDatabase {
  public readonly raw: DatabaseSync;
  public readonly dbPath: string;
  private txDepth = 0;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      fs.mkdirSync(dir, { recursive: true });
    }

    this.raw = new DatabaseSync(dbPath);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    if (dbPath !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL;');
    }
    this.raw.exec('PRAGMA busy_timeout = 5000;');
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  run(sql: string, ...params: SQLInputValue[]): RunResult {
    const stmt = this.raw.prepare(sql);
    const res = stmt.run(...params);
    return {
      changes: Number(res.changes),
      lastInsertRowid: Number(res.lastInsertRowid),
    };
  }

  get<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T | undefined {
    const stmt = this.raw.prepare(sql);
    const row = stmt.get(...params) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return { ...row } as T;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T[] {
    const stmt = this.raw.prepare(sql);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map((r) => ({ ...r }) as T);
  }

  /**
   * اجرای اتمیک تراکنش با قفل IMMEDIATE جهت جلوگیری کامل از Race Condition
   * در پذیرش مأموریت و پردازش Callbackهای پرداخت
   */
  transaction<T>(fn: () => T): T {
    if (this.txDepth === 0) {
      this.raw.exec('BEGIN IMMEDIATE;');
      this.txDepth++;
      try {
        const result = fn();
        this.raw.exec('COMMIT;');
        this.txDepth--;
        return result;
      } catch (err) {
        try {
          this.raw.exec('ROLLBACK;');
        } catch {
          // ignore secondary rollback failure
        }
        this.txDepth--;
        throw err;
      }
    } else {
      const sp = `sp_${this.txDepth}`;
      this.raw.exec(`SAVEPOINT ${sp};`);
      this.txDepth++;
      try {
        const result = fn();
        this.raw.exec(`RELEASE SAVEPOINT ${sp};`);
        this.txDepth--;
        return result;
      } catch (err) {
        try {
          this.raw.exec(`ROLLBACK TO SAVEPOINT ${sp};`);
          this.raw.exec(`RELEASE SAVEPOINT ${sp};`);
        } catch {
          // ignore
        }
        this.txDepth--;
        throw err;
      }
    }
  }

  close(): void {
    this.raw.close();
  }
}
