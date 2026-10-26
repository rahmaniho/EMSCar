import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AppDatabase } from './connection.ts';

export interface MigrationRecord {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function ensureMigrationsTable(db: AppDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function getMigrationsDir(customDir?: string): string {
  return customDir ?? path.resolve(process.cwd(), 'migrations');
}

export function runMigrations(db: AppDatabase, customDir?: string): string[] {
  ensureMigrationsTable(db);
  const dir = getMigrationsDir(customDir);
  if (!fs.existsSync(dir)) {
    throw new Error(`پوشه مهاجرت پایگاه داده یافت نشد: ${dir}`);
  }

  const upFiles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();

  const applied = new Map<string, MigrationRecord>();
  for (const row of db.all<MigrationRecord>('SELECT * FROM schema_migrations ORDER BY version ASC')) {
    applied.set(row.version, row);
  }

  const executed: string[] = [];

  for (const file of upFiles) {
    const base = file.replace(/\.up\.sql$/, '');
    const [version, ...rest] = base.split('_');
    const name = rest.join('_') || base;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const checksum = sha256(sql);

    const existing = applied.get(version);
    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error(
          `عدم تطابق Checksum مهاجرت اعمال‌شده نسخه ${version} (${file}). تغییر فایل‌های مهاجرت تاریخی مجاز نیست.`
        );
      }
      continue;
    }

    db.transaction(() => {
      db.exec(sql);
      db.run(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
        version,
        name,
        checksum,
        new Date().toISOString()
      );
    });
    executed.push(file);
  }

  return executed;
}

export function rollbackLastMigration(
  db: AppDatabase,
  options?: { customDir?: string; allowInProduction?: boolean; isProduction?: boolean }
): string | null {
  if (options?.isProduction && !options?.allowInProduction) {
    throw new Error(
      'اجرای خودکار Rollback در محیط Production بدون تأیید صریح امنیتی مسدود است.'
    );
  }

  ensureMigrationsTable(db);
  const last = db.get<MigrationRecord>(
    'SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 1'
  );
  if (!last) return null;

  const dir = getMigrationsDir(options?.customDir);
  const downFile = `${last.version}_${last.name}.down.sql`;
  const downPath = path.join(dir, downFile);

  if (!fs.existsSync(downPath)) {
    throw new Error(`فایل بازگردانی مهاجرت یافت نشد: ${downFile}`);
  }

  const downSql = fs.readFileSync(downPath, 'utf8');
  db.transaction(() => {
    db.exec(downSql);
    db.run('DELETE FROM schema_migrations WHERE version = ?', last.version);
  });

  return downFile;
}

export function getMigrationStatus(db: AppDatabase, customDir?: string) {
  ensureMigrationsTable(db);
  const dir = getMigrationsDir(customDir);
  const upFiles = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.up.sql'))
        .sort()
    : [];
  const applied = db.all<MigrationRecord>('SELECT * FROM schema_migrations ORDER BY version ASC');
  return { availableUpFiles: upFiles, applied };
}
