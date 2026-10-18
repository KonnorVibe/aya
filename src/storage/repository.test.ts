// @vitest-environment node
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { createBackup, restoreBackup } from '../import-export/backup.ts';
import type { DayLog, Settings } from '../engine/types.ts';
import { Repository } from './repository.ts';

let counter = 0;
const freshName = () => `aya-test-${++counter}`;

const settings: Settings = { mode: 'track', lockMinutes: 5, theme: 'system', defaultCycleLength: 30 };
const secretLog: DayLog = {
  date: '2026-03-14',
  flow: 'heavy',
  symptoms: ['cramps', 'migraine'],
  mood: ['anxious'],
  sex: [{ protected: false }],
  note: 'GEHEIMNOTIZ Arzttermin',
};
const MARKERS = ['GEHEIMNOTIZ', 'Arzttermin', 'heavy', 'cramps', 'migraine', 'anxious', '2026-03-14', 'protected', 'track'];

/** Everything IndexedDB holds, as text: structure plus raw bytes decoded as UTF-8 and Latin-1. */
async function rawDump(name: string): Promise<string> {
  const db = await openDB(name);
  const parts: string[] = [];
  for (const store of ['records', 'meta']) {
    for (const value of await db.getAll(store)) {
      parts.push(JSON.stringify(value, (_k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? '[bytes]' : v)));
      for (const field of Object.values(value as object)) {
        if (field instanceof ArrayBuffer || ArrayBuffer.isView(field)) {
          const bytes = new Uint8Array(field instanceof ArrayBuffer ? field : field.buffer);
          parts.push(new TextDecoder().decode(bytes), String.fromCharCode(...bytes));
        }
      }
    }
  }
  db.close();
  return parts.join('\n');
}

describe('Repository', () => {
  it('stores no plaintext health data in IndexedDB', async () => {
    const name = freshName();
    const repo = await Repository.open(name);
    await repo.saveDayLog(secretLog);
    await repo.saveSettings(settings);
    repo.close();

    const dump = await rawDump(name);
    for (const marker of MARKERS) expect(dump).not.toContain(marker);

    const db = await openDB(name);
    const records = await db.getAll('records');
    expect(records).toHaveLength(2);
    for (const r of records) expect(Object.keys(r).sort()).toEqual(['ciphertext', 'id', 'iv']);
    db.close();
  });

  it('persists a non-extractable device key and reloads data', async () => {
    const name = freshName();
    const repo = await Repository.open(name);
    await repo.saveDayLog(secretLog);
    await repo.saveSettings(settings);
    repo.close();

    const db = await openDB(name);
    const key = (await db.get('keys', 'data-key')) as CryptoKey;
    db.close();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();

    const reopened = await Repository.open(name);
    expect(reopened.getDayLog('2026-03-14')).toEqual(secretLog);
    expect(reopened.settings()).toEqual(settings);
    reopened.close();
  });

  it('updates in place, deletes empty logs and sorts by date', async () => {
    const repo = await Repository.open(freshName());
    await repo.saveDayLog({ date: '2026-03-02', flow: 'light' });
    await repo.saveDayLog({ date: '2026-03-01', mood: ['calm'] });
    await repo.saveDayLog({ date: '2026-03-02', flow: 'medium' });
    expect(repo.dayLogs().map((l) => [l.date, l.flow])).toEqual([['2026-03-01', undefined], ['2026-03-02', 'medium']]);
    await repo.saveDayLog({ date: '2026-03-01', mood: [] });
    expect(repo.dayLogs()).toHaveLength(1);
    repo.close();
  });

  it('keeps meta separate and wipes everything including the key', async () => {
    const name = freshName();
    const repo = await Repository.open(name);
    await repo.saveDayLog(secretLog);
    await repo.setMeta('lastBackupAt', '2026-01-01T00:00:00.000Z');
    expect(await repo.getMeta('lastBackupAt')).toBe('2026-01-01T00:00:00.000Z');
    await Repository.wipe(name, repo);

    const fresh = await Repository.open(name);
    expect(fresh.dayLogs()).toEqual([]);
    expect(await fresh.getMeta('lastBackupAt')).toBeUndefined();
    fresh.close();
  });
});

describe('backup export/import', () => {
  it('restores on another "device" with a different device key', async () => {
    const source = await Repository.open(freshName());
    await source.saveDayLog(secretLog);
    await source.saveDayLog({ date: '2026-03-15', flow: 'medium' });
    await source.saveSettings(settings);
    const { text, filename } = await createBackup(source, 'Backup-Passwort', 1000);
    expect(filename).toMatch(/^aya-backup-\d{4}-\d{2}-\d{2}\.aya$/);
    expect(text).not.toContain('GEHEIMNOTIZ');
    expect(await source.getMeta('lastBackupAt')).toBeTypeOf('string');
    source.close();

    const targetName = freshName();
    const target = await Repository.open(targetName);
    await target.saveDayLog({ date: '2020-01-01', flow: 'light' });
    expect(await restoreBackup(target, text, 'Backup-Passwort')).toBe(2);
    expect(target.dayLogs().map((l) => l.date)).toEqual(['2026-03-14', '2026-03-15']);
    expect(target.settings()).toEqual(settings);
    target.close();

    const dump = await rawDump(targetName);
    for (const marker of MARKERS) expect(dump).not.toContain(marker);
    const reopened = await Repository.open(targetName);
    expect(reopened.getDayLog('2026-03-14')).toEqual(secretLog);
    reopened.close();
  });

  it('rejects a wrong password without touching data', async () => {
    const source = await Repository.open(freshName());
    await source.saveDayLog(secretLog);
    const { text } = await createBackup(source, 'richtig', 1000);
    await expect(restoreBackup(source, text, 'falsch')).rejects.toMatchObject({ code: 'wrong_password' });
    expect(source.dayLogs()).toHaveLength(1);
    source.close();
  });
});
