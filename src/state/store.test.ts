// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildOnboarding } from './onboarding.ts';
import { shouldAutoLock } from './lock.ts';
import { createAppStore } from './store.ts';

let n = 0;
const db = () => `aya-store-${++n}`;

describe('buildOnboarding', () => {
  it('logs the last period up to today and keeps the answers as priors', () => {
    const r = buildOnboarding({ lastPeriodStart: '2026-10-14', cycleLength: 31, periodLength: 5, mode: 'conceive' }, '2026-10-16');
    expect(r.logs.map((l) => l.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
    expect(r.settings).toMatchObject({ mode: 'conceive', defaultCycleLength: 31, defaultPeriodLength: 5, lockMinutes: 5 });
  });

  it('works when everything is skipped', () => {
    const r = buildOnboarding({ mode: 'track' }, '2026-10-16');
    expect(r.logs).toEqual([]);
    expect(r.settings.defaultCycleLength).toBeUndefined();
  });

  it('ignores a start date in the future', () => {
    expect(buildOnboarding({ lastPeriodStart: '2026-11-01', mode: 'track' }, '2026-10-16').logs).toEqual([]);
  });
});

describe('shouldAutoLock', () => {
  it('locks after 60 s in the background or after the inactivity limit', () => {
    expect(shouldAutoLock({ lastActivityAt: 0, hiddenSince: 0 }, 59_000, 5)).toBe(false);
    expect(shouldAutoLock({ lastActivityAt: 0, hiddenSince: 0 }, 61_000, 5)).toBe(true);
    expect(shouldAutoLock({ lastActivityAt: 0 }, 4 * 60_000, 5)).toBe(false);
    expect(shouldAutoLock({ lastActivityAt: 0 }, 5 * 60_000 + 1, 5)).toBe(true);
  });
});

describe('app store', () => {
  it('goes from onboarding to ready and persists across restarts', async () => {
    const name = db();
    const a = createAppStore();
    await a.getState().init(name);
    expect(a.getState().status).toBe('onboarding');
    await a.getState().setupProtection({ kind: 'device' });
    await a.getState().completeOnboarding({ lastPeriodStart: '2026-10-10', mode: 'track' }, '2026-10-16');
    expect(a.getState().status).toBe('ready');
    expect(a.getState().logs).toHaveLength(5);

    const b = createAppStore();
    await b.getState().init(name);
    expect(b.getState().status).toBe('ready');
    expect(b.getState().settings?.mode).toBe('track');
  });

  it('locks with a PIN, rejects wrong PINs and enforces the wait after 5 failures', async () => {
    const name = db();
    const s = createAppStore();
    await s.getState().init(name);
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');
    await s.getState().setPin('246810');
    s.getState().lock();
    expect(s.getState().status).toBe('locked');

    const t = 1_000_000;
    for (let i = 0; i < 4; i++) expect(await s.getState().unlock('000000', t)).toEqual({ result: 'wrong', waitMs: 0 });
    expect(await s.getState().unlock('000000', t)).toEqual({ result: 'wrong', waitMs: 30_000 });
    expect(await s.getState().unlock('246810', t + 10_000)).toEqual({ result: 'wait', waitMs: 20_000 });
    expect(await s.getState().unlock('246810', t + 31_000)).toEqual({ result: 'ok' });
    expect(s.getState().status).toBe('ready');

    const restarted = createAppStore();
    await restarted.getState().init(name);
    expect(restarted.getState().status).toBe('locked');
  });

  it('starts onboarding over when it was left after choosing the protection', async () => {
    const name = db();
    const a = createAppStore();
    await a.getState().init(name);
    await a.getState().setupProtection({ kind: 'device' });

    const b = createAppStore();
    await b.getState().init(name);
    expect(b.getState().status).toBe('onboarding');
    expect(b.getState().protection).toBeUndefined();
    await b.getState().setupProtection({ kind: 'device' });
    await b.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');

    const c = createAppStore();
    await c.getState().init(name);
    expect(c.getState().status).toBe('ready');
  });

  it('checks the current PIN before it is changed or removed', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');
    await s.getState().setPin('246810');
    expect(await s.getState().checkPin('000000', 1_000)).toEqual({ result: 'wrong', waitMs: 0 });
    expect(await s.getState().checkPin('246810', 2_000)).toEqual({ result: 'ok' });
    expect(s.getState().pinSet).toBe(true);
  });

  it('does not lock without a PIN', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');
    s.getState().lock();
    expect(s.getState().status).toBe('ready');
    await s.getState().setPin('123456');
    await s.getState().removePin();
    s.getState().lock();
    expect(s.getState().status).toBe('ready');
  });
});

describe('period actions', () => {
  it('starts a period today and ends it, filling the days in between', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-10');
    await s.getState().startPeriod('2026-10-10');
    await s.getState().saveDayLog({ date: '2026-10-11', symptoms: ['cramps'] });
    await s.getState().endPeriod('2026-10-12');
    expect(s.getState().logs.map((l) => [l.date, l.flow, l.periodEnd ?? false])).toEqual([
      ['2026-10-10', 'medium', false],
      ['2026-10-11', 'medium', false],
      ['2026-10-12', 'medium', true],
    ]);
    expect(s.getState().logs[1]!.symptoms).toEqual(['cramps']);
  });

  it('keeps an existing heavier flow when starting', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-10');
    await s.getState().saveDayLog({ date: '2026-10-10', flow: 'heavy' });
    await s.getState().startPeriod('2026-10-10');
    expect(s.getState().logs[0]!.flow).toBe('heavy');
  });
});

describe('calendar actions', () => {
  it('toggles past period days and keeps other entries', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');
    await s.getState().saveDayLog({ date: '2026-09-02', mood: ['calm'] });
    await s.getState().togglePeriodDay('2026-09-02');
    expect(s.getState().logs[0]).toEqual({ date: '2026-09-02', mood: ['calm'], flow: 'medium' });
    await s.getState().togglePeriodDay('2026-09-02');
    expect(s.getState().logs[0]).toEqual({ date: '2026-09-02', mood: ['calm'] });
    await s.getState().togglePeriodDay('2026-09-03');
    await s.getState().togglePeriodDay('2026-09-03');
    expect(s.getState().logs).toHaveLength(1);
  });

  it('records included cycles once', async () => {
    const s = createAppStore();
    await s.getState().init(db());
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ mode: 'track' }, '2026-10-16');
    await s.getState().includeCycle('2026-05-01');
    await s.getState().includeCycle('2026-05-01');
    expect(s.getState().settings?.includedCycles).toEqual(['2026-05-01']);
  });
});

describe('data actions', () => {
  it('exports, restores elsewhere and wipes', async () => {
    const a = createAppStore();
    await a.getState().init(db());
    await a.getState().setupProtection({ kind: 'device' });
    await a.getState().completeOnboarding({ lastPeriodStart: '2026-10-01', mode: 'track' }, '2026-10-16');
    const { text } = await a.getState().exportBackup('lange-passphrase');
    expect(a.getState().lastBackupAt).toBeTypeOf('string');

    const b = createAppStore();
    await b.getState().init(db());
    await b.getState().setupProtection({ kind: 'device' });
    await b.getState().completeOnboarding({ mode: 'conceive' }, '2026-10-16');
    expect(await b.getState().importBackup(text, 'lange-passphrase')).toBe(5);
    expect(b.getState().settings?.mode).toBe('track');
    expect(b.getState().logs).toHaveLength(5);

    await b.getState().wipeAll();
    expect(b.getState().status).toBe('onboarding');
    expect(b.getState().logs).toEqual([]);
  });
});

describe('passphrase protection', () => {
  const PASS = 'vier ganz normale woerter';

  it('keeps data encrypted until unlocked and drops it again on lock', async () => {
    const name = db();
    const s = createAppStore();
    await s.getState().init(name, 1000);
    const { recoveryCode } = await s.getState().setupProtection({ kind: 'passphrase', passphrase: PASS });
    expect(recoveryCode).toMatch(/^[A-Z2-7]{26}$/);
    await s.getState().completeOnboarding({ lastPeriodStart: '2026-10-10', mode: 'track' }, '2026-10-16');
    expect(s.getState().status).toBe('ready');
    await expect(s.getState().setPin('123456')).rejects.toThrow();

    s.getState().lock();
    expect(s.getState().status).toBe('locked');
    expect(s.getState().logs).toEqual([]);
    expect(s.getState().settings).toBeUndefined();

    const r = createAppStore();
    await r.getState().init(name, 1000);
    expect(r.getState().status).toBe('locked');
    expect(r.getState().protection).toBe('passphrase');
    expect(r.getState().logs).toEqual([]);
    expect(await r.getState().unlock('falsch falsch falsch falsch', 0)).toEqual({ result: 'wrong', waitMs: 0 });
    expect(await r.getState().unlock(recoveryCode!, 0)).toEqual({ result: 'ok' });
    expect(r.getState().logs).toHaveLength(5);
    expect(r.getState().status).toBe('ready');
  });

  it('starts over after a reload between protection and cycle step', async () => {
    const name = db();
    const s = createAppStore();
    await s.getState().init(name, 1000);
    await s.getState().setupProtection({ kind: 'passphrase', passphrase: PASS });

    const r = createAppStore();
    await r.getState().init(name, 1000);
    expect(r.getState().status).toBe('onboarding');
    expect(r.getState().protection).toBeUndefined();
  });

  it('switches device → passphrase → device in the running app', async () => {
    const name = db();
    const s = createAppStore();
    await s.getState().init(name, 1000);
    await s.getState().setupProtection({ kind: 'device' });
    await s.getState().completeOnboarding({ lastPeriodStart: '2026-10-10', mode: 'track' }, '2026-10-16');
    await s.getState().setPin('246810');

    const { recoveryCode } = await s.getState().changeProtection({ kind: 'passphrase', passphrase: PASS });
    expect(recoveryCode).toBeTruthy();
    expect(s.getState().pinSet).toBe(false);
    await s.getState().saveDayLog({ date: '2026-10-16', mood: ['calm'] });

    const r = createAppStore();
    await r.getState().init(name, 1000);
    expect(r.getState().status).toBe('locked');
    await r.getState().unlock(PASS, 0);
    expect(r.getState().logs).toHaveLength(6);

    await r.getState().changeProtection({ kind: 'device' }, PASS);
    const t = createAppStore();
    await t.getState().init(name, 1000);
    expect(t.getState().status).toBe('ready');
    expect(t.getState().logs).toHaveLength(6);
  });
});
