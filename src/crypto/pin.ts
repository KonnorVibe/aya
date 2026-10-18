import { equalBytes, fromBase64, randomBytes, toBase64, utf8 } from './encoding.ts';

/**
 * Optional app lock. The PIN is a UI barrier, not an encryption layer (see PLAN.md §2.1), so a
 * moderate iteration count keeps unlocking fast on an iPhone (< 150 ms).
 */
export const PIN_ITERATIONS = 100_000;
export const PIN_FREE_ATTEMPTS = 5;
const BASE_DELAY_MS = 30_000;
const MAX_DELAY_MS = 60 * 60_000;

export interface PinRecord {
  salt: string;
  hash: string;
  iterations: number;
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const base = await crypto.subtle.importKey('raw', utf8.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<PinRecord> {
  const salt = randomBytes(16);
  return { salt: toBase64(salt), hash: toBase64(await derive(pin, salt, iterations)), iterations };
}

export async function verifyPin(pin: string, record: PinRecord): Promise<boolean> {
  const hash = await derive(pin, fromBase64(record.salt), record.iterations);
  return equalBytes(hash, fromBase64(record.hash));
}

export interface LockoutState {
  failures: number;
  lastFailureAt?: number;
}

/** Wait time after a failed attempt: none for the first 5, then 30 s doubling up to 1 h. */
export function lockoutDelayMs(failures: number): number {
  if (failures < PIN_FREE_ATTEMPTS) return 0;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (failures - PIN_FREE_ATTEMPTS));
}

/** Milliseconds until the next attempt is allowed (0 = now). */
export function remainingLockoutMs(state: LockoutState, now: number): number {
  if (state.lastFailureAt === undefined) return 0;
  return Math.max(0, state.lastFailureAt + lockoutDelayMs(state.failures) - now);
}
