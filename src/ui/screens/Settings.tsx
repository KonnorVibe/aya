import { useState, type ReactNode } from 'react';
import type { ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import type { Mode, Settings as SettingsType } from '../../engine/types.ts';
import { de, formatLongDate } from '../../i18n/de.ts';
import { useApp } from '../../state/store.ts';
import { Button } from '../components/Button.tsx';
import { PinPad } from '../components/PinPad.tsx';
import { BackupPanel, DeletePanel, IcsPanel, RestorePanel } from './settings/DataPanels.tsx';
import { CsvExportPanel } from './settings/ImportPanels.tsx';
import type { ImportSource } from './ImportPage.tsx';
import { ChangePassphrasePanel, NewRecoveryPanel, RecoveryView, ToDevicePanel, ToPassphrasePanel } from './settings/ProtectionPanels.tsx';
import type { Protection } from '../../crypto/vault.ts';
import './Settings.css';

const LOCK_OPTIONS = [1, 5, 15] as const;
const FIRST_BIRTH_YEAR = 1920;
const t = de.settings;

const MODES: Mode[] = ['track', 'conceive', 'hormonal_contraception'];
const THEMES: SettingsType['theme'][] = ['system', 'light', 'dark'];
type Panel = 'backup' | 'restore' | 'csv' | 'ics' | 'delete' | 'changePass' | 'newRecovery';
/** File imports; the aya backup has its own place under Backup. */
const FILE_SOURCES: Exclude<ImportSource, 'backup'>[] = ['health', 'flo', 'other'];
const PROTECTIONS: Protection[] = ['device', 'passphrase'];

function Disclosure({ id, label, open, onToggle, children }: { id: string; label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="disclosure">
      <button type="button" className="row row-button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span>{label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open && <div id={id}>{children}</div>}
    </div>
  );
}

/** Changing or removing a PIN starts with the current one ('verify'). */
type PinFlow =
  | { step: 'verify'; then: 'change' | 'remove'; message?: string }
  | { step: 'enter' }
  | { step: 'confirm'; first: string; mismatch?: false }
  | { step: 'enter'; mismatch: true };

interface Props {
  prediction: Prediction | null;
  today: ISODate;
  onMethod: () => void;
  onImport: (source: ImportSource) => void;
}

export function Settings({ prediction, today, onMethod, onImport }: Props) {
  const settings = useApp((s) => s.settings)!;
  const pinSet = useApp((s) => s.pinSet);
  const passphraseMode = useApp((s) => s.protection) === 'passphrase';
  const updateSettings = useApp((s) => s.updateSettings);
  const setPin = useApp((s) => s.setPin);
  const removePin = useApp((s) => s.removePin);
  const checkPin = useApp((s) => s.checkPin);
  const protection = useApp((s) => s.protection) ?? 'device';
  const [target, setTarget] = useState<Protection | null>(null);
  const lastBackupAt = useApp((s) => s.lastBackupAt);
  const [flow, setFlow] = useState<PinFlow | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [newRecovery, setNewRecovery] = useState('');
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const thisYear = Number(today.slice(0, 4));

  if (flow) {
    const done = async (pin: string) => {
      if (flow.step === 'verify') {
        const r = await checkPin(pin);
        if (r.result !== 'ok') {
          const message = r.waitMs > 0 ? de.lock.wait(Math.ceil(r.waitMs / 1000)) : de.lock.wrong;
          return setFlow({ ...flow, message });
        }
        if (flow.then === 'change') return setFlow({ step: 'enter' });
        await removePin();
        return setFlow(null);
      }
      if (flow.step === 'enter') return setFlow({ step: 'confirm', first: pin });
      if (pin !== flow.first) return setFlow({ step: 'enter', mismatch: true });
      await setPin(pin);
      setFlow(null);
    };
    return (
      <main className="settings settings-pin">
        <PinPad
          key={flow.step + ('message' in flow ? (flow.message ?? '') : '')}
          title={flow.step === 'verify' ? t.currentPin : flow.step === 'enter' ? t.newPin : t.confirmPin}
          {...('mismatch' in flow && flow.mismatch ? { message: t.mismatch } : {})}
          {...(flow.step === 'verify' && flow.message ? { message: flow.message } : {})}
          onComplete={done}
        />
        <Button variant="quiet" onClick={() => setFlow(null)}>
          {t.cancel}
        </Button>
      </main>
    );
  }

  return (
    <main className="settings">
      <h1>{t.title}</h1>

      <section aria-labelledby="set-general">
        <h2 id="set-general">{t.generalSection}</h2>
        <fieldset className="choices">
          <legend className="row-legend">{t.mode}</legend>
          {MODES.map((m) => (
            <label key={m} className="choice">
              <input type="radio" name="mode" checked={settings.mode === m} onChange={() => void updateSettings({ mode: m })} />
              <span className="choice-text">
                <span className="choice-label">{de.onboarding.mode.options[m].label}</span>
                <span className="choice-hint">{de.onboarding.mode.options[m].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="row segmented">
          <legend className="visually-hidden">{t.themeLabel}</legend>
          <span aria-hidden="true">{t.themeLabel}</span>
          <span className="segmented-options">
            {THEMES.map((th) => (
              <label key={th}>
                <input type="radio" name="theme" checked={settings.theme === th} onChange={() => void updateSettings({ theme: th })} />
                <span>{de.theme[th]}</span>
              </label>
            ))}
          </span>
        </fieldset>

        <label className="row">
          <span>{t.birthYear}</span>
          <select
            value={settings.birthYear ?? ''}
            onChange={(e) => void updateSettings({ birthYear: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">{t.birthYearNone}</option>
            {Array.from({ length: thisYear - FIRST_BIRTH_YEAR + 1 }, (_, i) => thisYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <p className="row-hint">{t.birthYearHint}</p>
      </section>

      <section aria-labelledby="set-lock">
        <h2 id="set-lock">{t.lockSection}</h2>
        <fieldset className="choices" disabled={!!newRecovery}>
          <legend className="row-legend">{t.protection}</legend>
          {PROTECTIONS.map((p) => (
            <label key={p} className="choice">
              <input
                type="radio"
                name="protection"
                checked={(target ?? protection) === p}
                onChange={() => setTarget(p === protection ? null : p)}
              />
              <span className="choice-text">
                <span className="choice-label">{de.onboarding.protect[p].label}</span>
                <span className="choice-hint">{p === protection ? (passphraseMode ? t.protectionPassphraseHint : t.protectionDeviceHint) : de.onboarding.protect[p].hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        {target === 'passphrase' && !newRecovery && (
          <ToPassphrasePanel
            onCode={(code) => {
              setTarget(null);
              setNewRecovery(code);
            }}
          />
        )}
        {target === 'device' && <ToDevicePanel onClose={() => setTarget(null)} />}

        {!passphraseMode && (
          <>
            <div className="row">
              <span>{t.pin}</span>
              <span className="row-value">{pinSet ? t.pinOn : t.pinOff}</span>
            </div>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => setFlow(pinSet ? { step: 'verify', then: 'change' } : { step: 'enter' })}>
                {pinSet ? t.changePin : t.setPin}
              </Button>
              {pinSet && (
                <Button variant="quiet" onClick={() => setFlow({ step: 'verify', then: 'remove' })}>
                  {t.removePin}
                </Button>
              )}
            </div>
            <p className="row-hint">{t.pinHint}</p>
          </>
        )}

        {(pinSet || passphraseMode) && (
          <>
            <label className="row">
              <span>{t.autoLock}</span>
              <select
                value={settings.lockMinutes}
                onChange={(e) => void updateSettings({ lockMinutes: Number(e.target.value) })}
              >
                {LOCK_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {t.minutes(m)}
                  </option>
                ))}
              </select>
            </label>
            <p className="row-hint">{t.autoLockHint}</p>
          </>
        )}

        <label className="row">
          <span>{t.shield}</span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={!!settings.privacyShield}
            onChange={(e) => void updateSettings({ privacyShield: e.target.checked })}
          />
        </label>
        <p className="row-hint">{t.shieldHint}</p>

        {newRecovery ? (
          <RecoveryView
            code={newRecovery}
            onDone={() => {
              setNewRecovery('');
              setPanel(null);
            }}
          />
        ) : passphraseMode ? (
          <>
            <Disclosure id="panel-change-pass" label={t.changePassphrase} open={panel === 'changePass'} onToggle={() => toggle('changePass')}>
              <ChangePassphrasePanel />
            </Disclosure>
            <Disclosure id="panel-new-recovery" label={t.newRecovery} open={panel === 'newRecovery'} onToggle={() => toggle('newRecovery')}>
              <NewRecoveryPanel onClose={() => setPanel(null)} />
            </Disclosure>
          </>
        ) : null}
      </section>

      <section aria-labelledby="set-backup">
        <h2 id="set-backup">{t.backupSection}</h2>
        <p className="row-hint">{lastBackupAt ? t.backupLast(formatLongDate(lastBackupAt.slice(0, 10))) : t.backupNever}</p>
        <Disclosure id="panel-backup" label={t.backup} open={panel === 'backup'} onToggle={() => toggle('backup')}>
          <BackupPanel />
        </Disclosure>
        <Disclosure id="panel-restore" label={t.restore} open={panel === 'restore'} onToggle={() => toggle('restore')}>
          <RestorePanel />
        </Disclosure>
      </section>

      <section aria-labelledby="set-import">
        <h2 id="set-import">{t.importSection}</h2>
        <p className="row-hint">{t.importSectionHint}</p>
        {FILE_SOURCES.map((source) => (
          <button key={source} type="button" className="row row-button row-two-line" onClick={() => onImport(source)}>
            <span>
              <span className="row-title">{de.importPage.sources[source].label}</span>
              <span className="row-sub">{de.importPage.sources[source].hint}</span>
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </section>

      <section aria-labelledby="set-export">
        <h2 id="set-export">{t.exportSection}</h2>
        <Disclosure id="panel-csv" label={t.csvExport} open={panel === 'csv'} onToggle={() => toggle('csv')}>
          <CsvExportPanel />
        </Disclosure>
        <Disclosure id="panel-ics" label={t.ics} open={panel === 'ics'} onToggle={() => toggle('ics')}>
          <IcsPanel prediction={prediction} today={today} />
        </Disclosure>
      </section>

      <section aria-labelledby="set-delete">
        <h2 id="set-delete">{t.deleteSection}</h2>
        <Disclosure id="panel-delete" label={t.deleteAll} open={panel === 'delete'} onToggle={() => toggle('delete')}>
          <DeletePanel />
        </Disclosure>
      </section>

      <section aria-labelledby="set-about">
        <h2 id="set-about">{t.aboutSection}</h2>
        <p className="settings-disclaimer">{de.disclaimer}</p>
        <p className="row-hint">{t.privacy}</p>
        <p className="settings-links">
          <a
            href="#methodik"
            onClick={(e) => {
              e.preventDefault();
              onMethod();
            }}
          >
            {t.methodology}
          </a>
          <a href="./datenschutz.html">{t.privacyLink}</a>
          <a href="./impressum.html">{t.imprintLink}</a>
        </p>
      </section>
    </main>
  );
}
