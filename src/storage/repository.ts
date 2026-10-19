import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { decryptJson, encryptJson, type EncryptedRecord } from '../crypto/aes.ts';
import type { LockoutState, PinRecord } from '../crypto/pin.ts';
import {
  deviceHeader, generateDeviceKey, importKeys, isStrongPassphrase, newMaster, newRecoveryCode, openMaster,
  passphraseHeader, PBKDF2_ITERATIONS, recordId, withNewPassphrase, openMasterWithPassphrase, type Keys, type VaultHeader,
} from '../crypto/vault.ts';
import type { ISODate } from '../engine/dates.ts';
import type { DayLog, Settings } from '../engine/types.ts';

export const DB_NAME = 'aya';
const DEVICE_KEY_ID = 'device-key';
const SETTINGS_NAME = 'settings';

/** Non-health app state. Kept unencrypted so the lock screen works before decryption. */
export interface Meta {
  vault?: VaultHeader;
  pin?: PinRecord;
  lockout?: LockoutState;
  lastBackupAt?: string;
  /** Set while onboarding runs after the vault exists; a reload then starts over. */
  setupPending?: true;
}

type Doc = { type: 'day'; data: DayLog } | { type: 'settings'; data: Settings };

interface AyaDB extends DBSchema {
  keys: { key: string; value: CryptoKey };
  /** Only {id, iv, ciphertext}. Ids are HMACs of the date, so not even the logged days are visible. */
  records: { key: string; value: EncryptedRecord };
  meta: { key: string; value: unknown };
}

export interface Snapshot {
  dayLogs: DayLog[];
  settings?: Settings;
}

export type ProtectionChoice = { kind: 'device' } | { kind: 'passphrase'; passphrase: string };

export class WeakPassphraseError extends Error {
  constructor() {
    super('weak passphrase');
    this.name = 'WeakPassphraseError';
  }
}

/** True when a log carries nothing besides its date. */
export function isEmptyLog(log: DayLog): boolean {
  return Object.entries(log).every(([k, v]) => k === 'date' || v === undefined || (Array.isArray(v) && !v.length) || v === '');
}

const dayName = (date: ISODate) => `day:${date}`;

/**
 * The IndexedDB database before and after unlocking: holds the vault header, the device key (in
 * device mode only) and the encrypted records. Creating, unlocking and switching protection
 * happen here; reading and writing health data happens in the Repository it hands out.
 */
export class Database {
  private constructor(
    readonly name: string,
    private readonly db: IDBPDatabase<AyaDB>,
    private readonly iterations: number,
  ) {}

  static async open(name = DB_NAME, iterations = PBKDF2_ITERATIONS): Promise<Database> {
    const db: IDBPDatabase<AyaDB> = await openDB<AyaDB>(name, 1, {
      upgrade(d) {
        d.createObjectStore('keys');
        d.createObjectStore('records', { keyPath: 'id' });
        d.createObjectStore('meta');
      },
      // Another instance wants to delete the database (restart of a half-done onboarding): let it.
      blocking() {
        db.close();
      },
    });
    return new Database(name, db, iterations);
  }

  /** Deletes the whole database including the keys. Irreversible. */
  static async wipe(name = DB_NAME, open?: Database): Promise<void> {
    open?.close();
    await deleteDB(name);
  }

  close(): void {
    this.db.close();
  }

  async getMeta<K extends keyof Meta>(key: K): Promise<Meta[K]> {
    return (await this.db.get('meta', key)) as Meta[K];
  }

  async setMeta<K extends keyof Meta>(key: K, value: Meta[K]): Promise<void> {
    if (value === undefined) await this.db.delete('meta', key);
    else await this.db.put('meta', value, key);
  }

  async protection(): Promise<VaultHeader['protection'] | undefined> {
    return (await this.getMeta('vault'))?.protection;
  }

  /** First setup: a new master secret under the chosen protection. */
  async create(choice: ProtectionChoice): Promise<{ repo: Repository; recoveryCode?: string }> {
    if (await this.getMeta('vault')) throw new Error('vault exists');
    const master = newMaster();
    const recoveryCode = await this.storeHeader(master.slice(), choice);
    const repo = await Repository.load(this.db, this, await importKeys(master));
    return { repo, ...(recoveryCode ? { recoveryCode } : {}) };
  }

  /** Device mode needs no secret; passphrase mode takes the passphrase or the recovery code. */
  async unlock(secret?: string): Promise<Repository> {
    const header = await this.getMeta('vault');
    if (!header) throw new Error('no vault');
    return Repository.load(this.db, this, await importKeys(await this.master(header, secret)));
  }

  /**
   * Switches protection (or renews the recovery code). Only the master secret is re-wrapped; the
   * records stay as they are. `secret` = the current passphrase or recovery code in passphrase mode.
   */
  async changeProtection(choice: ProtectionChoice, secret?: string): Promise<{ recoveryCode?: string }> {
    const header = await this.getMeta('vault');
    if (!header) throw new Error('no vault');
    const master = await this.master(header, secret);
    try {
      const recoveryCode = await this.storeHeader(master, choice);
      if (choice.kind === 'passphrase') await this.setMeta('pin', undefined);
      await this.setMeta('lockout', undefined);
      return recoveryCode ? { recoveryCode } : {};
    } finally {
      master.fill(0);
    }
  }

  /** Same passphrase, new recovery code; the old code stops working. Needs the passphrase itself. */
  async renewRecovery(passphrase: string): Promise<string> {
    const header = await this.getMeta('vault');
    if (header?.protection !== 'passphrase') throw new Error('not in passphrase mode');
    const master = await openMasterWithPassphrase(header, passphrase);
    const code = await this.storeHeader(master, { kind: 'passphrase', passphrase });
    return code!;
  }

  /** New passphrase, same recovery code. */
  async changePassphrase(current: string, next: string): Promise<void> {
    if (!isStrongPassphrase(next)) throw new WeakPassphraseError();
    const header = await this.getMeta('vault');
    if (header?.protection !== 'passphrase') throw new Error('not in passphrase mode');
    const master = await openMaster(header, { secret: current });
    try {
      await this.setMeta('vault', await withNewPassphrase(header, master, next, this.iterations));
    } finally {
      master.fill(0);
    }
  }

  private async master(header: VaultHeader, secret?: string) {
    if (header.protection === 'device') {
      const deviceKey = await this.db.get('keys', DEVICE_KEY_ID);
      if (!deviceKey) throw new Error('device key missing');
      return openMaster(header, { deviceKey });
    }
    return openMaster(header, { secret: secret ?? '' });
  }

  /** Writes the new header (and device key) in one transaction; returns a new recovery code if any. */
  private async storeHeader(master: Uint8Array<ArrayBuffer>, choice: ProtectionChoice): Promise<string | undefined> {
    let header: VaultHeader;
    let deviceKey: CryptoKey | undefined;
    let recoveryCode: string | undefined;
    try {
      if (choice.kind === 'device') {
        deviceKey = await generateDeviceKey();
        header = await deviceHeader(master, deviceKey);
      } else {
        if (!isStrongPassphrase(choice.passphrase)) throw new WeakPassphraseError();
        recoveryCode = newRecoveryCode();
        header = await passphraseHeader(master, choice.passphrase, recoveryCode, this.iterations);
      }
    } finally {
      master.fill(0);
    }
    // All crypto is done above: an IndexedDB transaction auto-commits while awaiting other promises.
    const tx = this.db.transaction(['keys', 'meta'], 'readwrite');
    if (deviceKey) await tx.objectStore('keys').put(deviceKey, DEVICE_KEY_ID);
    else await tx.objectStore('keys').delete(DEVICE_KEY_ID);
    await tx.objectStore('meta').put(header, 'vault');
    await tx.done;
    return recoveryCode;
  }
}

/**
 * Unlocked, encrypted store. Plaintext lives only in this object's memory; everything written to
 * IndexedDB is AES-GCM ciphertext under the data key, keyed by an HMAC of the date.
 */
export class Repository {
  private readonly ids = new Map<ISODate, string>();
  private readonly logs = new Map<ISODate, DayLog>();
  private currentSettings: Settings | undefined;
  private settingsId = '';

  private constructor(
    private readonly db: IDBPDatabase<AyaDB>,
    private readonly database: Database,
    private readonly keys: Keys,
  ) {}

  static async load(db: IDBPDatabase<AyaDB>, database: Database, keys: Keys): Promise<Repository> {
    const repo = new Repository(db, database, keys);
    repo.settingsId = await recordId(keys, SETTINGS_NAME);
    for (const record of await db.getAll('records')) {
      const doc = await decryptJson<Doc>(keys.dataKey, record);
      if (doc.type === 'day') {
        repo.ids.set(doc.data.date, record.id);
        repo.logs.set(doc.data.date, doc.data);
      } else {
        repo.currentSettings = doc.data;
      }
    }
    return repo;
  }

  private async idFor(date: ISODate): Promise<string> {
    return this.ids.get(date) ?? recordId(this.keys, dayName(date));
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
    const id = await this.idFor(log.date);
    await this.db.put('records', await encryptJson(this.keys.dataKey, id, { type: 'day', data: log } satisfies Doc));
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
    await this.db.put('records', await encryptJson(this.keys.dataKey, this.settingsId, { type: 'settings', data: settings } satisfies Doc));
    this.currentSettings = settings;
  }

  snapshot(): Snapshot {
    return { dayLogs: this.dayLogs(), ...(this.currentSettings ? { settings: this.currentSettings } : {}) };
  }

  /** Replaces all health data atomically (backup restore). */
  async replaceAll(snapshot: Snapshot): Promise<void> {
    await this.writeMany(snapshot.dayLogs, snapshot.settings, true);
  }

  /** Adds or overwrites the given days, keeping all others (data import). */
  async upsertMany(logs: readonly DayLog[]): Promise<void> {
    await this.writeMany(logs, undefined, false);
  }

  private async writeMany(logs: readonly DayLog[], settings: Settings | undefined, clear: boolean): Promise<void> {
    // Encrypt first: an IndexedDB transaction auto-commits while awaiting non-IDB promises.
    const kept = logs.filter((l) => !isEmptyLog(l));
    const ids = new Map<ISODate, string>();
    for (const l of kept) ids.set(l.date, await recordId(this.keys, dayName(l.date)));
    const records = await Promise.all([
      ...kept.map((l) => encryptJson(this.keys.dataKey, ids.get(l.date)!, { type: 'day', data: l } satisfies Doc)),
      ...(settings ? [encryptJson(this.keys.dataKey, this.settingsId, { type: 'settings', data: settings } satisfies Doc)] : []),
    ]);
    const tx = this.db.transaction('records', 'readwrite');
    if (clear) await tx.store.clear();
    for (const r of records) await tx.store.put(r);
    await tx.done;

    if (clear) {
      this.ids.clear();
      this.logs.clear();
      this.currentSettings = settings;
    }
    for (const l of kept) {
      this.ids.set(l.date, ids.get(l.date)!);
      this.logs.set(l.date, l);
    }
  }

  getMeta<K extends keyof Meta>(key: K): Promise<Meta[K]> {
    return this.database.getMeta(key);
  }

  setMeta<K extends keyof Meta>(key: K, value: Meta[K]): Promise<void> {
    return this.database.setMeta(key, value);
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
