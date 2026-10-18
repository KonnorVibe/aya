import { useEffect, useState, type FormEvent } from 'react';
import { de } from '../../i18n/de.ts';
import { useApp } from '../../state/store.ts';
import { Button } from '../components/Button.tsx';
import { PinPad } from '../components/PinPad.tsx';
import './LockScreen.css';

export function LockScreen() {
  const unlock = useApp((s) => s.unlock);
  const lockoutRemaining = useApp((s) => s.lockoutRemaining);
  const protection = useApp((s) => s.protection);
  const [waitUntil, setWaitUntil] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void lockoutRemaining().then((ms) => ms > 0 && setWaitUntil(Date.now() + ms));
  }, [lockoutRemaining]);

  useEffect(() => {
    if (waitUntil <= now) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waitUntil, now]);

  const seconds = Math.ceil((waitUntil - now) / 1000);
  const waiting = seconds > 0;
  const passphraseMode = protection === 'passphrase';
  const wrongText = passphraseMode ? de.lock.passphraseWrong : de.lock.wrong;
  const message = waiting ? de.lock.wait(seconds) : wrong ? wrongText : undefined;

  const submit = async (value: string) => {
    const r = await unlock(value);
    if (r.result === 'ok') return;
    setWrong(true);
    if (r.waitMs > 0) {
      setNow(Date.now());
      setWaitUntil(Date.now() + r.waitMs);
    }
  };

  const submitPassphrase = async (e: FormEvent) => {
    e.preventDefault();
    if (!secret || waiting) return;
    setBusy(true);
    try {
      await submit(secret);
    } finally {
      setBusy(false);
      setSecret('');
    }
  };

  if (passphraseMode) {
    return (
      <main className="lockscreen">
        <span className="wordmark">{de.appName}</span>
        <form className="lock-form" onSubmit={(e) => void submitPassphrase(e)}>
          <h1>{de.lock.passphraseTitle}</h1>
          <label className="lock-field">
            <span>{de.lock.passphraseLabel}</span>
            <input
              type="password"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              value={secret}
              disabled={busy || waiting}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
          {message && <p className="lock-message" role="alert">{message}</p>}
          <Button type="submit" disabled={busy || waiting || !secret}>
            {busy ? de.lock.unlocking : de.lock.unlock}
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="lockscreen">
      <span className="wordmark">{de.appName}</span>
      <PinPad title={de.lock.title} {...(message ? { message } : {})} disabled={waiting} onComplete={submit} />
    </main>
  );
}
