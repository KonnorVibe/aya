import { useEffect, useState } from 'react';
import { de } from '../../i18n/de.ts';
import { useApp } from '../../state/store.ts';
import { PinPad } from '../components/PinPad.tsx';
import './LockScreen.css';

export function LockScreen() {
  const unlock = useApp((s) => s.unlock);
  const lockoutRemaining = useApp((s) => s.lockoutRemaining);
  const [waitUntil, setWaitUntil] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());

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
  const message = waiting ? de.lock.wait(seconds) : wrong ? de.lock.wrong : undefined;

  const submit = async (pin: string) => {
    const r = await unlock(pin);
    if (r.result === 'ok') return;
    setWrong(true);
    if (r.waitMs > 0) {
      setNow(Date.now());
      setWaitUntil(Date.now() + r.waitMs);
    }
  };

  return (
    <main className="lockscreen">
      <span className="wordmark">{de.appName}</span>
      <PinPad title={de.lock.title} {...(message ? { message } : {})} disabled={waiting} onComplete={submit} />
    </main>
  );
}
