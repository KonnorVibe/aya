import { useState, type FormEvent } from 'react';
import { BackupError } from '../../../crypto/backup.ts';
import type { ISODate } from '../../../engine/dates.ts';
import { upcomingPeriods, type Prediction } from '../../../engine/prediction.ts';
import { de } from '../../../i18n/de.ts';
import { BACKUP_EXTENSION, BACKUP_MIME } from '../../../import-export/backup.ts';
import { deliverFile } from '../../../import-export/deliver.ts';
import { buildIcs, DEFAULT_ICS_TITLE } from '../../../import-export/ics.ts';
import { useApp } from '../../../state/store.ts';
import { Button } from '../../components/Button.tsx';

const t = de.settings;
const MIN_PASSWORD = 8;
const ICS_PERIODS = 6;

type Status = { kind: 'idle' } | { kind: 'working' } | { kind: 'done'; text: string } | { kind: 'error'; text: string };

function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return null;
  const text = status.kind === 'working' ? t.working : status.text;
  return (
    <p className={status.kind === 'error' ? 'panel-status is-error' : 'panel-status'} role="status">
      {text}
    </p>
  );
}

export function BackupPanel() {
  const exportBackup = useApp((s) => s.exportBackup);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) return setStatus({ kind: 'error', text: t.passwordShort });
    if (pw !== pw2) return setStatus({ kind: 'error', text: t.passwordMismatch });
    setStatus({ kind: 'working' });
    const { text, filename } = await exportBackup(pw);
    await deliverFile(text, filename, BACKUP_MIME);
    setPw('');
    setPw2('');
    setStatus({ kind: 'done', text: t.backupDone });
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{t.backupIntro}</p>
      <label className="panel-field">
        <span>{t.password}</span>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <label className="panel-field">
        <span>{t.passwordRepeat}</span>
        <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      <Button type="submit" disabled={status.kind === 'working'}>
        {t.backupCreate}
      </Button>
      <StatusLine status={status} />
    </form>
  );
}

export function RestorePanel() {
  const importBackup = useApp((s) => s.importBackup);
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setStatus({ kind: 'working' });
    try {
      const count = await importBackup(await file.text(), pw);
      setPw('');
      setStatus({ kind: 'done', text: t.restoreDone(count) });
    } catch (err) {
      const code = err instanceof BackupError ? err.code : 'invalid_file';
      setStatus({ kind: 'error', text: t.restoreErrors[code] });
    }
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{t.restoreIntro}</p>
      <label className="panel-field">
        <span>{t.restoreFile}</span>
        <input type="file" accept={`${BACKUP_EXTENSION},application/json,application/octet-stream`} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <label className="panel-field">
        <span>{t.password}</span>
        <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </label>
      <Button type="submit" variant="secondary" disabled={!file || !pw || status.kind === 'working'}>
        {t.restoreStart}
      </Button>
      <StatusLine status={status} />
    </form>
  );
}

export function IcsPanel({ prediction, today }: { prediction: Prediction | null; today: ISODate }) {
  const settings = useApp((s) => s.settings)!;
  const updateSettings = useApp((s) => s.updateSettings);
  const [title, setTitle] = useState(settings.icsTitle ?? DEFAULT_ICS_TITLE);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  if (!prediction) return <p className="panel">{t.icsNone}</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (title !== settings.icsTitle) await updateSettings({ icsTitle: title });
    const starts = upcomingPeriods(prediction, ICS_PERIODS)
      .map((r) => r.mostLikely)
      .filter((d) => d >= today);
    await deliverFile(buildIcs(starts, title), `aya-${today}.ics`, 'text/calendar');
    setStatus({ kind: 'done', text: t.icsDone });
  };

  return (
    <form className="panel" onSubmit={(e) => void submit(e)}>
      <p>{t.icsIntro}</p>
      <label className="panel-field">
        <span>{t.icsTitle}</span>
        <input type="text" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <Button type="submit" variant="secondary">
        {t.icsCreate}
      </Button>
      <StatusLine status={status} />
    </form>
  );
}

export function DeletePanel() {
  const wipeAll = useApp((s) => s.wipeAll);
  const [word, setWord] = useState('');
  const confirmed = word.trim().toUpperCase() === t.deleteWord;

  return (
    <form
      className="panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmed) void wipeAll();
      }}
    >
      <p>{t.deleteIntro}</p>
      <label className="panel-field">
        <span>{t.deleteConfirmLabel}</span>
        <input type="text" autoComplete="off" autoCapitalize="characters" value={word} onChange={(e) => setWord(e.target.value)} />
      </label>
      <Button type="submit" className="btn-danger" disabled={!confirmed}>
        {t.deleteButton}
      </Button>
    </form>
  );
}
