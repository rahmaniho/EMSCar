import fs from 'node:fs';
import path from 'node:path';
import { AppDatabase } from './connection.ts';

export interface BackupResult {
  backupFilePath: string;
  sizeBytes: number;
  integrityCheck: string;
  createdAt: string;
}

export function createDatabaseBackup(
  db: AppDatabase,
  backupDir: string
): BackupResult {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `auto_emergency_backup_${timestamp}.db`;
  const targetPath = path.join(backupDir, filename);
  const escaped = targetPath.replace(/'/g, "''");

  db.exec(`VACUUM INTO '${escaped}';`);

  const checkDb = new AppDatabase(targetPath);
  const check = checkDb.get<{ integrity_check: string }>('PRAGMA integrity_check;');
  checkDb.close();

  const stats = fs.statSync(targetPath);
  return {
    backupFilePath: targetPath,
    sizeBytes: stats.size,
    integrityCheck: check?.integrity_check ?? 'unknown',
    createdAt: new Date().toISOString(),
  };
}
