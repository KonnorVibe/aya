// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, generateDataKey } from './aes.ts';
import { BackupError, decryptBackup, encryptBackup } from './backup.ts';
import { fromBase64, toBase64 } from './encoding.ts';
import { hashPin, lockoutDelayMs, remainingLockoutMs, verifyPin } from './pin.ts';

describe('AES-GCM records', () => {
  it('round-trips and uses a fresh IV each time', async () => {
    const key = await generateDataKey();
    const a = await encryptJson(key, 'r1', { note: 'hallo' });
    const b = await encryptJson(key, 'r1', { note: 'hallo' });
    expect(a.iv).toHaveLength(12);
    expect(toBase64(a.iv)).not.toBe(toBase64(b.iv));
    expect(await decryptJson(key, a)).toEqual({ note: 'hallo' });
  });

  it('creates a non-extractable key', async () => {
    const key = await generateDataKey();
    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('binds the ciphertext to its record id', async () => {
    const key = await generateDataKey();
    const r = await encryptJson(key, 'r1', 1);
    await expect(decryptJson(key, { ...r, id: 'r2' })).rejects.toThrow();
  });
});

describe('PIN', () => {
  it('verifies the right PIN only', async () => {
    const record = await hashPin('123456', 1000);
    expect(await verifyPin('123456', record)).toBe(true);
    expect(await verifyPin('123457', record)).toBe(false);
  });

  it('is fast enough at the default iteration count', async () => {
    const t = performance.now();
    await hashPin('123456');
    expect(performance.now() - t).toBeLessThan(1000);
  });

  it('waits only after 5 failures, doubling up to 1 h', () => {
    expect([0, 4, 5, 6, 7].map(lockoutDelayMs)).toEqual([0, 0, 30_000, 60_000, 120_000]);
    expect(lockoutDelayMs(50)).toBe(3_600_000);
    expect(remainingLockoutMs({ failures: 5, lastFailureAt: 1000 }, 11_000)).toBe(20_000);
    expect(remainingLockoutMs({ failures: 5, lastFailureAt: 1000 }, 40_000)).toBe(0);
    expect(remainingLockoutMs({ failures: 0 }, 0)).toBe(0);
  });
});

describe('backup crypto', () => {
  const payload = { dayLogs: [{ date: '2026-01-01', note: 'geheim' }] };

  it('round-trips with the password and hides the content', async () => {
    const file = await encryptBackup(payload, 'Sonne-Meer-42', 1000);
    expect(JSON.stringify(file)).not.toContain('geheim');
    expect(await decryptBackup(JSON.stringify(file), 'Sonne-Meer-42')).toEqual(payload);
  });

  it('uses 600k iterations by default', async () => {
    const file = await encryptBackup(payload, 'pw');
    expect(file.kdf.iterations).toBe(600_000);
    expect(await decryptBackup(JSON.stringify(file), 'pw')).toEqual(payload);
  });

  it('reports a wrong password, tampering and bad files', async () => {
    const file = await encryptBackup(payload, 'richtig', 1000);
    const code = (p: Promise<unknown>) => p.then(() => 'ok', (e: BackupError) => e.code);
    expect(await code(decryptBackup(JSON.stringify(file), 'falsch'))).toBe('wrong_password');

    const bytes = fromBase64(file.ciphertext);
    bytes[0] = bytes[0]! ^ 1;
    expect(await code(decryptBackup(JSON.stringify({ ...file, ciphertext: toBase64(bytes) }), 'richtig'))).toBe('wrong_password');

    expect(await code(decryptBackup('kein json', 'x'))).toBe('invalid_file');
    expect(await code(decryptBackup(JSON.stringify({ format: 'other' }), 'x'))).toBe('invalid_file');
    expect(await code(decryptBackup(JSON.stringify({ ...file, version: 99 }), 'x'))).toBe('unsupported_version');
  });
});
