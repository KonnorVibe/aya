import { Brand } from '../components/Brand.tsx';
import { useState } from 'react';
import { groupCode } from '../../crypto/base32.ts';
import { isStrongPassphrase, type Protection } from '../../crypto/vault.ts';
import { addDays, type ISODate } from '../../engine/dates.ts';
import type { Mode } from '../../engine/types.ts';
import { de } from '../../i18n/de.ts';
import type { OnboardingInput } from '../../state/onboarding.ts';
import type { ProtectionChoice } from '../../storage/repository.ts';
import { Button } from '../components/Button.tsx';
import { DoctorHint } from '../components/DoctorHint.tsx';
import { Stepper } from '../components/Stepper.tsx';
import { isStandalone } from '../hooks/useAppEnvironment.ts';
import './Onboarding.css';

const MODES: Mode[] = ['track', 'conceive', 'hormonal_contraception'];
const t = de.onboarding;

type StepId = 'welcome' | 'protect' | 'recovery' | 'period' | 'mode' | 'note';

interface Props {
  today: ISODate;
  /** Already chosen (onboarding resumed after a reload): the protection steps are skipped. */
  protection?: Protection | undefined;
  onProtect: (choice: ProtectionChoice) => Promise<{ recoveryCode?: string }>;
  onDone: (input: OnboardingInput) => void;
}

export function Onboarding({ today, protection, onProtect, onDone }: Props) {
  const [resumed] = useState(!!protection);
  const [step, setStep] = useState<StepId>('welcome');
  const [choice, setChoice] = useState<Protection>(protection ?? 'device');
  const [created, setCreated] = useState(resumed);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [noted, setNoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [start, setStart] = useState<ISODate | ''>('');
  const [cycleLength, setCycleLength] = useState<number | undefined>();
  const [periodLength, setPeriodLength] = useState<number | undefined>();
  const [mode, setMode] = useState<Mode>('track');

  const steps: StepId[] = [
    'welcome',
    ...(resumed ? [] : (['protect'] as const)),
    ...(!resumed && choice === 'passphrase' ? (['recovery'] as const) : []),
    'period',
    'mode',
    'note',
  ];
  const index = steps.indexOf(step);
  const go = (offset: number) => setStep(steps[index + offset]!);
  const canGoBack = index > 0 && !(created && (steps[index - 1] === 'protect' || steps[index - 1] === 'recovery'));

  const protect = async () => {
    if (created) return go(1);
    setProblem(undefined);
    if (choice === 'passphrase') {
      if (!isStrongPassphrase(pass)) return setProblem(t.protect.weak);
      if (pass !== pass2) return setProblem(t.protect.mismatch);
    }
    setBusy(true);
    try {
      const result = await onProtect(choice === 'device' ? { kind: 'device' } : { kind: 'passphrase', passphrase: pass });
      setCreated(true);
      setPass('');
      setPass2('');
      if (result.recoveryCode) setRecovery(result.recoveryCode);
      go(1);
    } finally {
      setBusy(false);
    }
  };

  const leaveRecovery = () => {
    setRecovery('');
    go(1);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(groupCode(recovery));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const skipPeriod = () => {
    setStart('');
    setCycleLength(undefined);
    setPeriodLength(undefined);
    go(1);
  };

  const finish = () =>
    onDone({
      mode,
      ...(start ? { lastPeriodStart: start } : {}),
      ...(cycleLength !== undefined ? { cycleLength } : {}),
      ...(periodLength !== undefined ? { periodLength } : {}),
    });

  const primary = (() => {
    if (step === 'protect') return <Button onClick={() => void protect()} disabled={busy}>{busy ? t.protect.working : t.next}</Button>;
    if (step === 'recovery') return <Button onClick={leaveRecovery} disabled={!noted}>{t.next}</Button>;
    if (step === 'note') return <Button onClick={finish}>{t.finish}</Button>;
    return <Button onClick={() => go(1)}>{t.next}</Button>;
  })();

  return (
    <main className="onboarding">
      <header className="onboarding-head">
        <Brand />
        <span className="onboarding-progress" aria-label={t.step(index + 1, steps.length)}>
          {steps.map((s, i) => (
            <span key={s} className={i <= index ? 'is-done' : undefined} />
          ))}
        </span>
      </header>

      {step === 'welcome' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.welcome.title}</h1>
          <ul className="onboarding-points">
            {t.welcome.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {!isStandalone() && <p className="onboarding-hint">{t.welcome.homeScreen}</p>}
        </section>
      )}

      {step === 'protect' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.protect.title}</h1>
          <p className="onboarding-body">{t.protect.body}</p>
          <fieldset className="choices" disabled={created || busy}>
            <legend className="visually-hidden">{t.protect.title}</legend>
            {(['device', 'passphrase'] as const).map((p) => (
              <label key={p} className="choice">
                <input type="radio" name="protection" value={p} checked={choice === p} onChange={() => setChoice(p)} />
                <span className="choice-text">
                  <span className="choice-label">{t.protect[p].label}</span>
                  <span className="choice-hint">{t.protect[p].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {choice === 'passphrase' && !created && (
            <div className="onboarding-fields">
              <label className="field">
                <span>{t.protect.field}</span>
                <input type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} value={pass} onChange={(e) => setPass(e.target.value)} />
              </label>
              <p className="onboarding-hint">{t.protect.fieldHint}</p>
              <label className="field">
                <span>{t.protect.repeat}</span>
                <input type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} value={pass2} onChange={(e) => setPass2(e.target.value)} />
              </label>
            </div>
          )}
          {problem && <p className="onboarding-error" role="alert">{problem}</p>}
        </section>
      )}

      {step === 'recovery' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.recovery.title}</h1>
          <p className="onboarding-body">{t.recovery.body}</p>
          <p className="recovery-code" aria-label={t.recovery.title}>{groupCode(recovery)}</p>
          <Button variant="quiet" onClick={() => void copyCode()}>{t.recovery.copy}</Button>
          {copied && <p className="onboarding-hint" role="status">{t.recovery.copied}</p>}
          <label className="check">
            <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
            <span>{t.recovery.confirm}</span>
          </label>
        </section>
      )}

      {step === 'period' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.period.title}</h1>
          <p className="onboarding-body">{t.period.body}</p>
          <div className="onboarding-fields">
            <label className="field">
              <span>{t.period.startLabel}</span>
              <input type="date" value={start} min={addDays(today, -120)} max={today} onChange={(e) => setStart(e.target.value)} />
            </label>
            <Stepper label={t.period.cycleLabel} value={cycleLength} min={18} max={60} fallback={28} format={t.period.days} unknownLabel={t.period.unknown} onChange={setCycleLength} />
            <Stepper label={t.period.periodLabel} value={periodLength} min={1} max={12} fallback={5} format={t.period.days} unknownLabel={t.period.unknown} onChange={setPeriodLength} />
          </div>
        </section>
      )}

      {step === 'mode' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.mode.title}</h1>
          <fieldset className="choices">
            <legend className="visually-hidden">{t.mode.title}</legend>
            {MODES.map((m) => (
              <label key={m} className="choice">
                <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
                <span className="choice-text">
                  <span className="choice-label">{t.mode.options[m].label}</span>
                  <span className="choice-hint">{t.mode.options[m].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {step === 'note' && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.note.title}</h1>
          <p className="onboarding-statement">{de.disclaimer}</p>
          <p className="onboarding-body">{t.note.body}</p>
          {choice === 'device' && <p className="onboarding-body">{t.note.pin}</p>}
          <DoctorHint />
        </section>
      )}

      <footer className="onboarding-actions">
        {primary}
        <div className="onboarding-secondary">
          {canGoBack && (
            <Button variant="quiet" onClick={() => go(-1)}>
              {t.back}
            </Button>
          )}
          {step === 'period' && (
            <Button variant="quiet" onClick={skipPeriod}>
              {t.skip}
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}
