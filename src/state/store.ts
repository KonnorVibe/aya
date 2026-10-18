import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { hashPin, remainingLockoutMs, verifyPin, type LockoutState } from '../crypto/pin.ts';
import { openPeriod } from '../engine/cycles.ts';
import { eachDay, type ISODate } from '../engine/dates.ts';
import type { DayLog, Settings } from '../engine/types.ts';
import { createBackup, restoreBackup } from '../import-export/backup.ts';
import { WrongSecretError, type Protection } from '../crypto/vault.ts';
import { Database, DB_NAME, Repository, requestPersistence, type ProtectionChoice } from '../storage/repository.ts';
import { buildOnboarding, type OnboardingInput } from './onboarding.ts';

export type Status = 'loading' | 'onboarding' | 'locked' | 'ready' | 'error';
export type UnlockResult = { result: 'ok' } | { result: 'wrong'; waitMs: number } | { result: 'wait'; waitMs: number };
export type { Protection };

export interface AppState {
  status: Status;
  logs: DayLog[];
  settings?: Settings | undefined;
  pinSet: boolean;
  /** Set once the vault exists. 'passphrase' = data stays encrypted until unlocked. */
  protection?: Protection | undefined;
  /** ISO timestamp of the last backup export. */
  lastBackupAt?: string | undefined;
  init: (dbName?: string, iterations?: number) => Promise<void>;
  /** First onboarding step: creates the vault. Returns the recovery code in passphrase mode. */
  setupProtection: (choice: ProtectionChoice) => Promise<{ recoveryCode?: string }>;
  /** Switches protection; `secret` = current passphrase or recovery code in passphrase mode. */
  changeProtection: (choice: ProtectionChoice, secret?: string) => Promise<{ recoveryCode?: string }>;
  changePassphrase: (current: string, next: string) => Promise<void>;
  renewRecovery: (passphrase: string) => Promise<string>;
  /** Adds or overwrites imported days. */
  importLogs: (logs: DayLog[]) => Promise<number>;
  completeOnboarding: (input: OnboardingInput, today: ISODate) => Promise<void>;
  /** Merges the patch; a key set to undefined is removed. */
  updateSettings: (patch: { [K in keyof Settings]?: Settings[K] | undefined }) => Promise<void>;
  saveDayLog: (log: DayLog) => Promise<void>;
  /** "Periode begonnen": today gets bleeding unless it already has some. */
  startPeriod: (today: ISODate) => Promise<void>;
  /** Quick back-entry: toggles bleeding on a past day, keeping everything else logged there. */
  togglePeriodDay: (date: ISODate) => Promise<void>;
  /** Counts a cycle flagged as a possible missed log after all. */
  includeCycle: (start: ISODate) => Promise<void>;
  /** "Periode beendet": fills the unlogged days of the open period and marks today as its end. */
  endPeriod: (today: ISODate) => Promise<void>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  /** Encrypts all data with the password; returns the file text and name. */
  exportBackup: (password: string) => Promise<{ text: string; filename: string }>;
  /** Replaces all data with the backup's content. Throws BackupError. */
  importBackup: (text: string, password: string) => Promise<number>;
  /** Deletes the database including the device key and starts over. */
  wipeAll: () => Promise<void>;
  lock: () => void;
  /** PIN in device mode, passphrase or recovery code in passphrase mode. */
  unlock: (secret: string, now?: number) => Promise<UnlockResult>;
  /** Milliseconds until the next attempt is allowed. */
  lockoutRemaining: (now?: number) => Promise<number>;
}

/**
 * App state. Plaintext health data lives only here and in the Repository's memory; every write
 * goes through the Repository, which encrypts before touching IndexedDB.
 */
export function createAppStore() {
  let repo: Repository | undefined;
  let database: Database | undefined;
  let name = DB_NAME;
  let kdfIterations: number | undefined;
  const need = () => {
    if (!repo) throw new Error('Repository not open');
    return repo;
  };

  return createStore<AppState>()((set, get) => ({
    status: 'loading',
    logs: [],
    pinSet: false,

    async init(dbName, iterations) {
      try {
        name = dbName ?? DB_NAME;
        kdfIterations = iterations;
        database = await Database.open(name, iterations);
        const protection = await database.protection();
        const lastBackupAt = await database.getMeta('lastBackupAt');
        const pinSet = protection === 'device' && !!(await database.getMeta('pin'));
        const base = { protection, pinSet, ...(lastBackupAt ? { lastBackupAt } : {}) };
        if (!protection) return set({ ...base, status: 'onboarding' });
        if (protection === 'passphrase') return set({ ...base, status: 'locked' });
        repo = await database.unlock();
        const settings = repo.settings();
        set({
          ...base,
          logs: repo.dayLogs(),
          status: !settings ? 'onboarding' : pinSet ? 'locked' : 'ready',
          ...(settings ? { settings } : {}),
        });
      } catch {
        set({ status: 'error' });
      }
    },

    async setupProtection(choice) {
      if (!database) throw new Error('Database not open');
      const created = await database.create(choice);
      repo = created.repo;
      set({ protection: choice.kind, pinSet: false });
      return created.recoveryCode ? { recoveryCode: created.recoveryCode } : {};
    },

    async changeProtection(choice, secret) {
      if (!database) throw new Error('Database not open');
      const result = await database.changeProtection(choice, secret);
      set({ protection: choice.kind, pinSet: false });
      return result;
    },

    async changePassphrase(current, next) {
      if (!database) throw new Error('Database not open');
      await database.changePassphrase(current, next);
    },

    async renewRecovery(passphrase) {
      if (!database) throw new Error('Database not open');
      return database.renewRecovery(passphrase);
    },

    async importLogs(logs) {
      const r = need();
      await r.upsertMany(logs);
      set({ logs: r.dayLogs() });
      return logs.length;
    },

    async completeOnboarding(input, today) {
      const r = need();
      const { settings, logs } = buildOnboarding(input, today);
      for (const log of logs) await r.saveDayLog(log);
      await r.saveSettings(settings);
      void requestPersistence();
      set({ settings, logs: r.dayLogs(), status: 'ready' });
    },

    async updateSettings(patch) {
      const r = need();
      const merged = Object.entries({ ...get().settings!, ...patch }).filter(([, v]) => v !== undefined);
      const settings = Object.fromEntries(merged) as unknown as Settings;
      await r.saveSettings(settings);
      set({ settings });
    },

    async saveDayLog(log) {
      const r = need();
      await r.saveDayLog(log);
      set({ logs: r.dayLogs() });
    },

    async startPeriod(today) {
      const r = need();
      const log = r.getDayLog(today) ?? { date: today };
      const bleeding = log.flow && log.flow !== 'spotting';
      if (!bleeding) await r.saveDayLog({ ...log, flow: 'medium' });
      set({ logs: r.dayLogs() });
    },

    async togglePeriodDay(date) {
      const r = need();
      const log = r.getDayLog(date) ?? { date };
      const bleeding = log.flow && log.flow !== 'spotting';
      const next = { ...log };
      if (bleeding) {
        delete next.flow;
        delete next.periodEnd;
      } else {
        next.flow = 'medium';
      }
      await r.saveDayLog(next);
      set({ logs: r.dayLogs() });
    },

    async includeCycle(start) {
      const included = get().settings?.includedCycles ?? [];
      if (!included.includes(start)) await get().updateSettings({ includedCycles: [...included, start] });
    },

    async endPeriod(today) {
      const r = need();
      const open = openPeriod(r.dayLogs(), today);
      if (!open) return;
      for (const date of eachDay(open.start, today)) {
        const log = r.getDayLog(date) ?? { date };
        const bleeding = log.flow && log.flow !== 'spotting';
        const next = { ...log, ...(bleeding ? {} : { flow: 'medium' as const }) };
        if (date === today) next.periodEnd = true;
        else delete next.periodEnd;
        await r.saveDayLog(next);
      }
      set({ logs: r.dayLogs() });
    },

    async setPin(pin) {
      if (get().protection !== 'device') throw new Error('PIN only in device mode');
      const r = need();
      await r.setMeta('pin', await hashPin(pin));
      await r.setMeta('lockout', undefined);
      set({ pinSet: true });
    },

    async removePin() {
      const r = need();
      await r.setMeta('pin', undefined);
      await r.setMeta('lockout', undefined);
      set({ pinSet: false });
    },

    async exportBackup(password) {
      const result = await createBackup(need(), password);
      set({ lastBackupAt: await need().getMeta('lastBackupAt') });
      return result;
    },

    async importBackup(text, password) {
      const r = need();
      const count = await restoreBackup(r, text, password);
      const settings = r.settings();
      set({ logs: r.dayLogs(), ...(settings ? { settings } : {}) });
      return count;
    },

    async wipeAll() {
      await Database.wipe(name, database);
      repo = undefined;
      database = undefined;
      set({ status: 'loading', logs: [], settings: undefined, pinSet: false, protection: undefined, lastBackupAt: undefined });
      await get().init(name, kdfIterations);
    },

    lock() {
      const { status, protection, pinSet } = get();
      if (status !== 'ready') return;
      if (protection === 'passphrase') {
        // Drop the keys and all plaintext; unlocking decrypts again.
        repo = undefined;
        set({ status: 'locked', logs: [], settings: undefined });
      } else if (pinSet) set({ status: 'locked' });
    },

    async lockoutRemaining(now = Date.now()) {
      const lockout = (await database?.getMeta('lockout')) ?? { failures: 0 };
      return remainingLockoutMs(lockout, now);
    },

    async unlock(secret, now = Date.now()) {
      const db = database;
      if (!db) throw new Error('Database not open');
      const passphraseMode = get().protection === 'passphrase';
      const record = passphraseMode ? undefined : await db.getMeta('pin');
      if (!passphraseMode && !record) {
        set({ status: 'ready' });
        return { result: 'ok' };
      }
      const lockout: LockoutState = (await db.getMeta('lockout')) ?? { failures: 0 };
      const waiting = remainingLockoutMs(lockout, now);
      if (waiting > 0) return { result: 'wait', waitMs: waiting };

      let ok = false;
      if (passphraseMode) {
        try {
          repo = await db.unlock(secret);
          ok = true;
        } catch (e) {
          if (!(e instanceof WrongSecretError)) throw e;
        }
      } else ok = await verifyPin(secret, record!);

      if (ok) {
        await db.setMeta('lockout', undefined);
        const r = need();
        const settings = r.settings();
        set({ logs: r.dayLogs(), status: settings ? 'ready' : 'onboarding', ...(settings ? { settings } : {}) });
        if (passphraseMode) void requestPersistence();
        return { result: 'ok' };
      }
      const next = { failures: lockout.failures + 1, lastFailureAt: now };
      await db.setMeta('lockout', next);
      return { result: 'wrong', waitMs: remainingLockoutMs(next, now) };
    },
  }));
}

export const appStore = createAppStore();

export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector);
}
