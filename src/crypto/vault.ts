import { base32Decode, base32Encode } from './base32.ts';
import { randomBytes, utf8 } from './encoding.ts';

/**
 * Key handling for the hybrid security model. Only the Web Crypto API is used.
 *
 * A random 64-byte master secret is created once: 32 bytes become the AES-GCM-256 data key for
 * all records, 32 bytes the HMAC-SHA-256 key that turns dates into opaque record ids. The master
 * secret is never stored in the clear. It is "wrapped" (encrypted with AES-GCM) by one of two
 * protections:
 *
 * - device: a non-extractable AES-GCM key generated in this browser and kept in IndexedDB. No
 *   script can read its bytes, so the data is bound to this device. An optional PIN is only a UI
 *   barrier on top (see pin.ts).
 * - passphrase: a key derived from the user's passphrase (PBKDF2-SHA-256, 600,000 iterations,
 *   random 16-byte salt) plus a second copy wrapped under a random 128-bit recovery code.
 *
 * Switching protection only re-wraps the master secret; records are never re-encrypted.
 * After unlocking, both working keys exist only as non-extractable CryptoKeys and the raw bytes
 * are overwritten.
 */
export const PBKDF2_ITERATIONS = 600_000;
export const MASTER_BYTES = 64;
const IV_BYTES = 12;
const SALT_BYTES = 16;
const RECOVERY_BYTES = 16;

export interface Wrapped {
  iv: Uint8Array<ArrayBuffer>;
  ct: Uint8Array<ArrayBuffer>;
}

export interface PasswordWrapped extends Wrapped {
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
}

export type Protection = 'device' | 'passphrase';

export type VaultHeader =
  | { version: 1; protection: 'device'; byDevice: Wrapped }
  | { version: 1; protection: 'passphrase'; byPassphrase: PasswordWrapped; byRecovery: PasswordWrapped };

export interface Keys {
  dataKey: CryptoKey;
  idKey: CryptoKey;
}

export class WrongSecretError extends Error {
  constructor() {
    super('wrong secret');
    this.name = 'WrongSecretError';
  }
}

const subtle = () => globalThis.crypto.subtle;

/** Passphrase rule: at least 4 words or 16 characters. Easy to explain, hard to guess offline. */
export function isStrongPassphrase(secret: string): boolean {
  return secret.trim().split(/\s+/).length >= 4 || secret.length >= 16;
}

export function newMaster(): Uint8Array<ArrayBuffer> {
  return randomBytes(MASTER_BYTES);
}

/** Device wrapping key: AES-GCM 256, non-extractable, stored as a CryptoKey object in IndexedDB. */
export function generateDeviceKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** 128 random bits, base32 (26 characters), shown once and written down by the user. */
export function newRecoveryCode(): string {
  return base32Encode(randomBytes(RECOVERY_BYTES));
}

/** One canonical string per code: decoding normalises spacing, case and look-alike characters. */
function canonicalRecovery(code: string): string {
  return base32Encode(base32Decode(code));
}

async function kek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', utf8.encode(secret.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function wrapWith(key: CryptoKey, master: Uint8Array<ArrayBuffer>, aad: string): Promise<Wrapped> {
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: utf8.encode(aad) }, key, master));
  return { iv, ct };
}

async function unwrapWith(key: CryptoKey, w: Wrapped, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: w.iv, additionalData: utf8.encode(aad) }, key, w.ct));
  } catch {
    throw new WrongSecretError();
  }
}

async function wrapWithSecret(master: Uint8Array<ArrayBuffer>, secret: string, aad: string, iterations: number): Promise<PasswordWrapped> {
  const salt = randomBytes(SALT_BYTES);
  return { salt, iterations, ...(await wrapWith(await kek(secret, salt, iterations), master, aad)) };
}

async function unwrapWithSecret(w: PasswordWrapped, secret: string, aad: string): Promise<Uint8Array<ArrayBuffer>> {
  return unwrapWith(await kek(secret, w.salt, w.iterations), w, aad);
}

/** Header wrapping the master under the device key. */
export async function deviceHeader(master: Uint8Array<ArrayBuffer>, deviceKey: CryptoKey): Promise<VaultHeader> {
  return { version: 1, protection: 'device', byDevice: await wrapWith(deviceKey, master, 'aya-device') };
}

/** Header wrapping the master under a passphrase and a recovery code. */
export async function passphraseHeader(
  master: Uint8Array<ArrayBuffer>, passphrase: string, recoveryCode: string, iterations = PBKDF2_ITERATIONS,
): Promise<VaultHeader> {
  const [byPassphrase, byRecovery] = await Promise.all([
    wrapWithSecret(master, passphrase, 'aya-passphrase', iterations),
    wrapWithSecret(master, canonicalRecovery(recoveryCode), 'aya-recovery', iterations),
  ]);
  return { version: 1, protection: 'passphrase', byPassphrase, byRecovery };
}

/** New passphrase, same recovery copy: only the passphrase wrap is replaced. */
export async function withNewPassphrase(
  header: Extract<VaultHeader, { protection: 'passphrase' }>, master: Uint8Array<ArrayBuffer>, passphrase: string,
  iterations = header.byPassphrase.iterations,
): Promise<VaultHeader> {
  return { ...header, byPassphrase: await wrapWithSecret(master, passphrase, 'aya-passphrase', iterations) };
}

/**
 * Recovers the master secret. Device mode needs the device key; passphrase mode accepts the
 * passphrase or, failing that, the recovery code. Throws WrongSecretError.
 */
export async function openMaster(header: VaultHeader, auth: { deviceKey: CryptoKey } | { secret: string }): Promise<Uint8Array<ArrayBuffer>> {
  if (header.protection === 'device') {
    if (!('deviceKey' in auth)) throw new WrongSecretError();
    return unwrapWith(auth.deviceKey, header.byDevice, 'aya-device');
  }
  if (!('secret' in auth)) throw new WrongSecretError();
  try {
    return await unwrapWithSecret(header.byPassphrase, auth.secret, 'aya-passphrase');
  } catch {
    let code: string;
    try {
      code = canonicalRecovery(auth.secret);
    } catch {
      throw new WrongSecretError();
    }
    return unwrapWithSecret(header.byRecovery, code, 'aya-recovery');
  }
}

/** Passphrase only, never the recovery code: used where the passphrase itself is re-used. */
export async function openMasterWithPassphrase(header: VaultHeader, passphrase: string): Promise<Uint8Array<ArrayBuffer>> {
  if (header.protection !== 'passphrase') throw new WrongSecretError();
  return unwrapWithSecret(header.byPassphrase, passphrase, 'aya-passphrase');
}

/** Imports the working keys as non-extractable CryptoKeys and wipes the raw bytes. */
export async function importKeys(master: Uint8Array<ArrayBuffer>): Promise<Keys> {
  try {
    const [dataKey, idKey] = await Promise.all([
      subtle().importKey('raw', master.slice(0, 32), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
      subtle().importKey('raw', master.slice(32, 64), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
    ]);
    return { dataKey, idKey };
  } finally {
    master.fill(0);
  }
}

/** Opaque, stable record id for a name (e.g. a date): HMAC-SHA-256 as hex. */
export async function recordId(keys: Keys, name: string): Promise<string> {
  const mac = new Uint8Array(await subtle().sign('HMAC', keys.idKey, utf8.encode(name)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
}
