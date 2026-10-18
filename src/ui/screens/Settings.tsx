import { useState, type ReactNode } from 'react';
import type { ISODate } from '../../engine/dates.ts';
import type { Prediction } from '../../engine/prediction.ts';
import type { Mode, Settings as SettingsType } from '../../engine/types.ts';
import { de, formatLongDate } from '../../i18n/de.ts';
import { useApp } from '../../state/store.ts';
import { Button } from '../components/Button.tsx';
import { PinPad } from '../components/PinPad.tsx';
import { BackupPanel, DeletePanel, IcsPanel, RestorePanel } from './settings/DataPanels.tsx';
import { ChangePassphrasePanel, NewRecoveryPanel, ToDevicePanel, ToPassphrasePanel } from './settings/ProtectionPanels.tsx';
import './Settings.css';

const LOCK_OPTIONS = [1, 5, 15] as const;
const t = de.settings;

const MODES: Mode[] = ['track', 'conceive', 'hormonal_contraception'];
const THEMES: SettingsType['theme'][] = ['system', 'light', 'dark'];
type Panel = 'backup' | 'restore' | 'ics' | 'delete' | 'toPassphrase' | 'toDevice' | 'changePass' | 'newRecovery';

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

type PinFlow = { step: 'enter' } | { step: 'confirm'; first: string; mismatch?: false } | { step: 'enter'; mismatch: true };

export function Settings({ prediction, today }: { prediction: Prediction | null; today: ISODate }) {
  const settings = useApp((s) => s.settings)!;
  const pinSet = useApp((s) => s.pinSet);
  const passphraseMode = useApp((s) => s.protection) === 'passphrase';
  const updateSettings = useApp((s) => s.updateSettings);
  const setPin = useApp((s) => s.setPin);
  const removePin = useApp((s) => s.removePin);
  const lastBackupAt = useApp((s) => s.lastBackupAt);
  const [flow, setFlow] = useState<PinFlow | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const thisYear = Number(today.slice(0, 4));

  if (flow) {
    const done = async (pin: string) => {
      if (flow.step === 'enter') return setFlow({ step: 'confirm', first: pin });
      if (pin !== flow.first) return setFlow({ step: 'enter', mismatch: true });
      await setPin(pin);
      setFlow(null);
    };
    return (
      <main className="settings settings-pin">
        <PinPad
          key={flow.step}
          title={flow.step === 'enter' ? t.newPin : t.confirmPin}
          {...('mismatch' in flow && flow.mismatch ? { message: t.mismatch } : {})}
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
            {Array.from({ length: 50 }, (_, i) => thisYear - 12 - i).map((y) => (
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
        <div className="row">
          <span>{t.protection}</span>
          <span className="row-value">{passphraseMode ? t.protectionPassphrase : t.protectionDevice}</span>
        </div>
        <p className="row-hint">{passphraseMode ? t.protectionPassphraseHint : t.protectionDeviceHint}</p>

        {!passphraseMode && (
          <>
            <div className="row">
              <span>{t.pin}</span>
              <span className="row-value">{pinSet ? t.pinOn : t.pinOff}</span>
            </div>
            <div className="row-actions">
              <Button variant="secondary" onClick={() => setFlow({ step: 'enter' })}>
                {pinSet ? t.changePin : t.setPin}
              </Button>
              {pinSet && (
                <Button variant="quiet" onClick={() => void removePin()}>
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

        {passphraseMode ? (
          <>
            <Disclosure id="panel-change-pass" label={t.changePassphrase} open={panel === 'changePass'} onToggle={() => toggle('changePass')}>
              <ChangePassphrasePanel />
            </Disclosure>
            <Disclosure id="panel-new-recovery" label={t.newRecovery} open={panel === 'newRecovery'} onToggle={() => toggle('newRecovery')}>
              <NewRecoveryPanel onClose={() => setPanel(null)} />
            </Disclosure>
            <Disclosure id="panel-to-device" label={t.toDevice} open={panel === 'toDevice'} onToggle={() => toggle('toDevice')}>
              <ToDevicePanel onClose={() => setPanel(null)} />
            </Disclosure>
          </>
        ) : (
          <Disclosure id="panel-to-pass" label={t.toPassphrase} open={panel === 'toPassphrase'} onToggle={() => toggle('toPassphrase')}>
            <ToPassphrasePanel onClose={() => setPanel(null)} />
          </Disclosure>
        )}
      </section>

      <section aria-labelledby="set-data">
        <h2 id="set-data">{t.dataSection}</h2>
        <p className="row-hint">{lastBackupAt ? t.backupLast(formatLongDate(lastBackupAt.slice(0, 10))) : t.backupNever}</p>
        <Disclosure id="panel-backup" label={t.backup} open={panel === 'backup'} onToggle={() => toggle('backup')}>
          <BackupPanel />
        </Disclosure>
        <Disclosure id="panel-restore" label={t.restore} open={panel === 'restore'} onToggle={() => toggle('restore')}>
          <RestorePanel />
        </Disclosure>
        <Disclosure id="panel-ics" label={t.ics} open={panel === 'ics'} onToggle={() => toggle('ics')}>
          <IcsPanel prediction={prediction} today={today} />
        </Disclosure>
        <Disclosure id="panel-delete" label={t.deleteAll} open={panel === 'delete'} onToggle={() => toggle('delete')}>
          <DeletePanel />
        </Disclosure>
      </section>

      <section aria-labelledby="set-about">
        <h2 id="set-about">{t.aboutSection}</h2>
        <p className="settings-disclaimer">{de.disclaimer}</p>
        <p className="row-hint">{t.privacy}</p>
        <details className="settings-method">
          <summary>{t.methodology}</summary>
          {t.methodologyText.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <ul>
            {t.sources.map((src) => (
              <li key={src}>{src}</li>
            ))}
          </ul>
        </details>
      </section>
    </main>
  );
}
