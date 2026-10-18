import { useState } from 'react';
import { addDays, type ISODate } from '../../engine/dates.ts';
import type { Mode } from '../../engine/types.ts';
import { de } from '../../i18n/de.ts';
import type { OnboardingInput } from '../../state/onboarding.ts';
import { Button } from '../components/Button.tsx';
import { Stepper } from '../components/Stepper.tsx';
import { isStandalone } from '../hooks/useAppEnvironment.ts';
import './Onboarding.css';

const STEPS = 4;
const MODES: Mode[] = ['track', 'conceive', 'hormonal_contraception'];
const t = de.onboarding;

interface Props {
  today: ISODate;
  onDone: (input: OnboardingInput) => void;
}

export function Onboarding({ today, onDone }: Props) {
  const [step, setStep] = useState(1);
  const [start, setStart] = useState<ISODate | ''>('');
  const [cycleLength, setCycleLength] = useState<number | undefined>();
  const [periodLength, setPeriodLength] = useState<number | undefined>();
  const [mode, setMode] = useState<Mode>('track');

  const next = () => setStep((s) => s + 1);
  const skipPeriod = () => {
    setStart('');
    setCycleLength(undefined);
    setPeriodLength(undefined);
    next();
  };
  const finish = () =>
    onDone({
      mode,
      ...(start ? { lastPeriodStart: start } : {}),
      ...(cycleLength !== undefined ? { cycleLength } : {}),
      ...(periodLength !== undefined ? { periodLength } : {}),
    });

  return (
    <main className="onboarding">
      <header className="onboarding-head">
        <span className="wordmark">{de.appName}</span>
        <span className="onboarding-progress" aria-label={t.step(step, STEPS)}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={i < step ? 'is-done' : undefined} />
          ))}
        </span>
      </header>

      {step === 1 && (
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

      {step === 2 && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.period.title}</h1>
          <p className="onboarding-body">{t.period.body}</p>
          <div className="onboarding-fields">
            <label className="field">
              <span>{t.period.startLabel}</span>
              <input
                type="date"
                value={start}
                min={addDays(today, -120)}
                max={today}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <Stepper
              label={t.period.cycleLabel}
              value={cycleLength}
              min={18}
              max={60}
              fallback={28}
              format={t.period.days}
              unknownLabel={t.period.unknown}
              onChange={setCycleLength}
            />
            <Stepper
              label={t.period.periodLabel}
              value={periodLength}
              min={1}
              max={12}
              fallback={5}
              format={t.period.days}
              unknownLabel={t.period.unknown}
              onChange={setPeriodLength}
            />
          </div>
        </section>
      )}

      {step === 3 && (
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

      {step === 4 && (
        <section className="onboarding-step" aria-labelledby="ob-title">
          <h1 id="ob-title">{t.note.title}</h1>
          <p className="onboarding-statement">{de.disclaimer}</p>
          <p className="onboarding-body">{t.note.body}</p>
          <p className="onboarding-body">{t.note.pin}</p>
        </section>
      )}

      <footer className="onboarding-actions">
        {step < STEPS ? <Button onClick={next}>{t.next}</Button> : <Button onClick={finish}>{t.finish}</Button>}
        <div className="onboarding-secondary">
          {step > 1 && (
            <Button variant="quiet" onClick={() => setStep((s) => s - 1)}>
              {t.back}
            </Button>
          )}
          {step === 2 && (
            <Button variant="quiet" onClick={skipPeriod}>
              {t.skip}
            </Button>
          )}
        </div>
      </footer>
    </main>
  );
}
