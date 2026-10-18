import { fromUtf8, randomBytes, utf8 } from './encoding.ts';

export const IV_LENGTH = 12;

export interface EncryptedRecord {
  id: string;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
}

/**
 * Device data key: AES-GCM 256, created non-extractable. Stored as a CryptoKey object in IndexedDB
 * (structured clone), so no script, ours included, can ever read the raw key bytes.
 */
export function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts a JSON value with a fresh random 12-byte IV. The record id is bound as additional
 * authenticated data, so ciphertexts cannot be swapped between records unnoticed.
 */
export async function encryptJson(key: CryptoKey, id: string, value: unknown): Promise<EncryptedRecord> {
  const iv = randomBytes(IV_LENGTH);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(id) },
    key,
    utf8.encode(JSON.stringify(value)),
  );
  return { id, iv, ciphertext };
}

export async function decryptJson<T>(key: CryptoKey, record: EncryptedRecord): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: record.iv, additionalData: utf8.encode(record.id) },
    key,
    record.ciphertext,
  );
  return JSON.parse(fromUtf8.decode(plain)) as T;
}
