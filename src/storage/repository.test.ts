// @vitest-environment node
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { WrongSecretError } from '../crypto/vault.ts';
import { createBackup, restoreBackup } from '../import-export/backup.ts';
import type { DayLog, Settings } from '../engine/types.ts';
import { Database, WeakPassphraseError, type ProtectionChoice } from './repository.ts';

let counter = 0;
const freshName = () => `aya-test-${++counter}`;
const ITER = 1000; // fast PBKDF2 for tests; production uses 600,000
const PASS = 'vier ganz normale woerter';

const settings: Settings = { mode: 'track', lockMinutes: 5, theme: 'system', defaultCycleLength: 30 };
const secretLog: DayLog = {
  date: '2026-03-14',
  flow: 'heavy',
  symptoms: ['cramps', 'migraine'],
  mood: ['anxious'],
  sex: [{ protected: false }],
  note: 'GEHEIMNOTIZ Arzttermin',
};
const MARKERS = ['GEHEIMNOTIZ', 'Arzttermin', 'heavy', 'cramps', 'migraine', 'anxious', '2026-03-14', '03-14', 'protected', 'track', PASS];

async function setup(choice: ProtectionChoice = { kind: 'device' }, name = freshName()) {
  const db = await Database.open(name, ITER);
  const { repo, recoveryCode } = await db.create(choice);
  return { name, db, repo, recoveryCode };
}

/** Everything IndexedDB holds, as text: structure, keys plus raw bytes decoded as UTF-8 and Latin-1. */
async function rawDump(name: string): Promise<string> {
  const db = await openDB(name);
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer);
      parts.push(new TextDecoder().decode(bytes), Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    } else if (value && typeof value === 'object') {
      for (const v of Object.values(value)) walk(v);
    } else parts.push(String(value));
  };
  for (const store of ['records', 'meta']) {
    parts.push(...(await db.getAllKeys(store)).map(String));
    for (const value of await db.getAll(store)) {
      parts.push(JSON.stringify(value, (_k, v) => (v instanceof ArrayBuffer || ArrayBuffer.isView(v) ? '[bytes]' : v)));
      walk(value);
    }
  }
  db.close();
  return parts.join('\n');
}

describe('device protection', () => {
  it('stores no plaintext health data and no dates in IndexedDB', async () => {
    const { name, db, repo } = await setup();
    await repo.saveDayLog(secretLog);
    await repo.saveSettings(settings);
    db.close();

    const dump = await rawDump(name);
    for (const marker of MARKERS) expect(dump).not.toContain(marker);

    const raw = await openDB(name);
    const records = await raw.getAll('records');
    expect(records).toHaveLength(2);
    for (const r of records) {
      expect(Object.keys(r).sort()).toEqual(['ciphertext', 'id', 'iv']);
      expect(r.id).toMatch(/^[0-9a-f]{64}$/);
    }
    raw.close();
  });

  it('keeps a non-extractable device key and reopens without a secret', async () => {
    const { name, db, repo } = await setup();
    await repo.saveDayLog(secretLog);
    await repo.saveSettings(settings);
    db.close();

    const raw = await openDB(name);
    const key = (await raw.get('keys', 'device-key')) as CryptoKey;
    raw.close();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();

    const again = await Database.open(name, ITER);
    expect(await again.protection()).toBe('device');
    const reopened = await again.unlock();
    expect(reopened.getDayLog('2026-03-14')).toEqual(secretLog);
    expect(reopened.settings()).toEqual(settings);
    again.close();
  });

  it('updates in place, deletes empty logs and sorts by date', async () => {
    const { db, repo } = await setup();
    await repo.saveDayLog({ date: '2026-03-02', flow: 'light' });
    await repo.saveDayLog({ date: '2026-03-01', mood: ['calm'] });
    await repo.saveDayLog({ date: '2026-03-02', flow: 'medium' });
    expect(repo.dayLogs().map((l) => [l.date, l.flow])).toEqual([['2026-03-01', undefined], ['2026-03-02', 'medium']]);
    await repo.saveDayLog({ date: '2026-03-01', mood: [] });
    expect(repo.dayLogs()).toHaveLength(1);
    db.close();
  });

  it('keeps meta separate and wipes everything including the keys', async () => {
    const { name, db, repo } = await setup();
    await repo.saveDayLog(secretLog);
    await repo.setMeta('lastBackupAt', '2026-01-01T00:00:00.000Z');
    expect(await repo.getMeta('lastBackupAt')).toBe('2026-01-01T00:00:00.000Z');
    await Database.wipe(name, db);

    const fresh = await Database.open(name, ITER);
    expect(await fresh.protection()).toBeUndefined();
    expect(await fresh.getMeta('lastBackupAt')).toBeUndefined();
    fresh.close();
  });
});

describe('passphrase protection', () => {
  it('needs the passphrase, accepts the recovery code and rejects anything else', async () => {
    const { name, db, repo, recoveryCode } = await setup({ kind: 'passphrase', passphrase: PASS });
    expect(recoveryCode).toMatch(/^[A-Z2-7]{26}$/);
    await repo.saveDayLog(secretLog);
    db.close();

    const raw = await openDB(name);
    expect(await raw.get('keys', 'device-key')).toBeUndefined();
    raw.close();
    for (const marker of MARKERS) expect(await rawDump(name)).not.toContain(marker);

    const again = await Database.open(name, ITER);
    expect(await again.protection()).toBe('passphrase');
    await expect(again.unlock()).rejects.toBeInstanceOf(WrongSecretError);
    await expect(again.unlock('falsch falsch falsch falsch')).rejects.toBeInstanceOf(WrongSecretError);
    expect((await again.unlock(PASS)).getDayLog('2026-03-14')).toEqual(secretLog);
    const spaced = recoveryCode!.toLowerCase().replace(/(.{4})/g, '$1 ');
    expect((await again.unlock(spaced)).getDayLog('2026-03-14')).toEqual(secretLog);
    again.close();
  });

  it('refuses a weak passphrase', async () => {
    const db = await Database.open(freshName(), ITER);
    await expect(db.create({ kind: 'passphrase', passphrase: 'kurz' })).rejects.toBeInstanceOf(WeakPassphraseError);
    db.close();
  });

  it('changes the passphrase without touching records and keeps the recovery code', async () => {
    const { name, db, repo, recoveryCode } = await setup({ kind: 'passphrase', passphrase: PASS });
    await repo.saveDayLog(secretLog);
    const before = await (await openDB(name)).getAll('records');
    await db.changePassphrase(PASS, 'ein neuer satz aus woertern');
    const after = await (await openDB(name)).getAll('records');
    expect(after).toEqual(before);
    await expect(db.unlock(PASS)).rejects.toBeInstanceOf(WrongSecretError);
    expect((await db.unlock('ein neuer satz aus woertern')).dayLogs()).toHaveLength(1);
    expect((await db.unlock(recoveryCode!)).dayLogs()).toHaveLength(1);
    db.close();
  });
});

describe('switching protection', () => {
  it('goes device → passphrase → device without losing or re-encrypting data', async () => {
    const { name, db, repo } = await setup();
    await repo.saveDayLog(secretLog);
    await repo.saveSettings(settings);
    await repo.setMeta('pin', { salt: 'x', hash: 'y', iterations: 1 });
    const records = async () => (await openDB(name)).getAll('records');
    const original = await records();

    const { recoveryCode } = await db.changeProtection({ kind: 'passphrase', passphrase: PASS });
    expect(recoveryCode).toBeTruthy();
    expect(await db.protection()).toBe('passphrase');
    expect(await db.getMeta('pin')).toBeUndefined();
    expect(await records()).toEqual(original);
    expect((await db.unlock(PASS)).getDayLog('2026-03-14')).toEqual(secretLog);

    await expect(db.changeProtection({ kind: 'device' }, 'falsch falsch falsch falsch')).rejects.toBeInstanceOf(WrongSecretError);
    await db.changeProtection({ kind: 'device' }, PASS);
    expect(await db.protection()).toBe('device');
    expect(await records()).toEqual(original);
    const back = await db.unlock();
    expect(back.getDayLog('2026-03-14')).toEqual(secretLog);
    expect(back.settings()).toEqual(settings);
    db.close();
  });

  it('renews the recovery code and invalidates the old one', async () => {
    const { db, recoveryCode } = await setup({ kind: 'passphrase', passphrase: PASS });
    const renewed = await db.changeProtection({ kind: 'passphrase', passphrase: PASS }, PASS);
    expect(renewed.recoveryCode).not.toBe(recoveryCode);
    await expect(db.unlock(recoveryCode!)).rejects.toBeInstanceOf(WrongSecretError);
    expect(await db.unlock(renewed.recoveryCode!)).toBeTruthy();
    db.close();
  });
});

describe('bulk writes', () => {
  it('upserts imported days without dropping others', async () => {
    const { db, repo } = await setup();
    await repo.saveDayLog({ date: '2026-01-01', flow: 'light' });
    await repo.upsertMany([{ date: '2026-01-01', flow: 'heavy' }, { date: '2026-01-02', flow: 'medium' }, { date: '2026-01-03' }]);
    expect(repo.dayLogs().map((l) => [l.date, l.flow])).toEqual([['2026-01-01', 'heavy'], ['2026-01-02', 'medium']]);
    const reopened = await db.unlock();
    expect(reopened.dayLogs()).toHaveLength(2);
    db.close();
  });
});

describe('backup export/import', () => {
  it('restores on another "device" in the other protection mode', async () => {
    const source = await setup();
    await source.repo.saveDayLog(secretLog);
    await source.repo.saveDayLog({ date: '2026-03-15', flow: 'medium' });
    await source.repo.saveSettings(settings);
    const { text, filename } = await createBackup(source.repo, 'Backup-Passwort', 1000);
    expect(filename).toMatch(/^aya-backup-\d{4}-\d{2}-\d{2}\.aya$/);
    expect(text).not.toContain('GEHEIMNOTIZ');
    expect(await source.repo.getMeta('lastBackupAt')).toBeTypeOf('string');
    source.db.close();

    const target = await setup({ kind: 'passphrase', passphrase: PASS });
    await target.repo.saveDayLog({ date: '2020-01-01', flow: 'light' });
    expect(await restoreBackup(target.repo, text, 'Backup-Passwort')).toBe(2);
    expect(target.repo.dayLogs().map((l) => l.date)).toEqual(['2026-03-14', '2026-03-15']);
    expect(target.repo.settings()).toEqual(settings);
    target.db.close();

    for (const marker of MARKERS) expect(await rawDump(target.name)).not.toContain(marker);
    const again = await Database.open(target.name, ITER);
    expect((await again.unlock(PASS)).getDayLog('2026-03-14')).toEqual(secretLog);
    again.close();
  });

  it('rejects a wrong password without touching data', async () => {
    const { db, repo } = await setup();
    await repo.saveDayLog(secretLog);
    const { text } = await createBackup(repo, 'richtig', 1000);
    await expect(restoreBackup(repo, text, 'falsch')).rejects.toMatchObject({ code: 'wrong_password' });
    expect(repo.dayLogs()).toHaveLength(1);
    db.close();
  });
});

describe('renewing the recovery code', () => {
  it('needs the passphrase itself, not the recovery code', async () => {
    const { db, recoveryCode } = await setup({ kind: 'passphrase', passphrase: PASS });
    await expect(db.renewRecovery(recoveryCode!)).rejects.toBeInstanceOf(WrongSecretError);
    const fresh = await db.renewRecovery(PASS);
    await expect(db.unlock(recoveryCode!)).rejects.toBeInstanceOf(WrongSecretError);
    expect(await db.unlock(fresh)).toBeTruthy();
    expect(await db.unlock(PASS)).toBeTruthy();
    db.close();
  });
});
