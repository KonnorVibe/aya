import { fromBase64, fromUtf8, randomBytes, toBase64, utf8 } from './encoding.ts';

/** Backup password KDF: slow on purpose, the file may leave the device. OWASP 2023 for PBKDF2-SHA256. */
export const BACKUP_ITERATIONS = 600_000;
export const BACKUP_FORMAT = 'aya-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number };
  salt: string;
  iv: string;
  ciphertext: string;
}

export type BackupErrorCode = 'invalid_file' | 'unsupported_version' | 'wrong_password';

export class BackupError extends Error {
  readonly code: BackupErrorCode;
  constructor(code: BackupErrorCode) {
    super(code);
    this.name = 'BackupError';
    this.code = code;
  }
}

async function passwordKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', utf8.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypts a payload with a key derived from the backup password (portable across devices). */
export async function encryptBackup(payload: unknown, password: string, iterations = BACKUP_ITERATIONS): Promise<BackupFile> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await passwordKey(password, salt, iterations);
  const header = { format: BACKUP_FORMAT, version: BACKUP_VERSION } as const;
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8.encode(`${header.format}:${header.version}`) },
    key,
    utf8.encode(JSON.stringify(payload)),
  );
  return {
    ...header,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations },
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError('invalid_file');
  }
  const f = data as Partial<BackupFile> | null;
  if (!f || f.format !== BACKUP_FORMAT || typeof f.salt !== 'string' || typeof f.iv !== 'string' || typeof f.ciphertext !== 'string') {
    throw new BackupError('invalid_file');
  }
  if (f.version !== BACKUP_VERSION) throw new BackupError('unsupported_version');
  const iterations = f.kdf?.iterations;
  if (f.kdf?.name !== 'PBKDF2' || f.kdf.hash !== 'SHA-256' || typeof iterations !== 'number' || iterations < 1) {
    throw new BackupError('invalid_file');
  }
  return f as BackupFile;
}

/** Decrypts a backup file's text. Throws BackupError on a bad file or wrong password. */
export async function decryptBackup<T>(text: string, password: string): Promise<T> {
  const file = parseBackup(text);
  let salt: Uint8Array<ArrayBuffer>, iv: Uint8Array<ArrayBuffer>, ciphertext: Uint8Array<ArrayBuffer>;
  try {
    [salt, iv, ciphertext] = [fromBase64(file.salt), fromBase64(file.iv), fromBase64(file.ciphertext)];
  } catch {
    throw new BackupError('invalid_file');
  }
  const key = await passwordKey(password, salt, file.kdf.iterations);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: utf8.encode(`${file.format}:${file.version}`) },
      key,
      ciphertext,
    );
  } catch {
    // AES-GCM cannot tell a wrong password from tampering; both mean "cannot open".
    throw new BackupError('wrong_password');
  }
  return JSON.parse(fromUtf8.decode(plain)) as T;
}
