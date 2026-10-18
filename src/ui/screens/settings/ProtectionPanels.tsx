import { useState, type FormEvent } from 'react';
import { groupCode } from '../../../crypto/base32.ts';
import { isStrongPassphrase, WrongSecretError } from '../../../crypto/vault.ts';
import { de } from '../../../i18n/de.ts';
import { useApp } from '../../../state/store.ts';
import { Button } from '../../components/Button.tsx';

const t = de.settings;
const ob = de.onboarding;
const BACKUP_FRESH_MS = 24 * 60 * 60_000;

type Status = { kind: 'idle' } | { kind: 'working' } | { kind: 'error'; text: string } | { kind: 'done' };

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  const text = status.kind === 'working' ? ob.protect.working : status.kind === 'done' ? t.protectionDone : status.text;
  return (
    <p className={status.kind === 'error' ? 'panel-status is-error' : 'panel-status'} role="status">
      {text}
    </p>
  );
}

function PassField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <label className="panel-field">
      <span>{label}</span>
      <input type="password" autoComplete={autoComplete} autoCapitalize="none" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/** Shows a new recovery code once, until the user confirms it is written down. */
function RecoveryView({ code, onDone }: { code: string; onDone: () => void }) {
  const [noted, setNoted] = useState(false);
  return (
    <div className="panel">
      <p>{ob.recovery.body}</p>
      <p className="recovery-code" aria-label={ob.recovery.title}>{groupCode(code)}</p>
      <label className="check">
        <input type="checkbox" checked={noted} onChange={(e) => setNoted(e.target.checked)} />
        <span>{ob.recovery.confirm}</span>
      </label>
      <Button disabled={!noted} onClick={onDone}>{de.log.done}</Button>
    </div>
  );
}

/** Switching protection is the riskiest step, so a fresh backup comes first. */
function useBackupFresh(): boolean {
  const lastBackupAt = useApp((s) => s.lastBackupAt);
  const [openedAt] = useState(() => Date.now());
  return !!lastBackupAt && openedAt - Date.parse(lastBackupAt) < BACKUP_FRESH_MS;
}

const wrongOr = (err: unknown, fallback: string) => (err instanceof WrongSecretError ? de.lock.passphraseWrong : fallback);

export function ToPassphrasePanel({ onClose }: { onClose: () => void }) {
  const changeProtection = useApp((s) => s.changeProtection);
  const fresh = useBackupFresh();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (code) return <RecoveryView code={code} onDone={() => { setCode(''); onClose(); }} />;
  if (!fresh) return <div className="panel"><p>{t.backupFirst}</p></div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrongPassphrase(pass)) return setStatus({ kind: 'error', text: ob.protect.weak });
    if (pass !== pass2) return setStatus({ kind: 'error', text: ob.protect.mismatch });
    setStatus({ kind: 'working' });
    const r = await changeProtection({ kind: 'passphrase', passphrase: pass });
    setPass('');
    setPass2('');
    setStatus({ kind: 'idle' });
    setCode(r.recoveryCode ?? '');
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{ob.protect.passphrase.hint}</p>
      <PassField label={t.newPassphrase} value={pass} onChange={setPass} autoComplete="new-password" />
      <p className="row-hint">{ob.protect.fieldHint}</p>
      <PassField label={ob.protect.repeat} value={pass2} onChange={setPass2} autoComplete="new-password" />
      <Button type="submit" disabled={status.kind === 'working'}>{t.confirmAction}</Button>
      <StatusLine status={status} />
    </form>
  );
}

export function ToDevicePanel({ onClose }: { onClose: () => void }) {
  const changeProtection = useApp((s) => s.changeProtection);
  const fresh = useBackupFresh();
  const [current, setCurrent] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!fresh) return <div className="panel"><p>{t.backupFirst}</p></div>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus({ kind: 'working' });
    try {
      await changeProtection({ kind: 'device' }, current);
      setCurrent('');
      onClose();
    } catch (err) {
      setStatus({ kind: 'error', text: wrongOr(err, de.loadError) });
    }
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{t.toDeviceIntro}</p>
      <PassField label={t.currentPassphrase} value={current} onChange={setCurrent} autoComplete="current-password" />
      <Button type="submit" disabled={status.kind === 'working' || !current}>{t.confirmAction}</Button>
      <StatusLine status={status} />
    </form>
  );
}

export function ChangePassphrasePanel() {
  const changePassphrase = useApp((s) => s.changePassphrase);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isStrongPassphrase(next)) return setStatus({ kind: 'error', text: ob.protect.weak });
    if (next !== next2) return setStatus({ kind: 'error', text: ob.protect.mismatch });
    setStatus({ kind: 'working' });
    try {
      await changePassphrase(current, next);
      setCurrent('');
      setNext('');
      setNext2('');
      setStatus({ kind: 'done' });
    } catch (err) {
      setStatus({ kind: 'error', text: wrongOr(err, ob.protect.weak) });
    }
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <PassField label={t.currentPassphrase} value={current} onChange={setCurrent} autoComplete="current-password" />
      <PassField label={t.newPassphrase} value={next} onChange={setNext} autoComplete="new-password" />
      <p className="row-hint">{ob.protect.fieldHint}</p>
      <PassField label={ob.protect.repeat} value={next2} onChange={setNext2} autoComplete="new-password" />
      <Button type="submit" disabled={status.kind === 'working' || !current}>{t.confirmAction}</Button>
      <StatusLine status={status} />
    </form>
  );
}

export function NewRecoveryPanel({ onClose }: { onClose: () => void }) {
  const renewRecovery = useApp((s) => s.renewRecovery);
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (code) return <RecoveryView code={code} onDone={() => { setCode(''); onClose(); }} />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus({ kind: 'working' });
    try {
      const fresh = await renewRecovery(current);
      setCurrent('');
      setStatus({ kind: 'idle' });
      setCode(fresh);
    } catch (err) {
      setStatus({ kind: 'error', text: wrongOr(err, ob.protect.weak) });
    }
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{t.newRecoveryIntro}</p>
      <PassField label={t.currentPassphrase} value={current} onChange={setCurrent} autoComplete="current-password" />
      <Button type="submit" disabled={status.kind === 'working' || !current}>{t.confirmAction}</Button>
      <StatusLine status={status} />
    </form>
  );
}
