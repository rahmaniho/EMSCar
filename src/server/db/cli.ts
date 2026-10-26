import { loadConfig } from '../config/env.ts';
import { AppDatabase } from './connection.ts';
import {
  runMigrations,
  rollbackLastMigration,
  getMigrationStatus,
} from './migrator.ts';
import { seedDevelopmentData } from './seed-dev.ts';
import { createDatabaseBackup } from './backup.ts';

const cmd = process.argv[2] ?? 'status';
const config = loadConfig();
const db = new AppDatabase(config.resolvedDbPath);

try {
  if (cmd === 'migrate') {
    const applied = runMigrations(db);
    console.log(
      applied.length > 0
        ? `مهاجرت‌های اعمال‌شده: ${applied.join(', ')}`
        : 'پایگاه داده به‌روز است (مهاجرت جدیدی وجود ندارد).'
    );
  } else if (cmd === 'rollback') {
    const rolledBack = rollbackLastMigration(db, {
      isProduction: config.isProduction,
      allowInProduction: process.argv.includes('--force-prod'),
    });
    console.log(
      rolledBack
        ? `مهاجرت بازگردانی شد: ${rolledBack}`
        : 'هیچ مهاجرتی برای بازگردانی وجود ندارد.'
    );
  } else if (cmd === 'status') {
    const st = getMigrationStatus(db);
    console.log('وضعیت مهاجرت‌های پایگاه داده:', JSON.stringify(st, null, 2));
  } else if (cmd === 'seed-dev') {
    runMigrations(db);
    const res = seedDevelopmentData(db, { isProduction: config.isProduction });
    console.log(res.message);
  } else if (cmd === 'backup') {
    const res = createDatabaseBackup(db, config.resolvedBackupDir);
    console.log('پشتیبان پایگاه داده ایجاد شد:', JSON.stringify(res, null, 2));
  } else {
    console.error(`دستور ناشناخته: ${cmd}`);
    process.exitCode = 1;
  }
} finally {
  db.close();
}
