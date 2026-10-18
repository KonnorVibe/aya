import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { decryptJson, encryptJson, generateDataKey, type EncryptedRecord } from '../crypto/aes.ts';
import type { LockoutState, PinRecord } from '../crypto/pin.ts';
import type { ISODate } from '../engine/dates.ts';
import type { DayLog, Settings } from '../engine/types.ts';

export const DB_NAME = 'aya';
const DATA_KEY_ID = 'data-key';
const SETTINGS_ID = 'settings';

/** Non-health app state. Kept unencrypted so the lock screen works before decryption. */
export interface Meta {
  pin?: PinRecord;
  lockout?: LockoutState;
  lastBackupAt?: string;
}

type Doc = { type: 'day'; data: DayLog } | { type: 'settings'; data: Settings };

interface AyaDB extends DBSchema {
  keys: { key: string; value: CryptoKey };
  /** Only {id, iv, ciphertext}. Ids are random, so not even the logged dates are visible. */
  records: { key: string; value: EncryptedRecord };
  meta: { key: string; value: unknown };
}

export interface Snapshot {
  dayLogs: DayLog[];
  settings?: Settings;
}

/** True when a log carries nothing besides its date. */
export function isEmptyLog(log: DayLog): boolean {
  return Object.entries(log).every(([k, v]) => k === 'date' || v === undefined || (Array.isArray(v) && !v.length) || v === '');
}

/**
 * Encrypted local store. Plaintext lives only in this object's memory; everything written to
 * IndexedDB is AES-GCM ciphertext under the non-extractable device key.
 */
export class Repository {
  private readonly ids = new Map<ISODate, string>();
  private readonly logs = new Map<ISODate, DayLog>();
  private currentSettings: Settings | undefined;

  private constructor(
    private readonly db: IDBPDatabase<AyaDB>,
    private readonly key: CryptoKey,
  ) {}

  /** Opens (or creates) the database and device key, then decrypts all records into memory. */
  static async open(name = DB_NAME): Promise<Repository> {
    const db = await openDB<AyaDB>(name, 1, {
      upgrade(d) {
        d.createObjectStore('keys');
        d.createObjectStore('records', { keyPath: 'id' });
        d.createObjectStore('meta');
      },
    });
    let key = await db.get('keys', DATA_KEY_ID);
    if (!key) {
      key = await generateDataKey();
      await db.put('keys', key, DATA_KEY_ID);
    }
    const repo = new Repository(db, key);
    await repo.load();
    return repo;
  }

  /** Deletes the whole database including the device key. Irreversible. */
  static async wipe(name = DB_NAME, open?: Repository): Promise<void> {
    open?.close();
    await deleteDB(name);
  }

  private async load(): Promise<void> {
    for (const record of await this.db.getAll('records')) {
      const doc = await decryptJson<Doc>(this.key, record);
      if (doc.type === 'day') {
        this.ids.set(doc.data.date, record.id);
        this.logs.set(doc.data.date, doc.data);
      } else {
        this.currentSettings = doc.data;
      }
    }
  }

  close(): void {
    this.db.close();
  }

  dayLogs(): DayLog[] {
    return [...this.logs.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  getDayLog(date: ISODate): DayLog | undefined {
    return this.logs.get(date);
  }

  /** Saves a day; a log without any content deletes the day instead. */
  async saveDayLog(log: DayLog): Promise<void> {
    if (isEmptyLog(log)) return this.deleteDayLog(log.date);
    const id = this.ids.get(log.date) ?? crypto.randomUUID();
    await this.db.put('records', await encryptJson(this.key, id, { type: 'day', data: log } satisfies Doc));
    this.ids.set(log.date, id);
    this.logs.set(log.date, log);
  }

  async deleteDayLog(date: ISODate): Promise<void> {
    const id = this.ids.get(date);
    if (id) await this.db.delete('records', id);
    this.ids.delete(date);
    this.logs.delete(date);
  }

  settings(): Settings | undefined {
    return this.currentSettings;
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.put('records', await encryptJson(this.key, SETTINGS_ID, { type: 'settings', data: settings } satisfies Doc));
    this.currentSettings = settings;
  }

  snapshot(): Snapshot {
    return { dayLogs: this.dayLogs(), ...(this.currentSettings ? { settings: this.currentSettings } : {}) };
  }

  /** Replaces all health data atomically (used by backup import). */
  async replaceAll(snapshot: Snapshot): Promise<void> {
    // Encrypt first: an IndexedDB transaction auto-commits while awaiting non-IDB promises.
    const ids = new Map(snapshot.dayLogs.map((l) => [l.date, crypto.randomUUID()]));
    const records = await Promise.all([
      ...snapshot.dayLogs.map((l) => encryptJson(this.key, ids.get(l.date)!, { type: 'day', data: l } satisfies Doc)),
      ...(snapshot.settings ? [encryptJson(this.key, SETTINGS_ID, { type: 'settings', data: snapshot.settings } satisfies Doc)] : []),
    ]);
    const tx = this.db.transaction('records', 'readwrite');
    await tx.store.clear();
    for (const r of records) await tx.store.put(r);
    await tx.done;

    this.ids.clear();
    this.logs.clear();
    for (const l of snapshot.dayLogs) {
      this.ids.set(l.date, ids.get(l.date)!);
      this.logs.set(l.date, l);
    }
    this.currentSettings = snapshot.settings;
  }

  async getMeta<K extends keyof Meta>(key: K): Promise<Meta[K]> {
    return (await this.db.get('meta', key)) as Meta[K];
  }

  async setMeta<K extends keyof Meta>(key: K, value: Meta[K]): Promise<void> {
    if (value === undefined) await this.db.delete('meta', key);
    else await this.db.put('meta', value, key);
  }
}

/** Asks the browser not to evict our storage (iOS may otherwise clear it). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
