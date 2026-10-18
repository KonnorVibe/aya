import { decryptBackup, encryptBackup, BACKUP_ITERATIONS, BackupError } from '../crypto/backup.ts';
import { isISODate, todayLocal } from '../engine/dates.ts';
import type { DayLog, Settings } from '../engine/types.ts';
import type { Repository, Snapshot } from '../storage/repository.ts';

export const BACKUP_EXTENSION = '.aya';
export const BACKUP_MIME = 'application/octet-stream';

interface BackupPayload extends Snapshot {
  app: 'aya';
  exportedAt: string;
}

/** Builds an encrypted `.aya` backup of all health data and records the backup time. */
export async function createBackup(repo: Repository, password: string, iterations = BACKUP_ITERATIONS) {
  const payload: BackupPayload = { app: 'aya', exportedAt: new Date().toISOString(), ...repo.snapshot() };
  const file = await encryptBackup(payload, password, iterations);
  await repo.setMeta('lastBackupAt', payload.exportedAt);
  return { text: JSON.stringify(file), filename: `aya-backup-${todayLocal()}${BACKUP_EXTENSION}` };
}

function isPayload(value: unknown): value is BackupPayload {
  const p = value as Partial<BackupPayload> | null;
  return !!p && p.app === 'aya' && Array.isArray(p.dayLogs)
    && p.dayLogs.every((l: DayLog) => typeof l?.date === 'string' && isISODate(l.date))
    && (p.settings === undefined || typeof (p.settings as Settings).mode === 'string');
}

/** Decrypts a backup and replaces all data, re-encrypting it under this device's key. */
export async function restoreBackup(repo: Repository, text: string, password: string): Promise<number> {
  const payload = await decryptBackup<unknown>(text, password);
  if (!isPayload(payload)) throw new BackupError('invalid_file');
  await repo.replaceAll({ dayLogs: payload.dayLogs, ...(payload.settings ? { settings: payload.settings } : {}) });
  return payload.dayLogs.length;
}
