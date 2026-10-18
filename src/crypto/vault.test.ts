// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { groupCode, normalizeRecoveryCode } from './base32.ts';
import {
  deviceHeader, generateDeviceKey, importKeys, isStrongPassphrase, newMaster, newRecoveryCode, openMaster,
  passphraseHeader, PBKDF2_ITERATIONS, recordId, WrongSecretError,
} from './vault.ts';

describe('vault', () => {
  it('accepts 4 words or 16 characters as a passphrase', () => {
    expect(isStrongPassphrase('kurz')).toBe(false);
    expect(isStrongPassphrase('drei mini worte')).toBe(false);
    expect(isStrongPassphrase('vier ganz kurze worte')).toBe(true);
    expect(isStrongPassphrase('sechzehnzeichen!')).toBe(true);
  });

  it('uses 600,000 PBKDF2 iterations by default', async () => {
    const header = await passphraseHeader(newMaster(), 'vier ganz kurze worte', newRecoveryCode());
    if (header.protection !== 'passphrase') throw new Error('wrong mode');
    expect(header.byPassphrase.iterations).toBe(PBKDF2_ITERATIONS);
    expect(header.byRecovery.iterations).toBe(PBKDF2_ITERATIONS);
    expect(header.byPassphrase.salt).not.toEqual(header.byRecovery.salt);
  });

  it('wraps without storing the master and binds each wrap to its kind', async () => {
    const master = newMaster();
    const copy = master.slice();
    const key = await generateDeviceKey();
    const header = await deviceHeader(master, key);
    expect(JSON.stringify(header)).not.toContain(JSON.stringify(Array.from(copy)));
    expect(await openMaster(header, { deviceKey: key })).toEqual(copy);
    await expect(openMaster(header, { deviceKey: await generateDeviceKey() })).rejects.toBeInstanceOf(WrongSecretError);
    await expect(openMaster(header, { secret: 'egal egal egal egal' })).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('wipes the raw master after importing non-extractable keys', async () => {
    const master = newMaster();
    const keys = await importKeys(master);
    expect(master.every((b) => b === 0)).toBe(true);
    expect(keys.dataKey.extractable).toBe(false);
    expect(keys.idKey.extractable).toBe(false);
  });

  it('derives stable, distinct record ids', async () => {
    const keys = await importKeys(newMaster());
    const a = await recordId(keys, 'day:2026-03-14');
    expect(a).toBe(await recordId(keys, 'day:2026-03-14'));
    expect(a).not.toBe(await recordId(keys, 'day:2026-03-15'));
    expect(a).not.toBe(await recordId(await importKeys(newMaster()), 'day:2026-03-14'));
  });

  it('formats and normalises recovery codes', () => {
    const code = newRecoveryCode();
    expect(code).toHaveLength(26);
    expect(normalizeRecoveryCode(groupCode(code).toLowerCase())).toBe(code);
  });
});
